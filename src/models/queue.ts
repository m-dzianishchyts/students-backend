import { ObjectId } from "mongodb";
import mongoose from "mongoose";

import UserModel, { UserPojo } from "./user.js";
import GroupModel, { Group } from "./group.js";
import { connection } from "../services/database.service.js";
import { ResourceNotFoundError, ServerError, WriteResultNotAcknowledgedError } from "../util/errors.js";

export interface Queue extends mongoose.Document {
    name: string;
    members: QueueMember[];

    // Instance methods:
    showUsers: () => Promise<(UserPojo & { status: boolean })[]>;
    showGroup: () => Promise<Group>;
    addMember: (id: string) => Promise<QueueMember>;
    deleteMember: (id: string) => Promise<void>;
    updateMembers: (members: QueueMember[]) => Promise<void>;
    updateMemberStatus: (id: string, status: boolean) => Promise<void>;
    updateName: (name: string) => Promise<void>;
}

export interface QueueMember {
    userId: ObjectId;
    status: boolean;
}

const memberSchema = new mongoose.Schema<QueueMember>(
    {
        userId: {
            type: ObjectId,
            required: true,
        },
        status: {
            type: Boolean,
            required: true,
            default: false,
        },
    },
    {
        _id: false,
        versionKey: false,
    },
);

const queueSchema = new mongoose.Schema<Queue>(
    {
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
                validator: (members: QueueMember[]) => {
                    return members.length <= 100;
                },
                message: (props) => `${props.value} exceeds maximum size (100), actual: ${props.value.length}`,
            },
        },
    },
    {
        versionKey: false,
    },
);

queueSchema.set("toObject", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });
queueSchema.set("toJSON", { virtuals: true, transform: (_doc, ret) => ret._id = undefined });

queueSchema.methods.updateName = async function (name: string): Promise<void> {
    const filter = { _id: this._id };
    const update = { $set: { name: name } };
    const result = await QueueModel.updateOne(filter, update).exec();
    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

queueSchema.methods.showUsers = async function (): Promise<(UserPojo & { status: boolean })[]> {
    const queue = await QueueModel.findById(this._id).select("members").lean().exec();
    if (!queue) {
        throw new ResourceNotFoundError("Queue was not found");
    }

    const queueMembersIds = queue.members.map((member) => member.userId);
    const memberStatusMap = new Map(queue.members.map((member) => [member.userId.toString(), member.status]));
    const userFilter = { _id: { $in: queueMembersIds } };
    const usersFreeOrder = await UserModel.find(userFilter).select("-password").exec();
    const idUserMap = new Map(usersFreeOrder.map((user) => [user.id, user]));
    const users = queueMembersIds.map((id) => {
        const userInfo = idUserMap.get(id.toString());
        const userStatus = memberStatusMap.get(id.toString());
        return {
            ...(userInfo.toObject() as UserPojo),
            status: userStatus,
        };
    });
    return users;
};

queueSchema.methods.showGroup = async function (): Promise<Group> {
    const queue = await QueueModel.findById(this._id).lean().exec();
    const groupFilter = { queues: { $eq: queue._id } };
    const group = await GroupModel.findOne(groupFilter).exec();
    if (!group) {
        throw new ServerError("Queue does not belong to any group");
    }

    return group;
};

queueSchema.methods.addMember = async function (id: string): Promise<QueueMember> {
    const user = await UserModel.findById(id).exec();
    if (user === null) {
        throw new ResourceNotFoundError("User was not found");
    }

    const newQueueMember = <QueueMember>{ userId: user.id, status: false };
    const queueFilter = { _id: this._id, "members.userId": { $ne: newQueueMember.userId } };
    const queueUpdate = { $push: { members: newQueueMember } };
    const result = await QueueModel.updateOne(queueFilter, queueUpdate).exec();

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
    const result = await QueueModel.updateOne(queueFilter, queueUpdate).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

queueSchema.methods.updateMembers = async function (members: QueueMember[]): Promise<void> {
    const filter = { _id: this._id };
    const update = { $set: { members: members } };
    const result = await QueueModel.updateOne(filter, update).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
};

queueSchema.methods.updateMemberStatus = async function (id: string, status: boolean): Promise<void> {
    const filter = { _id: this._id, "members.userId": id };
    const update = { $set: { "members.$.status": status } };
    const result = await QueueModel.updateOne(filter, update).exec();

    if (!result.acknowledged) {
        throw new WriteResultNotAcknowledgedError();
    }
    if (result.matchedCount === 0) {
        throw new ResourceNotFoundError("Member was not found in the queue");
    }
};

const QueueModel = connection.model<Queue>("Queue", queueSchema);

export default QueueModel;
