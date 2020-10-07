import {randomBytes} from "crypto"
import {Router} from "express"
import {Octokit} from "@octokit/rest"
import {Login} from "./auth"
import {Token} from "./db"
import {asyncHandler, numberParam, stringParam} from "./util"

export function initTokens() {
	const router = Router()
	router.get("/", listTokens)
	router.put("/", createToken)
	router.delete("/", removeToken)
	return router
}

const listTokens = asyncHandler(async req => {
	if(!req.login) {
		throw {httpCode: 401, message: "Login required"}
	}
	const tokens = []
	for(const org of await listOwnedOrgs(req.login)) {
		const objects = await Token.find({owner: org.id}).exec() as any[]
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

const createToken = asyncHandler(async req => {
	if(!req.login || typeof req.body !== "object") {
		throw {httpCode: 401, message: "Login required"}
	}

	const owner = numberParam(req.body, "owner")
	const description = stringParam(req.body, "description")

	await ensureAccess(req.login.token, owner)

	const secret = randomBytes(20).toString("hex")
	const object = {
		owner,
		description,
		lastUsed: Date.now(),
		secret,
	}
	await Token.create(object)
	return object
})

async function ensureAccess(auth: string, orgId: number) {
	const client = new Octokit({auth})
	try {
		const {data} = await client.request(`GET /user/memberships/organizations/${orgId}`) // need to access by ID
		if(data.role === "admin") {
			return
		}
	} catch(_) {
		// fallthrough
	}
	throw {httpCode: 401, message: "You must be an owner of the organization to create a token."}
}

const removeToken = asyncHandler(async (req, res) => {
	if(!req.login) {
		throw {httpCode: 401, message: "Login required"}
	}

	const secret = stringParam(req.body, "secret")
	const token = await Token.findOne({secret}).exec() as any
	if(token === null) {
		throw {httpCode: 404, message: "No such secret"}
	}

	await ensureAccess(req.login.token, token.owner)

	await Token.deleteOne({_id: token._id}).exec()

	res.status(204)
})

async function listOwnedOrgs({userId, username, token}: Login) : Promise<{id: number, login: string}[]> {
	const client = new Octokit({auth: token})
	const orgs = await client.paginate(client.orgs.listForAuthenticatedUser)
	const output = [{id: userId, login: username}]
	const promises = []
	for(const org of orgs) {
		promises.push(client.orgs.getMembershipForAuthenticatedUser({org: org.login}))
	}
	const memberships = await Promise.all(promises)
	for(const {data} of memberships) {
		if(data.role === "admin") {
			output.push({
				id: data.organization.id,
				login: data.organization.login,
			})
		}
	}
	return output
}
