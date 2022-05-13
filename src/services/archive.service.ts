import multer from "multer";
import mongoose from "mongoose";
import { RequestHandler, NextFunction } from "express";
import { MulterError } from "multer";
import { StatusCodes } from "http-status-codes";

import database from "./database.service.js";
import File from "../models/file.js";
import { ResourceNotFoundError, ServerError, UserCausedError } from "../util/errors.js";

const filesUploadLimit = 10;
const upload = multer({ storage: database.gridFs.storage }).array("files", filesUploadLimit);

/*
 * GET /files
 */
const show: RequestHandler = async (request, response, next) => {
    try {
        const files = await File.find({}).sort({ uploadDate: -1 }).exec();
        response.json(files);
    } catch (error) {
        next(error);
    }
};

/*
 * GET /files/:fileId
 */
const downloadFile: RequestHandler = async (request, response, next) => {
    try {
        const id = request.params.id;
        const file = await File.findById(id).exec();
        if (file === null) {
            next(new ResourceNotFoundError("File was not found"));
        }

        const readStream = await file.openDownloadStream();
        readStream.pipe(response);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /files
 */
const uploadFiles: RequestHandler = (request, response, next) =>
    upload(request, response, ((error: any) => {
        if (error instanceof MulterError) {
            next(new LimitError(`Files limit: ${filesUploadLimit}`));
        } else if (error) {
            next(new ServerError(error.message));
        } else {
            next();
        }
    }) as NextFunction);

/*
 * POST /files
 */
const postUpload: RequestHandler = (request, response, next) => {
    if (!request.files || !(request.files instanceof Array)) {
        next(new UserCausedError("Invalid files"));
    } else if (request.files.length === 0) {
        response.status(StatusCodes.NO_CONTENT).end();
    } else {
        response.status(StatusCodes.CREATED).end();
    }
};

/*
 * DELETE /files/:fileId
 */
const deleteFile: RequestHandler = async (request, response, next) => {
    try {
        const id = request.params.id;
        await File.findByIdAndProperDelete(id);
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        response.status(StatusCodes.INTERNAL_SERVER_ERROR);
        next(error);
    }
};

class LimitError extends UserCausedError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.REQUEST_TOO_LONG;
    }
}

export default {
    show,
    downloadFile,
    uploadFiles,
    postUpload,
    deleteFile,
};
