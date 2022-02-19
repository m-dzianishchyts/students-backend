const http = require("http");
const fs = require("fs");
const { time } = require("console");

const serverHost = "localhost";
const serverPort = 8080;

const server = http.createServer((request, response) => {
	console.log(`Accepted request: url=${request.url}, method=${request.method}`);
	handleRequest(request, response);
});

server.listen(serverPort, () => {
	console.log(`Server started listening on ${serverHost}:${serverPort}`);
});

async function handleRequest(request, response) {
	let url = request.url;
	let pagePath = "./views/";
	switch (url) {
		case "/":
		case "/welcome":
			pagePath += "welcome.html";
			break;
		case "/about":
			pagePath += "about.html";
			break;
		default:
			response.statusCode = 404;
			pagePath += "error404.html";
			break;
	}
	await sendPage(pagePath, response);
	response.end();
}

async function sendPage(pagePath, response) {
	console.log(`Sending ${pagePath}...`);
	response.setHeader("Content-Type", "text/html")
	return fs.promises.readFile(pagePath)
		.then(data => {
			response.write(data);
		})
		.catch(error => {
			console.log(error);
			return sendInternalServerErrorPage("./views/error500.html", response);
		});
}

async function sendInternalServerErrorPage(pagePath, response) {
	return fs.promises.readFile(pagePath)
		.then(value => {
			response.write(value);
		})
		.catch(reason => {
			console.log(reason);
			response.write("500 Internal Server Error")
		});
}
