import { StatusCodes } from "http-status-codes";

export class ApplicationError extends Error {
    protected _statusCode: number;

    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
        this.name = this.constructor.name;
    }

    get statusCode(): number {
        return this._statusCode;
    }

    public jsonFriendly() {
        return {
            error: {
                code: this.statusCode,
                name: this.name,
                message: this.message,
            },
        };
    }
}

export class AggregateError extends ApplicationError {
    errors: Error[];

    constructor(errors: Error[]) {
        super(AggregateError.name);
        this.errors = errors;
        this._statusCode = StatusCodes.BAD_REQUEST;
    }
}

// Server errors:
export class ServerError extends ApplicationError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
}

export class DatabaseError extends ServerError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
}

export class WriteResultNotAcknowledgedError extends DatabaseError {
    constructor(message: string = "Write result was not acknowledged") {
        super(message);
        this._statusCode = StatusCodes.INTERNAL_SERVER_ERROR;
    }
}

// Client errors:
export class UserCausedError extends ApplicationError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.BAD_REQUEST;
    }
}

export class ResourceNotFoundError extends UserCausedError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.NOT_FOUND;
    }
}

export class AuthenticationError extends UserCausedError {
    private _cause: string;

    constructor(message: string, cause?: string) {
        super(message);
        this._statusCode = StatusCodes.UNAUTHORIZED;
        this._cause = cause;
    }
}

export class DuplicateError extends UserCausedError {
    constructor(message: string) {
        super(message);
        this._statusCode = StatusCodes.CONFLICT;
    }
}
