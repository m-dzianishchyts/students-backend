import express from "express";
import morgan from "morgan";
import path from "path";

import { config } from "./config.js";
import {
	connect,
	findSocials,
	findQueueMembers
} from "./src/mongodb.js"

import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pathToPublic = path.join(__dirname, "public");

async function initialize() {
	const app = express();
	app.use(express.static(pathToPublic));

	app.set("view engine", "ejs");
	app.set('views', path.join(pathToPublic, "views"));

	app.use(morgan("dev"));

	const mongoClient = await connect();
	console.log("Connected to mongoDB.");

	app.listen(config.port, () => {
		console.log(`Server started listening on port ${config.port}.`);
	});

	app.use(async (req, res, next) => {
		let socials = await findSocials(mongoClient);
		res.locals.socials = socials;
		next();
	});

	app.get("/", (request, response) => {
		response.render("index", {
			header: "Welcome to Students!",
			subheader: "Student group queues & notes"
		});
	});

	app.get("/about", (request, response) => {
		response.render("index", {
			header: "Welcome to Students!",
			subheader: "Student group queues & notes"
		});
	});

	app.get("/queue", async (request, response) => {
		let members = await findQueueMembers(mongoClient);
		response.render("queue", {
			members: members
		});
	});

	app.get("/archive", (request, response) => {
		// TODO: MondoDB request
		response.render("archive", {
		});
	});

	app.use((request, response) => {
		response.status(404).render("error404", {
			title: "Error"
		});
	});
}

initialize();





