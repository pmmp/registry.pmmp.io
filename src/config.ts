import {createCipheriv, createDecipheriv, createHmac, randomBytes, scryptSync, timingSafeEqual} from "crypto"
import {readFileSync} from "fs"
import {Octokit} from "@octokit/rest"
import * as toml from "toml"
import {promisify} from "util"

export interface Config {
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
	http: {
		frontend: string // plugins.pmmp.io
		registry: string // registry.pmmp.io
		commonKey: string // an arbitrary password used for signing sessions
	}
}

export const config = loadConfig()

export const gh = new Octokit({
	auth: config.gh.token,
})

export async function commonSign(string: string) : Promise<string> {
	const hmac = createHmac("sha512", config.http.commonKey)
	hmac.update(Buffer.from(string))
	const code = hmac.digest("base64")
	return `${processBase64(code)}=${string}`
}

export async function commonVerify(sign: string) : Promise<string | null> {
	const sep = sign.indexOf("=")
	if(sep === -1) {
		return null;
	}
	const string = sign.substr(sep + 1)
	const match = commonSign(string)
	if(timingSafeEqual(Buffer.from(string), Buffer.from(match))) {
		return string
	}

	return null
}

function processBase64(base64: string) : string {
	return base64.replace(/\=/g, "$")
}

function unprocessBase64(base64: string) : string {
	return base64.replace(/\$/g, "=")
}

const commonScrypt = scryptSync(config.http.commonKey, config.http.registry, 256 / 8)

export async function commonEncrypt(string: string) : Promise<string> {
	const sign = await commonSign(string)
	const iv = await promisify(randomBytes)(16)
	const cipher = createCipheriv("aes-256-cbc", commonScrypt, iv)
	const enc = cipher.update(sign, "utf8")
	const enc2 = cipher.final()
	return processBase64(Buffer.concat([iv, enc, enc2]).toString("base64"))
}

export async function commonDecrypt(string: string) : Promise<string | null> {
	const buf = Buffer.from(unprocessBase64(string), "base64")
	const iv = buf.slice(0, 16)
	const enc = buf.slice(16)
	const decipher = createDecipheriv("aes-256-cbc", commonScrypt, iv)
	const dec = decipher.update(enc)
	const dec2 = decipher.final()
	const sign = Buffer.concat([dec, dec2]).toString("utf8")
	return await commonVerify(sign)
}

function loadConfig() : Config {
	return toml.parse(readFileSync("config.toml", {encoding: "utf8"}))
}
