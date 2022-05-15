import dotenv from "dotenv";

const config = [
    // .env
    "PORT",
    "MONGODB_ADDRESS",
    "MONGODB_NAME",
    "SOCIALS_COLLECTION_NAME",
    "USERS_COLLECTION_NAME",
    "QUEUES_COLLECTION_NAME",
    "ARCHIVE_COLLECTION_NAME",
    "JWT_EXPIRE",

    // .private.env
    "MONGODB_USERNAME",
    "MONGODB_PASSWORD",
    "JWT_SECRET_KEY",
];

let resolveConfigLoading: (value: void) => void;
const loadedConfig = new Promise<void>((resolve, error) => {
    resolveConfigLoading = resolve;
});

let alreadyLoading = false;

async function load() : Promise<void> {
    if (alreadyLoading) {
        return loadedConfig;
    }
    alreadyLoading = true;

    console.log("Loading configuration...");
    dotenv.config();
    dotenv.config({ path: "./.private.env" });
    config.forEach((property) => {
        const value = process.env[property];
        if (value === undefined) {
            throw Error(`${property} is undefined`);
        }
    });
    resolveConfigLoading();
}

export default {
    load,
};
