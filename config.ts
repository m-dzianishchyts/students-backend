import dotenv from "dotenv";

const config = [
    // .env
    "PORT",
    "MONGODB_ADDRESS",
    "MONGODB_NAME",

    // .private.env
    "MONGODB_USERNAME",
    "MONGODB_PASSWORD",

    // .env
    "SOCIALS_COLLECTION_NAME",
    "USERS_COLLECTION_NAME",
    "QUEUES_COLLECTION_NAME",
    "ARCHIVE_COLLECTION_NAME"
];

function load() {
    dotenv.config();
    dotenv.config({ path: "./.private.env" });
    
    console.log("Checking configuration...");
    config.forEach(property => {
        const value = process.env[property];
        if (value === undefined) {
            throw Error(`${property} is undefined`);
        }
    });
}

export default {
    load
}