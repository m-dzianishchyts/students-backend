import mongoose from "mongoose";
import { RequestHandler } from "express";
import { param } from "express-validator";
import * as jwtDecode from "jwt-decode";

import UserModel from "../models/user.js";
import { ResourceNotFoundError, UserCausedError } from "../util/errors.js";
import { tokenCookieName } from "./authentication.service.js";

/*
* GET /api/users/:userId/groups
*/
const showGroups: RequestHandler = async (request, response, next) => {
    try {
        const userId = request.params[userIdParameter];
        const user = await UserModel.findById(userId).exec();
        if (!user) {
            next(new ResourceNotFoundError("User was not found."));
        }

        const groups = await user.showGroups();
        response.json(groups);
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
        const user = await UserModel.findById(userId).exec();

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

const userIdParameter = "userId";

export default {
    showGroups: [
        param(userIdParameter).isHexadecimal(),
        showGroups,
    ],
    findByToken,
};
