import mongoose from "mongoose";
import shuffleArray from "shuffle-array";
import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { isBooleanable, boolean as toBoolean } from "boolean";

import Queue, { IQueueMember } from "../models/queue.js";
import { ResourceNotFoundError, UserCausedError } from "../util/errors.js";

/*
 * GET /api/queues/:id
 */
const show: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params.queueId;
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
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
 * POST /api/queues/:queueId/members/shuffle
 */
const shuffleMembers: RequestHandler = async (request, response, next) => {
    try {
        const queueId = request.params.queueId;
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
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
        const queueId = request.params.queueId;
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
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
        const queueId = request.params.queueId;
        const userId = request.params.userId;
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
        }

        const newQueueMember: any = await queue.insertMember(userId);
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
        const queueId = request.params.queueId;
        const userId = request.params.userId;
        const status = request.query.status;
        if (!isBooleanable(status)) {
            throw new UserCausedError("Status is not boolean-like");
        }

        const statusBoolean = Boolean(toBoolean(status));
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
        }

        const member = { id: userId, status: statusBoolean };
        await queue.updateMemberStatus(userId, statusBoolean);
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
        const queueId = request.params.queueId;
        const userId = request.params.userId;
        const queue = await Queue.findById(queueId).exec();
        if (queue === null) {
            throw new ResourceNotFoundError("Queue was not found");
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

function findNearestToggledIndex(members: IQueueMember[]) {
    return members.findIndex((member) => member.status);
}

function arrayRotate(array: any[], magnitude: number) {
    const left = array.slice(0, magnitude);
    const right = array.slice(magnitude);
    const arrayRotated = right.concat(left);
    return arrayRotated;
}

export default {
    show,
    shuffleMembers,
    rotateMembers,
    addMember,
    setMemberStatus,
    deleteMember,
};
