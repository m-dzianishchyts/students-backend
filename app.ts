import express from "express";
import morgan from "morgan";

import database from "./src/services/database.service.js";

import queue from "./src/services/queue.service.js";
import archive from "./src/services/archive.service.js";
import user from "./src/services/user.service.js";
import errorHandling from "./src/services/error-handling.service.js";

await database.initialized;

console.log("Server is launching...");
const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(morgan("dev"));

// User operations:
app.get("/users", user.findInQueue);

// Queue operations:
app.get("/queue/:queueId", queue.show);
app.post("/queue/:queueId/members/shuffle", queue.shuffleMembers);
app.post("/queue/:queueId/members/rotate", queue.rotateMembers);
app.put("/queue/:queueId/members/:userId", queue.addMember);
app.patch("/queue/:queueId/members/:userId", queue.setMemberStatus);
app.delete("/queue/:queueId/members/:userId", queue.deleteMember);

// Archive operations:
app.get("/files", archive.show);
app.post("/files", archive.uploadFiles, archive.postUpload);
app.get("/files/:id", archive.downloadFile);
app.delete("/files/:id", archive.deleteFile);

// Error handling:
app.use(errorHandling.unknownRequest);
app.use(errorHandling.handleError);

app.listen(process.env.PORT, () => {
    console.log(`Server started listening on port ${process.env.PORT}`);
});
