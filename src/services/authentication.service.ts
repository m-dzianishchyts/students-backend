import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import ms from "ms";
import dayjs from "dayjs";
import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { MongoError } from "mongodb";

import config from "../../config.js";
import User from "../models/user.js";
import { AuthenticationError, DuplicateError } from "../util/errors.js";
import { MongoErrorCode } from "./database.service.js";

await config.load();

const secretKey: jwt.Secret = Buffer.from(process.env.JWT_SECRET_KEY, "utf-8");
const jwtExpire = process.env.JWT_EXPIRE;

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
        response.status(StatusCodes.OK);
        response.cookie("token", token, {
            signed: true,
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            expires: dayjs().add(ms(jwtExpire), "ms").toDate(),
        });
        response.end();
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
            name: request.body.name,
            password: request.body.password,
        };
        const user = await User.create(userInfo);
        const token = jwt.sign({ id: user.id }, secretKey, { expiresIn: jwtExpire });

        const userObject = user.toObject();
        userObject.password = null;
        response.status(StatusCodes.OK);
        response.cookie("token", token, {
            signed: true,
            secure: process.env.NODE_ENV === "production",
            httpOnly: true,
            sameSite: "strict",
            expires: dayjs().add(ms(jwtExpire), "ms").toDate(),
        });
        response.json(userObject);
    } catch (error) {
        if (error instanceof MongoError && error.code === MongoErrorCode.DuplicateKey) {
            next(new DuplicateError("Registration failed. A user with this email exists."));
        } else {
            next(error);
        }
    }
};

export default {
    register,
    authenticate,
};
