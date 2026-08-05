export class ApiError extends Error {
    status: number;
    errorCode?: string;

    constructor(message: string, status: number, errorCode?: string) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.errorCode = errorCode;
    }
}
