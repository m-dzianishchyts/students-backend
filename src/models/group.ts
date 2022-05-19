import { ObjectId } from "mongodb";
import mongoose from "mongoose";

import UserModel, { User } from "./user.js";
import QueueModel, { Queue } from "./queue.js";
import { connection } from "../services/database.service.js";
import { ResourceNotFoundError, UserCausedError, WriteResultNotAcknowledgedError } from "../util/errors.js";

export interface Group extends mongoose.Document {
    name: string;
    creator: ObjectId;
    members: ObjectId[];
    queues: ObjectId[];
    createdAt: Date;

    // Instance methods:
    showUsers: () => Promise<User[]>;
    showQueues: () => Promise<Queue[]>;
    updateName: (name: string) => Promise<void>;
    addMember: (userId: string | ObjectId) => Promise<void>;
    deleteMember: (userId: string) => Promise<void>;
    createQueue: (name: string) => Promise<Queue>;
    deleteQueue: (id: string) => Promise<void>;
}

export interface GroupInitial {
    name: string,
    creator: string | ObjectId
}

interface GroupModelRaw extends mongoose.Model<Group> {
    // Static methods:
    createFromInitial: (initial: GroupInitial) => Promise<User>;
    deleteById: (id: string) => Promise<void>;
}

const groupSchema = new mongoose.Schema<Group>(
    {
        name: {
            type: "string",
            required: true,
            maxLength: 255,
        },
        creator: {
            type: ObjectId,
            required: true,
            ref: "User",
        },
        members: {
            type: [{
                type: ObjectId,
                ref: "User",
            }],
            required: true,
            validate: {
                validator: (members: ObjectId[]) => {
                    return members.length <= 100;
                },
                message: (props) => `${props.value} exceeds maximum size (100), actual: ${props.value.length}`,
            },
            default: [],
        },
        queues: {
            type: [{
                type: ObjectId,
                ref: "Queue",
            }],
            required: true,
            validate: {
                validator: (queues: ObjectId[]) => {
                    return queues.length <= 20;
                },
                message: (props) => `${props.value} exceeds maximum size (100), actual: ${props.value.length}`,
            },
            default: [],
        },
    }, {
        versionKey: false,
        timestamps: { createdAt: true, updatedAt: false },
    });

groupSchema.set("toObject", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });
groupSchema.set("toJSON", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });

groupSchema.methods.showUsers = async function (): Promise<User[]> {
    const filter = { _id: this._id };
    const group = await GroupModel.findOne(filter).select("members").lean().exec();

    const userFilter = { _id: { $in: group.members } };
    const users = await UserModel.find(userFilter).select("-password").exec();
    return users;
};

groupSchema.methods.showQueues = async function (): Promise<Queue[]> {
    const filter = { _id: this._id };
    const group = await GroupModel.findOne(filter).select("queues").lean().exec();

    const queueFilter = { _id: { $in: group.queues } };
    const queues = await QueueModel.find(queueFilter).exec();
    return queues;
};

groupSchema.methods.updateName = async function (name: string): Promise<void> {
    const filter = { _id: this._id };
    const update = { $set: { name: name } };
    const result = await GroupModel.updateOne(filter, update).exec();
    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

groupSchema.methods.addMember = async function (userId: string | ObjectId): Promise<void> {
    const userObjectId = new ObjectId(userId);
    const userFilter = { _id: userObjectId };
    const userExists = await UserModel.exists(userFilter).exec();
    if (!userExists) {
        throw new ResourceNotFoundError("User was not found");
    }

    const session = await connection.startSession();
    try {
        session.startTransaction();
        const userUpdate = { $push: { groups: this._id } };
        const userResult = await UserModel.updateOne(userFilter, userUpdate).exec();
        if (!userResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const groupFilter = { _id: this._id };
        const groupUpdate = { $push: { members: userObjectId } };
        const groupResult = await GroupModel.updateOne(groupFilter, groupUpdate).exec();
        if (!groupResult.acknowledged) {
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

groupSchema.methods.deleteMember = async function (userId: string): Promise<void> {
    const userObjectId = new ObjectId(userId);

    const session = await connection.startSession();
    try {
        session.startTransaction();
        const groupFilter = { _id: this._id };
        const groupUpdate = { $pull: { members: userObjectId } };
        const groupResult = await GroupModel.updateOne(groupFilter, groupUpdate).exec();
        if (!groupResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const userFilter = { _id: userObjectId };
        const userUpdate = { $pull: { groups: this._id } };
        const userResult = await UserModel.updateOne(userFilter, userUpdate).exec();
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

groupSchema.methods.createQueue = async function (name: string): Promise<Queue> {
    const queueInfo = { name: name };
    const session = await connection.startSession();
    try {
        session.startTransaction();
        const newQueue = await QueueModel.create(queueInfo);

        const groupFilter = { _id: this._id };
        const groupUpdate = { $push: { queues: newQueue._id } };
        const result = await GroupModel.updateOne(groupFilter, groupUpdate).exec();
        if (!result.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        await session.commitTransaction();
        return newQueue;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

groupSchema.methods.deleteQueue = async function (queueId: string): Promise<void> {
    const queueObjectId = new ObjectId(queueId);
    const queueExistsFilter = { _id: this._id, queues: { $eq: queueObjectId } };
    const queueExistsInGroup = await GroupModel.exists(queueExistsFilter).exec();
    if (!queueExistsInGroup) {
        throw new UserCausedError("Queue was not found in group.");
    }

    const session = await connection.startSession();
    try {
        session.startTransaction();
        const groupFilter = { _id: this._id };
        const groupUpdate = { $pull: { queues: queueObjectId } };
        const updateResult = await GroupModel.updateOne(groupFilter, groupUpdate).exec();
        if (!updateResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const queueFilter = { _id: queueObjectId };
        const deleteResult = await QueueModel.deleteOne(queueFilter).exec();
        if (!deleteResult.acknowledged) {
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

groupSchema.statics.createFromInitial = async (initial: GroupInitial): Promise<Group> => {
    initial.creator = new ObjectId(initial.creator);
    const userFilter = { _id: initial.creator };
    const creatorExists = await UserModel.exists(userFilter).exec();
    if (!creatorExists) {
        throw new ResourceNotFoundError("User was not found.");
    }

    const session = await connection.startSession();
    try {
        session.startTransaction();
        const group = await GroupModel.create(initial);
        await group.addMember(group.creator);
        return group;
    } catch (error) {
        await session.abortTransaction();
        throw error;
    } finally {
        await session.endSession();
    }
};

groupSchema.statics.deleteById = async (id: string): Promise<void> => {
    const groupObjectId = new ObjectId(id);
    const session = await connection.startSession();
    try {
        session.startTransaction();
        const groupFilter = { _id: groupObjectId };
        const groupResult = await GroupModel.deleteOne(groupFilter).exec();
        if (!groupResult.acknowledged) {
            throw new WriteResultNotAcknowledgedError();
        }

        const userFilter = {};
        const userUpdate = { $pull: { groups: groupObjectId } };
        const userResult = await UserModel.updateMany(userFilter, userUpdate).exec();
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

const GroupModel = connection.model<Group, GroupModelRaw>("Group", groupSchema);

export default GroupModel;
