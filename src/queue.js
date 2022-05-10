import shuffle from "shuffle-array";

import mongodb from "./mongodb.js";

const handlers = {
    "shuffle": handleQueueShuffle,
    "rotate": handleQueueRotate,
    "toggleStatus": handleQueueToggleStatus,
    "add": handleQueueAdd,
    "remove": handleQueueRemove,
    "default": handleUnknownAction,
}

async function handleRequest(body) {
    const queueId = body.queueId;
    const action = body.action;
    const handler = handlers[action] || handlers["default"];
    await handler(body);
    return await mongodb.queue.findWithUsers(queueId);
}

async function handleQueueShuffle(body) {
    const queueId = body.queueId;
    try {
        const queue = await mongodb.queue.findById(queueId);
        const shuffledMembers = shuffle(queue.members);
        queue.members = shuffledMembers;
        await mongodb.queue.updateMembers(queueId, shuffledMembers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function handleQueueRotate(body) {
    const queueId = body.queueId;
    try {
        const queue = await mongodb.queue.findById(queueId);
        const nearestReadyIndex = findNearestReadyIndex(queue.members);
        if (nearestReadyIndex < 0) {
            return;
        }

        const rotateMagnitude = nearestReadyIndex + 1;
        const nextReadyMember = queue.members.at(nearestReadyIndex);
        nextReadyMember.status = false;
        const rotatedMembers = arrayRotate(queue.members, rotateMagnitude);
        await mongodb.queue.updateMembers(queueId, rotatedMembers);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function handleQueueToggleStatus(body) {
    try {
        const queueId = body.queueId;
        const member = body.member;
        await mongodb.queue.updateMemberStatus(queueId, member.id, !(member.status === "true"));
    } catch (error) {
        return Promise.reject(error);
    }
}

async function handleQueueAdd(body) {
    try {
        const queueId = body.queueId;
        const personNameSplitted = body.personName.split(/\s+/, 2);
        const personName = {
            last: personNameSplitted[0],
            first: personNameSplitted[1]
        }
        await mongodb.queue.insertNewUser(queueId, personName);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function handleQueueRemove(body) {
    try {
        const queueId = body.queueId;
        const userId = body.member.id;
        await mongodb.queue.deleteUser(queueId, userId);
    } catch (error) {
        return Promise.reject(error);
    }
}

async function handleUnknownAction(body) {
    return Promise.reject(`Unknown action: ${body.action}`)
}

function findNearestReadyIndex(members) {
    const nearestReadyIndex = members.findIndex(member => member.status);
    return nearestReadyIndex;
}

function arrayRotate(array, magnitude) {
    const left = array.slice(0, magnitude);
    const right = array.slice(magnitude);
    const arrayRotated = right.concat(left);
    return arrayRotated;
}

const show = async (request, response, next) => {
    try {
        const queueId = request.query.queueId;
        const queueWithUsers = await mongodb.queue.findWithUsers(queueId);
        response.render("queue", {
            queue: queueWithUsers
        });
    } catch (error) {
        next(error);
    }
}

const update = async (request, response, next) => {
    try {
        const queueWithUsers = await handleRequest(request.body);
        response.render("queue", {
            queue: queueWithUsers
        });
    } catch (error) {
        next(error);
    }
}

export default {
    show,
    update
}