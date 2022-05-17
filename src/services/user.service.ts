import mongoose from "mongoose";
import { RequestHandler } from "express";
import * as jwtDecode from "jwt-decode";

import User from "../models/user.js";
import { UserCausedError } from "../util/errors.js";
import { tokenCookieName } from "./authentication.service.js";

// GET /api/users/in-queue/:queueId
const findInQueue: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params.queueId;
        const users = await User.findInQueue(queueId);
        response.json(users);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

// GET /api/users/token
const findByToken: RequestHandler = async (request, response, next) => {
    try {
        const token = request.signedCookies[tokenCookieName];
        const payload = jwtDecode.default(token);
        const userId = payload["id"];
        const user = await User.findById(userId).exec();

        const userObject = user.toObject();
        delete userObject.password;
        response.json(userObject);
    } catch (error) {
        if (error instanceof jwtDecode.InvalidTokenError) {
            next(new UserCausedError(`Invalid token: ${error.message}`));
        } else if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

export default {
    findInQueue,
    findByToken,
};
