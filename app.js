import express from "express";
import morgan from "morgan";
import methodOverride from "method-override";

import { fileURLToPath } from 'url';
import { dirname, join as pathJoin } from 'path';

import { } from "./config.js";
import about from "./src/about.js";
import queue from "./src/queue.js";
import archive from "./src/archive.js";
import common from "./src/common.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const pathToPublic = pathJoin(__dirname, "public");

const app = express();
app.use(express.static(pathToPublic));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(methodOverride("_method"));

app.set("view engine", "ejs");
app.set('views', pathJoin(pathToPublic, "views"));

app.use(morgan("dev"));

app.listen(process.env.PORT, () => {
    console.log(`Server started listening on port ${process.env.PORT}.`);
});

app.use(common.findSocials);

app.get("/", about.show);

app.get("/about", about.show);

app.get("/queue", queue.show);
app.post("/queue", queue.update);

app.get("/archive", archive.show);
app.get("/archive/:id", archive.download);
app.delete("/archive/:id", archive.delete({ redirect: "/archive" }));
app.post("/archive/upload", archive.upload, archive.postUpload({ redirect: "/archive" }));

app.use(common.resourceNotFoundError);
app.use(common.serverError);
app.use(common.lastError);