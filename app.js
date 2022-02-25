const express = require("express");
const morgan = require("morgan");

const config = require("./config");

const app = express();
app.set("view engine", "ejs");

app.use(morgan("dev"));

app.listen(config.port, () => {
	console.log(`Server started listening on port ${config.port}`);
});

app.get("/", (request, response) => {
	response.render("overview", {
		title: "Student Group Queues & Notes",
	});
});

app.get("/overview", (request, response) => {
	response.render("overview", {
		title: "Student Group Queues & Notes",
	});
});

app.get("/contacts", (request, response) => {
	response.render("contacts", {
		title: "Contacts",
		contactOptions: [
			{ name: "GitHub", url: "https://github.com/m-dzianishchyts/students" },
			{ name: "Email", url: "mailto:mikhail.dzianishchyts@gmail.com" },
			{ name: "LinkedIn", url: "https://www.linkedin.com/in/mikhail-dzianishchyts/" },
		],
	});
});

app.get("/queue", (request, response) => {
	let queueMembers = [];
	for (let i = 1; i <= 20; i++) {
		let queueMember = { id: i, name: "Person " + i, position: i, isReady: true, isOnline: false };
		queueMembers.push(queueMember);
	}
	response.render("queue", {
		title: "Queue",
		queueTitle: "Common",
		queueMembers: queueMembers,
	});
});

app.use((request, response) => {
	response.status(404).render("error404", {
		title: "Error",
	});
});
