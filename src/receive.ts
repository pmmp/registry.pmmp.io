import {Request} from "express"
import {OctokitResponse} from "@octokit/types"
import {gh} from "./config"
import {Token} from "./db"
import {asyncHandler} from "./util"

interface ReceiveArg {
	repoId: number
	event: "push" | "pull_request" | "release"
	commit: string
	artifact: string
}

export const receive = asyncHandler(async (req: Request) => {
	const secret = req.get("X-Registry-Secret")
	const arg = req.body as ReceiveArg

	if(secret) {
		const token = await Token.findOne({secret}).exec() as {owner: number} | null
		if(token === null) {
			throw {httpCode: 401, message: "invalid secret"}
		}

		const {data: repo} = await gh.request(`GET /repositories/${arg.repoId}`) as OctokitResponse<{ owner: { id: number } }>
		if(repo.owner.id !== token.owner) {
			throw {httpCode: 403, message: "secret mismatch, please use the secret for the organization explicitly"}
		}
	}

	return "OK"
})
