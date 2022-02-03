const http = require("http");

const serverHost = "localhost";
const serverPort = 8080;

const server = http.createServer((request, response) => {
	console.log(`Accepted request: url=${request.url}, method=${request.method}`);
	response.setHeader("Content-Type", "text/plain");
	response.write("Hello, world");
	response.end();
});

server.listen(serverPort, () => {
	console.log(`Server started listening on ${serverHost}:${serverPort}`);
});
