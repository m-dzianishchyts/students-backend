import mongoose from "mongoose";

import Queue from "./queue.js";
import { connection } from "../services/database.service.js";
import { ResourceNotFoundError } from "../util/errors.js";

export interface IUser extends mongoose.Document {
    name: { first: string; last: string };
    email: string;
    password: Buffer;
    createdAt: Date;
    updatedAt: Date;
}

export interface IUserModel extends mongoose.Model<IUser> {
    // Static methods:
    findInQueue: (queueId: string) => Promise<IUser[]>;
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
    }
);

export const userSchema = new mongoose.Schema<IUser>(
    {
        name: userNameSchema,
        email: {
            type: String,
            required: true,
        },
        password: {
            type: Buffer,
            required: true,
        },
    },
    {
        timestamps: true,
        versionKey: false,
    }
);

userSchema.statics.findInQueue = async function (queueId: string): Promise<IUser[]> {
    const queue = await Queue.findById(queueId).exec();
    if (queue === null) {
        throw new ResourceNotFoundError("Queue was not found");
    }

    const queueMembersIds = queue.members.map((member) => member.userId);
    const filter = { _id: { $in: queueMembersIds } };
    const usersFreeOrder = await User.find(filter).exec();
    const idUserMap = new Map(usersFreeOrder.map((user) => [user.id, user]));
    const users = queueMembersIds.map((id) => idUserMap.get(id.toString()));
    return users;
};

const User = connection.model<IUser, IUserModel>("User", userSchema);

export default User;
