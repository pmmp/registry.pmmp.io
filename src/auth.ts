import {Request, Router} from "express"
import fetch from "node-fetch"
import {Octokit} from "@octokit/rest"
import {commonDecrypt, commonEncrypt, config} from "./config"
import {asyncHandler, asyncMiddleware, objectEntries, stringParam} from "./util"

const SESSION_TTL = 1000 * 86400 * 7

export function initAuth() {
	const router = Router()
	router.get("/redir", loginPath)
	router.get("/login", loginCallback)
	return router
}

const loginPath = asyncHandler(async () => {
		const args = {
			client_id: config.gh.clientId,
			redirect_uri: `${config.http.registry}/auth/login`,
			scope: "read:org,user:email",
		}
		const formattedArgs = objectEntries(args)
			.map(([k, v]) => encodeURIComponent(k) + "=" + encodeURIComponent(v))
			.join("&")
		return {
			url: `https://github.com/login/oauth/authorize?${formattedArgs}`,
		}
})

const loginCallback = asyncHandler(async (req, res) => {
	const code = stringParam(req.query, "code")

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
		}),
	})).json()

	const client = new Octokit({auth: token})
	const {data: user} = await client.users.getAuthenticated()

	const session = {
		username: user.login,
		userId: user.id,
		token,
		time: Date.now(),
	}

	const sessionSigned = await signSession(session)

	res.redirect(`${config.http.frontend}?registry-session=${sessionSigned}`)
})

export type AuthRequest = Request & {
	login?: Login
}

export type Login = {username: string, userId: number, token: string}

export const validateAuth = asyncMiddleware(async req => {
	const sessionSigned = req.get("X-Registry-Session")
	if(sessionSigned !== undefined) {
		const session = await unsignSession(sessionSigned)
		if(Date.now() - session.time < SESSION_TTL) {
			req.login = {
				username: session.username,
				userId: session.userId,
				token: session.token,
			}
		}
	}
})

async function signSession(session: object) : Promise<string> {
	return await commonEncrypt(JSON.stringify(session))
}

async function unsignSession(session: string) : Promise<any> {
	const json = await commonDecrypt(session)
	if(json === null) {
		throw {httpCode: 403, message: "Invalid session secret"}
	}
	return JSON.parse(json)
}
