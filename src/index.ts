import * as express from "express"
import * as bodyParser from "body-parser"
import {initAuth, validateAuth} from "./auth"
import {receive} from "./receive"
import {initTokens} from "./tokens"

const app = express()

app.use(bodyParser.json())

app.post("/receive", receive)

app.use("/auth", initAuth())
app.use(validateAuth)

app.use("/tokens", initTokens())

app.listen(8080)
