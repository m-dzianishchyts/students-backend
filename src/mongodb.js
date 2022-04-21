import { MongoClient, ObjectId } from "mongodb";

import { config } from "../config.js";

const mongodbUri = "mongodb://"
	+ `${config.mongodbUser}:`
	+ `${config.mongodbPassword}@`
	+ `${config.mongodbAddress}/`
	+ "?authMechanism=DEFAULT"
	+ `&authSource=${config.mongodbName}`;

async function connect() {
	try {
		let mongoClient = new MongoClient(mongodbUri);
		await mongoClient.connect();
		await mongoClient.db().admin().command({ ping: 1 });
		return mongoClient;
	} catch (error) {
		console.error(error);
	}
}

async function findSocials(mongoClient) {
	try {
		let socialsCollection = mongoClient.db(config.mongodbName).collection("socials");
		let socials = socialsCollection.find({}).toArray();
		return socials;
	} catch (error) {
		console.error(error);
	}
}

async function findQueueMembers(mongoClient) {
	try {
		let queuesCollection = mongoClient.db(config.mongodbName).collection("queues");
		let usersCollection = mongoClient.db(config.mongodbName).collection("users");

		let queue = await queuesCollection.findOne({ name: "test" });
		let queueMembersMap = new Map(queue.members.map(member => [member.userId, member.status]));
		let queueMembersIds = Array.from(queueMembersMap.keys()).map(id => new ObjectId(id));
		let usersFromQueue = await usersCollection.find({ _id: { $in: queueMembersIds } }).toArray();
		let queueMembers = usersFromQueue.map(user => {
			let member = Object.assign({}, user);
			member.status = queueMembersMap.get(user._id.toString());
			return member;
		});
		return queueMembers;
	} catch (error) {
		console.error(error);
	}
}

export {
	connect,
	findSocials,
	findQueueMembers
};