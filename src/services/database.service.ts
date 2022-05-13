import mongoose from "mongoose";
import { GridFsStorage } from "multer-gridfs-storage";

import config from "../../config.js";

config.load();

let resolveInitialization: (value: unknown) => void;
let initialized = new Promise((resolve, error) => {
    resolveInitialization = resolve;
});

let mongodbUri: string;

mongodbUri =
    "mongodb://" +
    `${process.env.MONGODB_USERNAME}:` +
    `${process.env.MONGODB_PASSWORD}@` +
    `${process.env.MONGODB_ADDRESS}/` +
    `${process.env.MONGODB_NAME}` +
    "?authMechanism=DEFAULT";

const mongodb = await mongoose.connect(mongodbUri);
mongodb.connection.once("open", () => {
    console.log(`Connected to MongoDB: ${mongodb.connection.host} `);
});

const gridFsBucket = new mongoose.mongo.GridFSBucket(mongodb.connection.db, { bucketName: process.env.ARCHIVE_COLLECTION_NAME });

const gridFsStorage = new GridFsStorage({
    db: mongodb.connection.db,
    file: (request, file) => {
        return {
            filename: file.originalname,
            bucketName: process.env.ARCHIVE_COLLECTION_NAME,
        };
    },
});

resolveInitialization({});

export default { connection: mongodb.connection, gridFs: { bucket: gridFsBucket, storage: gridFsStorage }, initialized };
