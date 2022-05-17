import { CookieOptions, RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { MongoError } from "mongodb";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import ms from "ms";
import dayjs from "dayjs";

import config from "../../config.js";
import User from "../models/user.js";
import { AuthenticationError, DuplicateError } from "../util/errors.js";
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

const bcryptRounds = 7;

/*
 * POST /api/authenticate
 */
const authenticate: RequestHandler = async (request, response, next) => {
    try {
        const email = request.body.email;
        const password = request.body.password;
        const user = await User.findOne({ email: email }).select("email password").exec();
        if (user === null) {
            throw new AuthenticationError("Authentication failed. User not found.", "email");
        }

        const passwordsMatch = await bcrypt.compare(password, user.password.toString("utf-8"));
        if (!passwordsMatch) {
            throw new AuthenticationError("Authentication failed. Wrong password.", "password");
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
        const userInfo = {
            email: request.body.email,
            name: {
                first: request.body.firstName,
                last: request.body.lastName,
            },
            password: request.body.password,
        };
        userInfo.password = await bcrypt.hash(userInfo.password, bcryptRounds);
        console.log(userInfo);
        const user = await User.create(userInfo);
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

export default {
    authenticate,
    logout,
    register,
};
