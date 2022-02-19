const express = require("express");

const serverHost = "localhost";
const serverPort = 8080;

const app = express();

app.listen(serverPort, serverHost, () => {
	console.log(`Server started listening on ${serverHost}:${serverPort}`);
})

app.get("/", (request, response) => {
	response.sendFile("views/welcome.html", { root: __dirname });
})

app.get("/welcome", (request, response) => {
	response.sendFile("views/welcome.html", { root: __dirname });
})

app.get("/about", (request, response) => {
	response.sendFile("views/about.html", { root: __dirname });
})

app.use((request, response) => {
	response.status(404).sendFile("views/error404.html", { root: __dirname });
});