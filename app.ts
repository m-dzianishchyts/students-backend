import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";

import { initializedDatabase } from "./src/services/database.service.js";
import authentication from "./src/services/authentication.service.js";
import queue from "./src/services/queue.service.js";
import archive from "./src/services/archive.service.js";
import user from "./src/services/user.service.js";
import errorHandling from "./src/services/error-handling.service.js";

await initializedDatabase;

const app = express();
console.log("Server is launching...");

// Parse application/json
app.use(express.json());
// Parse application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));

// Parse cookies and signed cookies
app.use(cookieParser("secret"));

app.use(morgan("dev"));

const corsOptions: cors.CorsOptions = {
    methods: "GET, POST, OPTIONS, PUT, PATCH, DELETE",
    credentials: true,
    origin: new RegExp(process.env.CORS_ORIGIN),
};
app.use(cors(corsOptions));

app.get("/", (request, response, next) => {
    response.status(200).send("Please stand by. I don't know what to do");
});

const apiRouter = express.Router();

// Authentication:
apiRouter.post("/authenticate", authentication.authenticate);
apiRouter.post("/logout", authentication.logout);
apiRouter.post("/register", authentication.register);

// User operations:
apiRouter.get("/users/in-queue/:queueId", user.findInQueue);
apiRouter.get("/users/token", user.findByToken);

// Queue operations:
apiRouter.get("/queue/:queueId", queue.show);
apiRouter.post("/queue/:queueId/members/shuffle", queue.shuffleMembers);
apiRouter.post("/queue/:queueId/members/rotate", queue.rotateMembers);
apiRouter.put("/queue/:queueId/members/:userId", queue.addMember);
apiRouter.patch("/queue/:queueId/members/:userId", queue.setMemberStatus);
apiRouter.delete("/queue/:queueId/members/:userId", queue.deleteMember);

// Archive operations:
apiRouter.get("/files", archive.show);
apiRouter.post("/files", archive.preUpload, archive.uploadFiles, archive.postUpload);
apiRouter.get("/files/:id", archive.downloadFile);
apiRouter.delete("/files/:id", archive.deleteFile);

app.use("/api", apiRouter);

// Error handling:
app.use(errorHandling.unknownRequest);
app.use(errorHandling.handleError);

app.listen(process.env.PORT, () => {
    console.log(`Server started listening on port ${process.env.PORT}`);
});
