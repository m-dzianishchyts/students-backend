import mongodb from "mongodb";
import Grid from "gridfs-stream";

import { inspect } from "util";
import { GridFsStorage } from "multer-gridfs-storage";

import { } from "../config.js";

const mongodbUri = "mongodb://"
    + `${process.env.MONGODB_USERNAME}:`
    + `${process.env.MONGODB_PASSWORD}@`
    + `${process.env.MONGODB_ADDRESS}/`
    + `${process.env.MONGODB_NAME}`
    + "?authMechanism=DEFAULT";

const mongoClient = await connect();
console.log(`Connected to MongoDB: ${mongoClient.options.hosts}`);
const db = mongoClient.db();

const gridFsBucket = new mongodb.GridFSBucket(db, { bucketName: "archive" });
// const gridFs = Grid(db, mongodb);
// gridFs.collection("archive");

const storage = new GridFsStorage({
    db: db,
    client: mongoClient,
    file: (request, file) => {
        return {
            filename: file.originalname,
            bucketName: "archive"
        }
    }
});

async function connect() {
    try {
        const mongoClient = await mongodb.MongoClient.connect(mongodbUri);
        await mongoClient.db().admin().command({ ping: 1 });
        return mongoClient;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function findSocials() {
    try {
        const socialsCollection = db.collection("socials");
        const filter = {};

        const socials = await socialsCollection.find(filter).toArray();
        return socials;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function findQueue(queueId) {
    try {
        const queuesCollection = db.collection("queues");
        const filter = { _id: mongodb.ObjectId(queueId) };

        const queue = await queuesCollection.findOne(filter);
        return queue;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function updateQueueName(queueId, name) {
    try {
        const queuesCollection = db.collection("queues");
        const filter = { _id: mongodb.ObjectId(queueId) };
        const update = { $set: { name: name } };

        const queue = await queuesCollection.updateOne(filter, update);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function updateQueueMemberStatus(queueId, memberId, status) {
    try {
        const queuesCollection = db.collection("queues");
        const filter = { _id: mongodb.ObjectId(queueId), "members.userId": mongodb.ObjectId(memberId) };
        const update = { $set: { "members.$.status": status } };

        const result = await queuesCollection.updateOne(filter, update);
        if (!result.acknowledged) {
            return Promise.reject(new Error(`Request failed: ${inspect({ filter, update, result })}`))
        }
    } catch (error) {
        return Promise.reject(error);
    }
}

async function updateQueueMembers(queueId, members) {
    try {
        const queuesCollection = db.collection("queues");
        const filter = { _id: mongodb.ObjectId(queueId) };
        const update = { $set: { members: members } };

        await queuesCollection.updateOne(filter, update);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function findQueueWithUsers(queueId) {
    try {
        const usersCollection = db.collection("users");

        const queue = await findQueue(queueId);
        const queueMembersIdMap = new Map(queue.members.map(member => [member.userId.toString(), member.status]));
        const queueMembersIds = Array.from(queueMembersIdMap.keys()).map(id => mongodb.ObjectId(id));

        const filter = { _id: { $in: queueMembersIds } };
        const usersFromQueue = await usersCollection.find(filter).toArray();
        const usersFromQueueIdMap = new Map(usersFromQueue.map(user => [user._id.toString(), user]))
        const queueMembers = queueMembersIds.map(id => {
            const idString = id.toString();
            const member = Object.assign({}, usersFromQueueIdMap.get(idString));
            member.status = queueMembersIdMap.get(idString);
            return member;
        });
        queue.members = queueMembers;
        return queue;
    } catch (error) {
        return Promise.reject(error);
    }
}

async function insertNewUserInQueue(queueId, userName) {
    try {
        const usersCollection = db.collection("users");
        const queuesCollection = db.collection("queues");

        const usersAmount = await usersCollection.countDocuments();
        const now = Date.now();
        const newUser = {
            _id: mongodb.ObjectId(),
            groupIndex: usersAmount + 1,
            name: userName,
            datetimeAdded: now,
            datetimeUpdated: now
        };
        await usersCollection.insertOne(newUser);

        const newQueueMember = {
            userId: newUser._id,
            status: false
        };
        const queueFilter = { _id: mongodb.ObjectId(queueId) };
        const queueUpdate = { $push: { members: newQueueMember } };
        await queuesCollection.updateOne(queueFilter, queueUpdate);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function deleteUserFromQueue(queueId, userId) {
    try {
        const usersCollection = db.collection("users");
        const queuesCollection = db.collection("queues");

        const queueFilter = { _id: mongodb.ObjectId(queueId) };
        const queueUpdate = { $pull: { members: { userId: mongodb.ObjectId(userId) } } }
        await queuesCollection.updateOne(queueFilter, queueUpdate);

        const userFilter = { _id: mongodb.ObjectId(userId) };
        await usersCollection.deleteOne(userFilter);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function findAllFiles() {
    const files = await gridFsBucket.find({}).sort({ uploadDate: -1 }).toArray();
    return files;
}

async function findFile(id) {
    const file = await gridFsBucket.find({ _id: mongodb.ObjectId(id) }).next();
    return file;
}

function openDownloadStream(id) {
    const downloadStream = gridFsBucket.openDownloadStream(mongodb.ObjectId(id));
    return downloadStream;
}

async function deleteFile(id) {
    await gridFsBucket.delete(mongodb.ObjectId(id));
}

export default {
    native: mongodb,
    db: db,
    client: mongoClient,
    socials: {
        findAll: findSocials
    },
    queue: {
        findById: findQueue,
        findWithUsers: findQueueWithUsers,
        updateName: updateQueueName,
        updateMemberStatus: updateQueueMemberStatus,
        updateMembers: updateQueueMembers,
        insertNewUser: insertNewUserInQueue,
        deleteUser: deleteUserFromQueue
    },
    fs: {
        storage,
        findAllFiles,
        findFile,
        openDownloadStream,
        deleteFile
    }
}