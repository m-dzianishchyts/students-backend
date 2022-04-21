import dotenv from "dotenv";

dotenv.config();
dotenv.config({path: "./.private.env"});

export let config = {
	port: process.env.PORT,
	mongodbAddress: process.env.MONGODB_ADDRESS,
	mongodbName: process.env.MONGODB_NAME,
	mongodbUser: process.env.MONGODB_USERNAME,
	mongodbPassword: process.env.MONGODB_PASSWORD,
}