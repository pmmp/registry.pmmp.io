import * as mongoose from "mongoose"
import {Schema, model} from "mongoose"
import {config} from "./config"

mongoose.connect(`mongodb://${config.db.host}:${config.db.port}/${config.db.db}`, {
	poolSize: config.db.poolSize,
	useNewUrlParser: true,
})

export const tokenSchema = new Schema({
	owner: Number,
	description: String,
	lastUsed: Number,
	secret: String,
})
export const Token = model("Token", tokenSchema)
