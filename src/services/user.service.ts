import mongoose from "mongoose";
import { RequestHandler } from "express";

import User from "../models/user.js";
import { UserCausedError } from "../util/errors.js";

// GET /api/users/?queueId=queueId
const findInQueue: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.query.queueId as string;
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

export default {
    findInQueue,
};
