import { CookieOptions, Request, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { MongoError, ObjectId } from "mongodb";
import { body } from "express-validator";
import * as jwtDecode from "jwt-decode";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import ms from "ms";
import dayjs from "dayjs";

import config from "../../config.js";
import GroupModel from "../models/group.js";
import QueueModel from "../models/queue.js";
import UserModel, { UserInitial } from "../models/user.js";
import { AuthenticationError, DuplicateError, ForbiddenError, ResourceNotFoundError, ServerError } from "../util/errors.js";
import { MongoErrorCode } from "./database.service.js";

await config.load();

const secretKey: jwt.Secret = Buffer.from(process.env.JWT_SECRET_KEY, "utf-8");
const jwtExpire = process.env.JWT_EXPIRE;

export const tokenCookieName = "token";
export const tokenCookieOptions: CookieOptions = {
    path: "/",
    signed: true,
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    sameSite: "strict",
    expires: dayjs().add(ms(jwtExpire), "ms").toDate(),
};

/*
 * POST /api/authenticate
 */
const authenticate: RequestHandler = async (request, response, next) => {
    try {
        const email = request.body.email;
        const password = request.body.password;
        const user = await UserModel.findOne({ email: email }).select("email password").exec();
        if (user === null) {
            next(new AuthenticationError("Authentication failed. User not found.", "email"));
        }

        const passwordsMatch = await bcrypt.compare(password, user.password.toString("utf-8"));
        if (!passwordsMatch) {
            next(new AuthenticationError("Authentication failed. Wrong password.", "password"));
        }

        const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: jwtExpire });
        response.cookie(tokenCookieName, token, tokenCookieOptions);
        response.status(StatusCodes.OK).end();
    } catch (error) {
        next(error);
    }
};

/*
 * POST /api/logout
 */
const logout: RequestHandler = async (request, response, next) => {
    try {
        response.clearCookie(tokenCookieName, { ...tokenCookieOptions, expires: new Date(1) });
        response.status(StatusCodes.OK).end();
    } catch (error) {
        next(error);
    }
};

/*
 * POST /api/register
 */
const register: RequestHandler = async (request, response, next) => {
    try {
        const userInfo = <UserInitial>{
            email: request.body.email,
            name: {
                first: request.body.firstName,
                last: request.body.lastName,
            },
            password: request.body.password,
        };
        const user = await UserModel.createFromInitial(userInfo);
        const userObject = user.toObject();
        delete userObject.password;

        const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: jwtExpire });
        response.cookie(tokenCookieName, token, tokenCookieOptions);
        response.status(StatusCodes.OK).json(userObject);
    } catch (error) {
        if (error instanceof MongoError && error.code === MongoErrorCode.DuplicateKey) {
            next(new DuplicateError("Registration failed. A user with this email exists."));
        } else {
            next(error);
        }
    }
};

const authGuard: RequestHandler = (request, response, next) => {
    try {
        const clientId = identify(request);
        if (!clientId) {
            next(new AuthenticationError("Authenticate first."));
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};

const membershipGuard: RequestHandler = async (request, _response, next) => {
    try {
        const groupId = request.params["groupId"];
        const clientId = identify(request);

        const group = await GroupModel.findById(groupId).lean().exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        const groupMembers = group.members.map(objectId => objectId.toString());
        if (!groupMembers.includes(clientId)) {
            next(new ForbiddenError("You are not a member of this group."));
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};

const membershipFromQueueGuard: RequestHandler = async (request, _response, next) => {
    try {
        const queueId = request.params["queueId"];
        const clientId = identify(request);

        const queueFilter = { _id: new ObjectId(queueId) };
        const queueExists = await QueueModel.exists(queueFilter).lean().exec();
        if (!queueExists) {
            next(new ResourceNotFoundError("Queue was not found."));
            return;
        }

        const groupFilter = { queues: { $eq: new ObjectId(queueId) } };
        const group = await GroupModel.findOne(groupFilter).lean().exec();
        if (!group) {
            next(new ServerError("Queue does not belong to any group."));
        }

        const groupMembers = group.members.map(objectId => objectId.toString());
        if (!groupMembers.includes(clientId)) {
            next(new ForbiddenError("You are not a member of related group."));
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};

const creatorshipGuard: RequestHandler = async (request, _response, next) => {
    try {
        const groupId = request.params["groupId"];
        const clientId = identify(request);

        const group = await GroupModel.findById(groupId).lean().exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
        }

        if (!group.creator.equals(clientId)) {
            next(new ForbiddenError("Your are not a creator of this group."));
            return;
        }
        next();
    } catch (error) {
        next(error);
    }
};

const creatorshipFromQueueGuard: RequestHandler = async (request, _response, next) => {
    try {
        const queueId = request.params["queueId"];
        const clientId = identify(request);

        const groupFilter = { queues: { $eq: new ObjectId(queueId) } };
        const group = await GroupModel.findOne(groupFilter).lean().exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
        }

        if (group.creator.equals(clientId)) {
            next();
        } else {
            next(new ForbiddenError("Your are not a creator of this queue group."));
        }
    } catch (error) {
        next(error);
    }
};

const creatorshipFromQueueOrPersonnelGuard: RequestHandler = async (request, _response, next) => {
    try {
        const queueId = request.params["queueId"];
        const userId = request.params["userId"];
        const clientId = identify(request);

        if (clientId === userId) {

            // Authorized route
            next();
        } else {
            const groupFilter = { queues: { $eq: new ObjectId(queueId) } };
            const group = await GroupModel.findOne(groupFilter).lean().exec();
            if (!group) {
                next(new ResourceNotFoundError("Group was not found."));
            }

            if (group.creator.equals(clientId)) {

                // Group creator route
                next();
            } else {

                // Unauthorized route
                next(new ForbiddenError("Personnel data."));
            }
        }
    } catch (error) {
        next(error);
    }
};

export function identify(request: Request): string | null {
    const token = request.signedCookies?.token;
    const payload = token ? jwtDecode.default(token) : null;
    const clientId = payload?.["id"];
    return clientId;
}

export default {
    authenticate: [
        body("email").isEmail().normalizeEmail(),
        body("password").isStrongPassword({ minLength: 6 }),
        authenticate,
    ],
    logout,
    register: [
        body("email").isEmail().normalizeEmail(),
        body("password").isStrongPassword({ minLength: 6 }),
        body("firstName").trim().isLength({ min: 1, max: 128 }),
        body("lastName").trim().isLength({ min: 1, max: 256 }),
        register,
    ],
    authGuard,
    membershipGuard: [authGuard, membershipGuard],
    membershipFromQueueGuard: [authGuard, membershipFromQueueGuard],
    creatorshipGuard: [authGuard, creatorshipGuard],
    creatorshipFromQueueGuard: [authGuard, creatorshipFromQueueGuard],
    creatorshipFromQueueOrPersonnelGuard: [authGuard, creatorshipFromQueueOrPersonnelGuard],
};
