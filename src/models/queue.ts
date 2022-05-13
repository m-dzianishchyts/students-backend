import { ObjectId } from "mongodb";
import mongoose from "mongoose";

import database from "../services/database.service.js";
import { ResourceNotFoundError, WriteResultNotAcknowledgedError } from "../util/errors.js";
import User from "./user.js";

export interface IQueue extends mongoose.Document {
    name: string;
    members: IQueueMember[];

    // Instance methods:
    insertMember: (id: string) => Promise<IQueueMember>;
    deleteMember: (id: string) => Promise<void>;
    updateMembers: (members: IQueueMember[]) => Promise<void>;
    updateMemberStatus: (id: string, status: boolean) => Promise<void>;
    updateName: (name: string) => Promise<void>;
}

export interface IQueueMember {
    userId: ObjectId;
    status: boolean;
}

const memberSchema = new mongoose.Schema<IQueueMember>(
    {
        userId: {
            type: ObjectId,
            required: true,
        },
        status: {
            type: Boolean,
            required: true,
            default: false
        },
    },
    { _id: false }
);

const Member = mongoose.model<IQueueMember>("Member", memberSchema);

const queueSchema = new mongoose.Schema<IQueue>({
    name: {
        type: String,
        required: true,
        maxlength: 255,
        trim: true,
    },
    members: {
        type: [memberSchema],
        required: true,
        validate: {
            validator: (members: IQueueMember[]) => {
                return members.length <= 100;
            },
            message: (props) => `${props.value} exceeds maximum size (100), actual: ${props.value.length}`,
        },
    },
});

queueSchema.methods.insertMember = async function (id: string): Promise<IQueueMember> {
    const user = await User.findById(id).exec();
    if (user === null) {
        throw new ResourceNotFoundError("User was not found");
    }

    const newQueueMember = new Member({ userId: user.id });
    const queueFilter = { _id: this._id, "members.userId": { $ne: newQueueMember.userId } };
    const queueUpdate = { $push: { members: newQueueMember } };
    const result = await Queue.updateOne(queueFilter, queueUpdate).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
    if (result.matchedCount === 0) {
        return null;
    }
    return newQueueMember;
};

queueSchema.methods.deleteMember = async function (id: string): Promise<void> {
    const queueFilter = { _id: this._id };
    const queueUpdate = { $pull: { members: { userId: id } } };
    const result = await Queue.updateOne(queueFilter, queueUpdate).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

queueSchema.methods.updateMembers = async function (members: IQueueMember[]): Promise<void> {
    const filter = { _id: this._id };
    const update = { $set: { members: members } };
    const result = await Queue.updateOne(filter, update).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

queueSchema.methods.updateMemberStatus = async function (id: string, status: boolean): Promise<void> {
    const filter = { _id: this._id, "members.userId": id };
    const update = { $set: { "members.$.status": status } };
    const result = await Queue.updateOne(filter, update).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
    if (result.matchedCount === 0) {
        throw new ResourceNotFoundError("Member was not found in the queue");
    }
};

queueSchema.methods.updateName = async function (name: string): Promise<void> {
    const filter = { _id: this._id };
    const update = { $set: { name: name } };

    await Queue.updateOne(filter, update).exec();
};

const Queue = database.connection.model<IQueue>("Queue", queueSchema);

export default Queue;
