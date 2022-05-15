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
        response.status(error.statusCode).json(error.jsonFriendly());
    } else {
        response.status(StatusCodes.INTERNAL_SERVER_ERROR);
        if (error instanceof Error) {
            response.json({
                error: {
                    code: response.statusCode,
                    name: error.constructor.name,
                    message: error.message,
                },
            });
        } else {
            response.json({ error: { code: response.statusCode, error: error } });
        }
    }
};

export default {
    unknownRequest,
    handleError,
};
