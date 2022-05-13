import { ErrorRequestHandler, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";

import { ApplicationError, UserCausedError } from "../util/errors.js";

const unknownRequest: RequestHandler = (request, response, next) => {
    try {
        response.status(StatusCodes.METHOD_NOT_ALLOWED).end();
    } catch (error) {
        next(error);
    }
};

const handleError: ErrorRequestHandler = (error, request, response, next) => {
    if (!(error instanceof UserCausedError)) {
        console.error(error);
    }
    if (error instanceof ApplicationError) {
        response.status(error.statusCode).json({
            error: {
                code: error.statusCode,
                name: error.name,
                message: error.message,
            },
        });
    } else {
        response.status(response.statusCode || StatusCodes.INTERNAL_SERVER_ERROR).json({ error: error });
    }
};

export default {
    unknownRequest,
    handleError,
};
