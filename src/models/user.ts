import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import bcrypt from "bcrypt";

import GroupModel, { Group } from "./group.js";
import Queue from "./queue.js";
import { connection } from "../services/database.service.js";
import { ResourceNotFoundError, WriteResultNotAcknowledgedError } from "../util/errors.js";

export interface UserPojo {
    name: { first: string; last: string };
    email: string;
    password: Buffer;
    groups: ObjectId[];
    createdAt: Date;
    updatedAt: Date;
}

export interface User extends mongoose.Document, UserPojo {

    // Instance methods:
    showGroups: () => Promise<Group[]>;
    deleteProperly: () => Promise<Group[]>;
}

export interface UserInitial {
    name: { first: string; last: string };
    email: string;
    password: string | Buffer;
}

export interface UserModelRaw extends mongoose.Model<User> {
    // Static methods:
    createFromInitial: (initial: UserInitial) => Promise<User>;
}

export const userNameSchema = new mongoose.Schema<{ first: string; last: string }>(
    {
        first: {
            type: String,
            required: true,
            maxlength: 255,
            trim: true,
        },
        last: {
            type: String,
            required: true,
            maxlength: 255,
            trim: true,
        },
    },
    {
        _id: false,
        versionKey: false,
    },
);

const userSchema = new mongoose.Schema<User>(
    {
        name: userNameSchema,
        email: {
            type: String,
            required: true,
            maxLength: 320,
            unique: true,
        },
        password: {
            type: Buffer,
            required: true,
        },
        groups: {
            type: [{
                type: ObjectId,
                ref: "Group",
            }],
            required: true,
            default: [],
        },
    },
    {
        timestamps: true,
        versionKey: false,
    },
);

userSchema.set("toObject", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });
userSchema.set("toJSON", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });

userSchema.methods.showGroups = async function (): Promise<Group[]> {
    const userFilter = { _id: this._id };
    const user = await UserModel.findOne(userFilter).select("groups").lean().exec();
    const groupsIds = user.groups;

    const groupFilter = { _id: { $in: groupsIds } };
    const groups = await GroupModel.find(groupFilter).exec();
    return groups;
};

userSchema.methods.deleteProperly = async function (): Promise<void> {
    const user = await UserModel.findById(this._id).exec();
    if (!user) {
        throw new ResourceNotFoundError("User was not found.");
    }

    const session = await connection.startSession();
    try {
        session.startTransaction();
        const queueFilter = { "members.userId": { $eq: this._id } };
        const queueUpdate = { $pull: { members: { userId: this._id } } };
        const queuesResult = await Queue.updateMany(queueFilter, queueUpdate).exec();
        if (!queuesResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const groupsIds = user.groups;
        const groupFilter = { $_id: { $in: groupsIds } };
        const groupUpdate = { $pull: { members: this._id } };
        const groupsResult = await GroupModel.updateMany(groupFilter, groupUpdate).exec();
        if (!groupsResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const userResult = user.deleteOne().exec();
        if (!userResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        await session.commitTransaction();
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

const bcryptRounds = 7;

userSchema.statics.createFromInitial = async function (initial: UserInitial): Promise<User> {
    initial.password = Buffer.from(await bcrypt.hash(initial.password, bcryptRounds), "utf-8");
    return UserModel.create(initial);
};

const UserModel = connection.model<User, UserModelRaw>("User", userSchema);

export default UserModel;
