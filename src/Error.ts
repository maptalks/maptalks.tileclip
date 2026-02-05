
/////////////////////
class CustomError {
    public code: number;
    public message: string;

    constructor(message: string, code: number) {
        this.message = message;
        this.code = code;
    }
}

export function createError(message: string, code: number): Error {
    return new CustomError(message, code) as unknown as Error;
}

export const CANVAS_ERROR_MESSAGE = createError('not find canvas.The current environment does not support OffscreenCanvas', -4);
export const FetchCancelError = createError('fetch tile data cancel', 499);
export const FetchTimeoutError = createError('fetch tile data timeout', 408);
export const TaskCancelError = createError('the task is cancel', -6);

export function isFetchDefaultError(error: CustomError | Error) {
    return error === FetchCancelError || error === FetchTimeoutError;
}

export function createFetchError(res: Response) {
    const { url, status } = res;
    return createError(`fetch NetWork error, the url is ${url}`, status);
}
export function createNetWorkError(url: string | string[]) {
    if (!Array.isArray(url)) {
        url = [url];
    }
    url = url.join(',').toString();
    return createError(`fetch NetWork error, the url is ${url}`, -5);
}

export function createParamsValidateError(message) {
    return createError(message, -1);
}

export function createDataError(message) {
    return createError(message, -2);
}

export function createInnerError(message) {
    return createError(message, -3);
}

///////////////////////