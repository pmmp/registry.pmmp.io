import {Request, Response, NextFunction} from "express"
import {AuthRequest} from "./auth"

export function objectEntries<T>(object: {[k: string]: T}) : [string, T][] {
	const output: [string, T][] = []
	for(const k in object) {
		output.push([k, object[k]])
	}
	return output
}

export function stringParam(object: {[key: string]: any}, name: string) : string {
	if(typeof object[name] !== "string") {
		throw {httpCode: 401, message: `Missing parameter "${name}"`}
	}

	return object[name]
}

export function numberParam(object: {[key: string]: any}, name: string) : number {
	if(typeof object[name] !== "number") {
		throw {httpCode: 401, message: `Missing parameter "${name}"`}
	}

	return object[name]
}

export function asyncHandler(fn: (req: AuthRequest, res: Response) => Promise<void | object | string>) : ((req: Request, res: Response, next: NextFunction) => void) {
	return (req, res, _next) => {
		fn(req as AuthRequest, res)
			.then(ret => {
				res.header("Access-Control-Allow-Origin", "*")
				if(typeof ret === "object") {
					res.json(ret)
				} else if(typeof ret === "string") {
					res.send(ret)
				}
			})
			.catch(e => {
				res.status(e.httpCode || 500)
				if(e.httpCode && e.message) {
					res.send(e.message)
				} else {
					res.end()
				}
			})
	}
}

export function asyncMiddleware(fn: (req: AuthRequest, res: Response) => Promise<void>) : ((req: Request, res: Response, next: NextFunction) => void) {
	return (req, res, next) => {
		fn(req as AuthRequest, res)
			.then(() => next())
			.catch(e => {
				res.status(e.httpCode || 500)
				if(e.httpCode && e.message) {
					res.send(e.message)
				} else {
					res.end()
				}
			})
	}
}
