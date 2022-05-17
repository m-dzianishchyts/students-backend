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

const apiRouter = express.Router();

// Authentication:
apiRouter.post("/authenticate", authentication.authenticate);
apiRouter.post("/logout", authentication.logout);
apiRouter.post("/register", authentication.register);

// User operations:
apiRouter.get("/users/in-queue/:queueId", authentication.authenticationGuard, user.findInQueue);
apiRouter.get("/users/token", authentication.authenticationGuard, user.findByToken);

// Queue operations:
apiRouter.get("/queue/:queueId", authentication.authenticationGuard, queue.show);
apiRouter.post("/queue/:queueId/members/shuffle", authentication.authenticationGuard, queue.shuffleMembers);
apiRouter.post("/queue/:queueId/members/rotate", authentication.authenticationGuard, queue.rotateMembers);
apiRouter.put("/queue/:queueId/members/:userId", authentication.authenticationGuard, queue.addMember);
apiRouter.patch("/queue/:queueId/members/:userId", authentication.authenticationGuard, queue.setMemberStatus);
apiRouter.delete("/queue/:queueId/members/:userId", authentication.authenticationGuard, queue.deleteMember);

// Archive operations:
apiRouter.get("/files", authentication.authenticationGuard, archive.show);
apiRouter.post("/files", authentication.authenticationGuard, archive.preUpload, archive.uploadFiles, archive.postUpload);
apiRouter.get("/files/:id", authentication.authenticationGuard, archive.downloadFile);
apiRouter.delete("/files/:id", authentication.authenticationGuard, archive.deleteFile);

apiRouter.use("/", authentication.authenticationGuard);

app.use("/api", apiRouter);

// Error handling:
app.use(errorHandling.unknownRequest);
app.use(errorHandling.handleError);

app.listen(process.env.PORT, () => {
    console.log(`Server started listening on port ${process.env.PORT}`);
});
