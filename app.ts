import express from "express";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import cors from "cors";

import { initializedDatabase } from "./src/services/database.service.js";
import authentication from "./src/services/authentication.service.js";
import user from "./src/services/user.service.js";
import group from "./src/services/group.service.js";
import queue from "./src/services/queue.service.js";
import archive from "./src/services/archive.service.js";
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
apiRouter.get("/users/:userId/groups", authentication.authGuard, user.showGroups);
apiRouter.get("/users/token", authentication.authGuard, user.findByToken);

// Group operations:
apiRouter.get("/groups/:groupId", authentication.membershipGuard, group.show);
apiRouter.get("/groups/:groupId/members", authentication.membershipGuard, group.showUsers);
apiRouter.get("/groups/:groupId/queues/perspective/:userId", authentication.membershipGuard, group.showQueuesPerspective);
apiRouter.post("/groups", authentication.authGuard, group.create);
apiRouter.put("/groups/:groupId/members/email", authentication.creatorshipGuard, group.addMemberWithEmail);
apiRouter.put("/groups/:groupId/members/:userId", authentication.creatorshipGuard, group.addMemberWithId);
apiRouter.delete("/groups/:groupId/members/:userId", authentication.creatorshipGuard, group.deleteMember);
apiRouter.post("/groups/:groupId/queues", authentication.creatorshipGuard, group.createQueue);
apiRouter.delete("/groups/:groupId/queues/:queueId", authentication.creatorshipGuard, group.deleteQueue);
apiRouter.delete("/groups/:groupId", authentication.creatorshipGuard, group.delete);

// Queue operations:
apiRouter.get("/queues/:queueId", authentication.membershipFromQueueGuard, queue.show);
apiRouter.get("/queues/:queueId/perspective/:userId", authentication.membershipFromQueueGuard, queue.showPerspectiveSummary);
apiRouter.get("/queues/:queueId/members", authentication.membershipFromQueueGuard, queue.showUsers);
apiRouter.get("/queues/:queueId/group", authentication.membershipFromQueueGuard, queue.showGroup);
apiRouter.post("/queues/:queueId/shuffle", authentication.membershipFromQueueGuard, queue.shuffleMembers);
apiRouter.post("/queues/:queueId/rotate", authentication.membershipFromQueueGuard, queue.rotateMembers);
apiRouter.get("/queues/:queueId/members/:userId", authentication.membershipFromQueueGuard, queue.getMember);
apiRouter.put("/queues/:queueId/members/:userId", authentication.membershipFromQueueGuard, queue.addMember);
apiRouter.delete("/queues/:queueId/members/:userId", authentication.membershipFromQueueGuard, queue.deleteMember);
apiRouter.patch("/queues/:queueId/members/:userId", authentication.creatorshipFromQueueOrPersonnelGuard, queue.setMemberStatus);

// Archive operations:
apiRouter.get("/files", authentication.authGuard, archive.show);
apiRouter.post("/files", authentication.authGuard, archive.preUpload, archive.uploadFiles, archive.postUpload);
apiRouter.get("/files/:fileId", authentication.authGuard, archive.downloadFile);
apiRouter.delete("/files/:fileId", authentication.authGuard, archive.deleteFile);

app.use("/api", apiRouter);

// Error handling:
app.use(errorHandling.unknownRequest);
app.use(errorHandling.handleError);

app.listen(process.env.PORT, () => {
    console.log(`Server started listening on port ${process.env.PORT}`);
});
