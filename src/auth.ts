import {randomBytes} from "crypto"
import {Request, Router} from "express"
import fetch from "node-fetch"
import {Octokit} from "@octokit/rest"
import {promisify} from "util"
import {asyncHandler} from "."
import {config} from "./config"
import {Token} from "./db"
import {objectEntries} from "./util"

const SESSION_TTL = 1000 * 86400

type Session = {
	step: "redir"
	state: string
	frontend: string
} | {
	step: "authed"
	username: string
	userId: number
	token: string
	time: number
}

async function initialSession(frontend: string) : Promise<Session & {step: "redir"}> {
	return {
		step: "redir",
		state: (await promisify(randomBytes)(20)).toString("hex"),
		frontend,
	}
}

export function initAuth() {
	const router = Router()
	router.get("/redir", asyncHandler(async (req, res) => {
		const session = await initialSession(String(req.query.frontend))
		res.cookie("SESSION", JSON.stringify(session))
		const host = req.query.host
		const args = {
			client_id: config.gh.clientId,
			redirect_uri: `${host}/auth/login`,
			scope: "read:org,user:email",
			state: session.state,
		}
		const formattedArgs = objectEntries(args)
			.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
			.join("&")
		return {
			url: `https://github.com/login/oauth/authorize?${formattedArgs}`,
		}
	}))

	router.get("/login", asyncHandler(async (req, res) => {
		const code = req.query.code
		const state = req.query.state
		if(code === undefined || state === undefined) {
			throw {httpCode: 400, message: "Missing parameter"}
		}

		if(!req.signedCookies.SESSION) {
			throw {httpCode: 401, message: "Please enable cookies"}
		}
		const session = req.signedCookies.SESSION
		if(session.step !== "redir") {
			res.redirect(`${session.frontend}`)
			return
		}
		if(session.state !== state) {
			throw {httpCode: 401, message: "State mismatch"}
		}

		const {access_token: token} = await (await fetch("https://github.com/login/oauth/access_token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Accept": "application/json",
			},
			body: JSON.stringify({
				client_id: config.gh.clientId,
				client_secret: config.gh.clientSecret,
				code,
				state,
			}),
		})).json()

		const client = new Octokit({token})
		const {data: user} = await client.users.getAuthenticated()

		const newSession = {
			step: "authed",
			username: user.login,
			userId: user.id,
			token,
			time: Date.now(),
		}

		res.cookie("SESSION", JSON.stringify(newSession))

		res.redirect(`${session.frontend}`)
	}))
}

export type AuthRequest = Request & {
	login?: {username: string, userId: number, token: string}
}

export const validateAuth = asyncHandler(async req => {
	const session = req.signedCookies.SESSION
	if(session.step === "authed" && Date.now() - session.time < SESSION_TTL) {
		req.login = {
			username: session.username,
			userId: session.userId,
			token: session.token,
		}
	}
})

export const listTokens = asyncHandler(async req => {
	if(!req.login) {
		throw {httpCode: 401, message: "Login required"}
	}
	const client = new Octokit({
		token: req.login.token,
	})
	const orgs = await client.paginate(client.orgs.listForAuthenticatedUser)
	const tokens = []
	for(const org of orgs) {
		const objects = await Token.find({owner: org.id}) as any[]
		for(const object of objects) {
			tokens.push({
				owner: org.login,
				first: object.secret.substr(0, 7),
				lastUsed: object.lastUsed,
				id: object._id,
			})
		}
	}
	return tokens
})
