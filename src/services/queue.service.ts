import mongoose from "mongoose";
import { ObjectId } from "mongodb";
import shuffleArray from "shuffle-array";
import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { boolean as toBoolean } from "boolean";
import { body, param } from "express-validator";

import QueueModel, { QueueMember } from "../models/queue.js";
import { ResourceNotFoundError, UserCausedError } from "../util/errors.js";
import { identify } from "./authentication.service.js";
import { UserName, UserPojo } from "../models/user";

/*
 * GET /api/queues/:queueId
 */
const show: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const resultQueue = await getResultQueue(queueId);
        response.json(resultQueue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * GET /api/queues/:queueId/perspective/:userId
 */
const showPerspectiveSummary: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const userId = request.params[userIdParameter];

        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const resultQueue = await queue.toPerspectiveForm(userId);
        response.json(resultQueue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * GET /api/queues/:queueId/members
 */
const showUsers: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const users = await queue.showUsers();
        response.json(users);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * GET /api/queues/:queueId/group
 */
const showGroup: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (!queue) {
            throw new ResourceNotFoundError("Queue was not found.");
        }

        const group = await queue.showGroup();
        response.json(group);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /api/queues/:queueId/shuffle
 */
const shuffleMembers: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
        }

        const shuffledMembers = shuffleArray(queue.members);
        queue.members = shuffledMembers;
        await queue.updateMembers(shuffledMembers);

        const resultQueue = await getResultQueue(queueId);
        response.json(resultQueue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /api/queues/:queueId/rotate
 */
const rotateMembers: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const nearestToggledIndex = findNearestToggledIndex(queue.members);
        if (nearestToggledIndex < 0) {
            response.status(StatusCodes.NO_CONTENT).end();
            return;
        }

        const rotateMagnitude = nearestToggledIndex + 1;
        const nextToggledMember = queue.members.at(nearestToggledIndex);
        nextToggledMember.status = false;
        const rotatedMembers = arrayRotate(queue.members, rotateMagnitude);
        await queue.updateMembers(rotatedMembers);

        const resultQueue = await getResultQueue(queueId);
        response.json(resultQueue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * PUT /api/queues/:queueId/members/:userId
 */
const addMember: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const userId = request.params[userIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const newQueueMember: any = await queue.addMember(userId);
        if (newQueueMember !== null) {
            newQueueMember.userId = newQueueMember.userId.toString();
            response.status(StatusCodes.OK).json(newQueueMember);
        } else {
            response.status(StatusCodes.NO_CONTENT).end();
        }
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * GET /api/queues/:queueId/members/:userId
 */
const getMember: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const userId = request.params[userIdParameter];

        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const member = await queue.showMember(userId);
        response.json(member);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * PATCH /api/queues/:queueId/members/:userId
 */
const setMemberStatus: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const userId = request.params[userIdParameter];
        const status = toBoolean(request.body[statusParameter]);

        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        const member: QueueMember = { userId: new ObjectId(userId), status: status };
        await queue.updateMemberStatus(userId, status);
        response.json(member);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * DELETE /api/queues/:queueId/members/:userId
 */
const deleteMember: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const userId = request.params[userIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        await queue.deleteMember(userId);
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

const userFromToken: RequestHandler = async (request, _response, next) => {
    const clientId = identify(request);
    request.params[userIdParameter] = clientId;
    next();
};

async function getResultQueue(queueId: string): Promise<object> {
    const queue = await QueueModel.findById(queueId).exec();
    if (queue === null) {
        throw new ResourceNotFoundError("Queue was not found");
    }

    const queueUsers = await queue.showUsers();
    const queueUserDataSelector = (user: UserPojo & { status: boolean }) =>
        ["id", "name", "status"].reduce((object, key) => ({
            ...object,
            [key]: user[key],
        }), {}) as { id: string, name: UserName, status: boolean };
    const resultQueue = queue.toObject();
    resultQueue.members = queueUsers.map(user => queueUserDataSelector(user));
    return resultQueue;
}

function findNearestToggledIndex(members: QueueMember[]) {
    return members.findIndex((member) => member.status);
}

function arrayRotate(array: any[], magnitude: number) {
    const left = array.slice(0, magnitude);
    const right = array.slice(magnitude);
    const arrayRotated = right.concat(left);
    return arrayRotated;
}

const queueIdParameter = "queueId";
const userIdParameter = "userId";
const statusParameter = "status";

export default {
    show: [
        param(queueIdParameter).isHexadecimal(),
        show,
    ],
    showPerspectiveSummary: [
        param(queueIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        showPerspectiveSummary,
    ],
    showUsers: [
        param(queueIdParameter).isHexadecimal(),
        showUsers,
    ],
    showGroup: [
        param(queueIdParameter).isHexadecimal(),
        showGroup,
    ],
    shuffleMembers: [
        param(queueIdParameter).isHexadecimal(),
        shuffleMembers,
    ],
    rotateMembers: [
        param(queueIdParameter).isHexadecimal(),
        rotateMembers,
    ],
    getMember: [
        param(queueIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        getMember,
    ],
    addMember: [
        param(queueIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        addMember,
    ],
    setMemberStatus: [
        param(queueIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        body(statusParameter).isBoolean(),
        setMemberStatus,
    ],
    deleteMember: [
        param(queueIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        deleteMember,
    ],
    userFromToken,
};
