import express from "express";
import morgan from "morgan";
import path from "path";

import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { config } from "./config.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pathToPublic = path.join(__dirname, "public");

const socials = [
	{
		name: "github",
		url: "https://github.com/m-dzianishchyts/students"
	},
	{
		name: "linkedin",
		url: "https://www.linkedin.com/in/mikhail-dzianishchyts"
	},
	{
		name: "email",
		url: "mailto:mail@mikhail.dzianishchyts@gmail.com?subject=Students App"
	}
];

const app = express();
app.use(express.static(pathToPublic));

app.set("view engine", "ejs");
app.set('views', path.join(pathToPublic, "views"));

app.use(morgan("dev"));

app.listen(config.port, () => {
	console.log(`Server started listening on port ${config.port}`);
});

app.get("/", (request, response) => {
	response.render("index", {
		header: "Welcome to Students!",
		subheader: "Student group queues & notes",
		socials: socials
	});
});

app.get("/about", (request, response) => {
	response.render("index", {
		header: "Welcome to Students!",
		subheader: "Student group queues & notes",
		socials: socials
	});
});

app.get("/queue", (request, response) => {
	// TODO: MondoDB request
	response.render("queue", {
		socials: socials
	});
});

app.get("/archive", (request, response) => {
	// TODO: MondoDB request
	response.render("archive", {
		socials: socials
	});
});

app.use((request, response) => {
	response.status(404).render("error404", {
		title: "Error",
		socials: socials
	});
});
