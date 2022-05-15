import { GridFSBucketReadStream, MongoRuntimeError, ObjectId } from "mongodb";
import mongoose from "mongoose";

import { connection, gridFs } from "../services/database.service.js";
import { UserCausedError } from "../util/errors.js";

const fileTypePatternMap = new Map([
    ["image", /image/],
    ["video", /video/],
    ["audio", /audio\//],
    ["word", /(?:(?:ms-?)word)|(?:word(?:processing))/],
    ["excel", /excel/],
    ["openoffice", /open(?:office|doc)/],
    ["pdf", /pdf/],
    ["archive", /rar|[/b]zip|compress/],
    ["general", /.*/],
]);

export interface IFile extends mongoose.Document {
    filename: string;
    contentType: string;
    length: number;
    chunkSize: number;
    uploadDate: Date;

    // Instance methods:
    openDownloadStream: () => Promise<GridFSBucketReadStream>;
    fileType: () => string;
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
    },
    {
        collection: "archive.files",
        timestamps: { updatedAt: "uploadDate" },
        versionKey: false,
    }
);

fileSchema.methods.openDownloadStream = async function (): Promise<GridFSBucketReadStream> {
    const downloadStream = gridFs.bucket.openDownloadStream(new ObjectId(this._id));
    return downloadStream;
};

fileSchema.methods.fileType = function (): string {
    const generalType = Array.from(fileTypePatternMap.keys()).find((fileType) => fileTypePatternMap.get(fileType).test(this.contentType));
    return generalType ?? "general";
};

fileSchema.statics.findByIdAndProperDelete = async function (id: string): Promise<void> {
    if (!ObjectId.isValid(id)) {
        throw new UserCausedError("Invalid id");
    }

    try {
        await gridFs.bucket.delete(new ObjectId(id));
    } catch (error) {
        if (!(error instanceof MongoRuntimeError)) {
            throw error;
        }
    }
};

const File = connection.model<IFile, IFileModel>("File", fileSchema);

export default File;
