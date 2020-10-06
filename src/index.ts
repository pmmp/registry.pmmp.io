import * as express from "express"
import {Request, Response, NextFunction} from "express"
import * as bodyParser from "body-parser"
import * as cookieParser from "cookie-parser"
import {AuthRequest, initAuth, validateAuth} from "./auth"
import {config} from "./config"
import {receive} from "./receive"

const app = express()

app.use(cookieParser(config.globalHmacKey, {decode: JSON.parse}))

app.use("/receive", bodyParser.json())

app.post("/receive", asyncHandler(receive))

app.use("/auth", initAuth)

app.use(validateAuth)

app.listen(8080)

export function asyncHandler(fn: (req: AuthRequest, res: Response) => Promise<void | object | string>) : ((req: Request, res: Response, next: NextFunction) => void) {
	return (req, res, _next) => {
		fn(req as AuthRequest, res)
			.then(ret => {
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
