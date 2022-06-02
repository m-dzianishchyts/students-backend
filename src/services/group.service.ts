import mongoose from "mongoose";
import { RequestHandler } from "express";
import { StatusCodes } from "http-status-codes";
import { body, param } from "express-validator";

import GroupModel, { GroupInitial } from "../models/group.js";
import { ResourceNotFoundError, UserCausedError } from "../util/errors.js";
import { identify } from "./authentication.service.js";

/*
 * GET /api/groups/:groupId
 */
const show: RequestHandler = async (request, response, next) => {
    try {
        const id = request.params[groupIdParameter];
        const group = await GroupModel.findById(id).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }
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
 * GET /api/groups/:groupId/members
 */
const showUsers: RequestHandler = async (request, response, next) => {
    try {
        const id = request.params[groupIdParameter];
        const group = await GroupModel.findById(id).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }
        const users = await group.showUsers();
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
 * GET /api/groups/:groupId/queues/perspective/:userId
 */
const showQueuesPerspective: RequestHandler = async (request, response, next) => {
    try {
        const groupId = request.params[groupIdParameter];
        const userId = request.params[userIdParameter];

        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        const queues = await group.showQueuesPerspective(userId);
        response.json(queues);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /api/groups/
 */
const create: RequestHandler = async (request, response, next) => {
    const clientId = identify(request);
    const initial = <GroupInitial>{
        name: request.body[nameParameter],
        creator: clientId,
    };
    try {
        const group = await GroupModel.createFromInitial(initial);
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
 * PUT /api/groups/:groupId/members/:userId
 */
const addMemberWithId: RequestHandler = async (request, response, next) => {
    try {
        const groupId = request.params[groupIdParameter];
        const userId = request.params[userIdParameter];
        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        await group.addMemberWithId(userId);
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * PUT /api/groups/:groupId/members/email
 */
const addMemberWithEmail: RequestHandler = async (request, response, next) => {
    try {
        const groupId = request.params[groupIdParameter];
        const userEmail = request.body["email"];
        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        await group.addMemberWithEmail(userEmail);
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * DELETE /api/groups/:groupId/members/:userId
 */
const deleteMember: RequestHandler = async (request, response, next) => {
    try {
        const groupId = request.params[groupIdParameter];
        const userId = request.params[userIdParameter];
        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        await group.deleteMember(userId);
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * DELETE /api/groups/:groupId
 */
const deleteGroup: RequestHandler = async (request, response, next) => {
    const groupId = request.params[groupIdParameter];
    try {
        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
            return;
        }

        await group.deleteProperly();
        response.status(StatusCodes.NO_CONTENT).end();
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * POST /api/groups/:groupId/queues
 */
const createQueue: RequestHandler = async (request, response, next) => {
    try {
        const queueName = request.body[nameParameter];
        const groupId = request.params[groupIdParameter];

        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
        }

        const queue = await group.createQueue(queueName);
        response.status(StatusCodes.OK).json(queue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

/*
 * DELETE /api/groups/:groupId/queues/:queueId
 */
const deleteQueue: RequestHandler = async (request, response, next) => {
    try {
        const groupId = request.params[groupIdParameter];
        const queueId = request.params[queueIdParameter];

        const group = await GroupModel.findById(groupId).exec();
        if (!group) {
            next(new ResourceNotFoundError("Group was not found."));
        }

        const queue = await group.deleteQueue(queueId);
        response.status(StatusCodes.OK).json(queue);
    } catch (error) {
        if (error instanceof mongoose.Error.CastError) {
            next(new UserCausedError(`Invalid id: ${error.value}`));
        } else {
            next(error);
        }
    }
};

const groupIdParameter = "groupId";
const userIdParameter = "userId";
const queueIdParameter = "queueId";
const nameParameter = "name";

export default {
    show: [
        param(groupIdParameter).isHexadecimal(),
        show,
    ],
    showUsers: [
        param(groupIdParameter).isHexadecimal(),
        showUsers,
    ],
    showQueuesPerspective: [
        param(groupIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        showQueuesPerspective,
    ],
    create: [
        body(nameParameter).trim().isLength({ min: 1, max: 255 }),
        create,
    ],
    addMemberWithId: [
        param(groupIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        addMemberWithId,
    ],
    addMemberWithEmail: [
        param(groupIdParameter).isHexadecimal(),
        body("email").isEmail(),
        addMemberWithEmail,
    ],
    deleteMember: [
        param(groupIdParameter).isHexadecimal(),
        param(userIdParameter).isHexadecimal(),
        deleteMember,
    ],
    createQueue: [
        param(groupIdParameter).isHexadecimal(),
        body(nameParameter).trim().isLength({ min: 1, max: 255 }),
        createQueue,
    ],
    deleteQueue: [
        param(groupIdParameter).isHexadecimal(),
        param(queueIdParameter).isHexadecimal(),
        deleteQueue,
    ],
    delete: [
        param(groupIdParameter).isHexadecimal(),
        deleteGroup,
    ],
};
