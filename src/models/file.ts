import { GridFSBucketReadStream, MongoRuntimeError, ObjectId } from "mongodb";
import mongoose from "mongoose";

import database from "../services/database.service.js";
import { UserCausedError } from "../util/errors.js";

export interface IFile extends mongoose.Document {
    filename: string;
    contentType: string;
    length: number;
    chunkSize: number;
    uploadDate: Date;

    // Instance methods:
    openDownloadStream: () => Promise<GridFSBucketReadStream>;
}

export interface IFileModel extends mongoose.Model<IFile> {
    // Static methods:
    findByIdAndProperDelete: (id: string) => Promise<void>;
}

const fileSchema = new mongoose.Schema<IFile>(
    {
        filename: {
            type: String,
            required: true,
            length: 500,
            trim: true,
        },
        contentType: {
            type: String,
            required: true,
            maxlength: 255,
            trim: true,
        },
        length: {
            type: Number,
            required: true,
        },
        chunkSize: {
            type: Number,
            required: true,
        },
        uploadDate: {
            type: Date,
            required: true,
        },
    },
    {
        collection: "archive.files",
        timestamps: { updatedAt: "uploadDate" },
    }
);

fileSchema.methods.openDownloadStream = async function (): Promise<GridFSBucketReadStream> {
    const downloadStream = database.gridFs.bucket.openDownloadStream(new ObjectId(this._id));
    return downloadStream;
};

fileSchema.statics.findByIdAndProperDelete = async function (id: string): Promise<void> {
    if (!ObjectId.isValid(id)) {
        throw new UserCausedError("Invalid id");
    }

    try {
        await database.gridFs.bucket.delete(new ObjectId(id));
    } catch (error) {
        if (!(error instanceof MongoRuntimeError)) {
            throw error;
        }
    }
};

const File = database.connection.model<IFile, IFileModel>("File", fileSchema);

export default File;
