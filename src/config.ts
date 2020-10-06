import {createHmac} from "crypto"
import {readFileSync} from "fs"
import {Octokit} from "@octokit/rest"

export interface Config {
	globalHmacKey: string
	gh: {
		token: string
		clientId: string
		clientSecret: string
	}
	db: {
		host: string
		port: number
		user: string
		pass: string
		db: string
		poolSize: number
	}
}

export const config = loadConfig()

export const gh = new Octokit({
	auth: config.gh.token,
})

export function globalHmac(buf: Buffer) : Buffer {
	const hmac = createHmac("sha512", config.globalHmacKey)
	hmac.update(buf)
	return hmac.digest()
}

function loadConfig() : Config {
	return JSON.parse(readFileSync("config.json", {encoding: "utf8"}))
}
