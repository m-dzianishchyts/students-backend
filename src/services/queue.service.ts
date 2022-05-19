import mongoose from "mongoose";
import shuffleArray from "shuffle-array";
import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { boolean as toBoolean } from "boolean";
import { body, param } from "express-validator";

import QueueModel, { QueueMember } from "../models/queue.js";
import { ResourceNotFoundError, UserCausedError } from "../util/errors.js";
import { identify } from "./authentication.service.js";

/*
 * GET /api/queues/:queueId
 */
const show: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params[queueIdParameter];
        const queue = await QueueModel.findById(queueId).exec();
        if (queue === null) {
            next(new ResourceNotFoundError("Queue was not found"));
            return;
        }

        response.json(queue);
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
 * POST /api/queues/:queueId/members/shuffle
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
        response.json(queue.members);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /api/queues/:queueId/members/rotate
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
        response.json(rotatedMembers);
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

        const member = { id: userId, status: status };
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
