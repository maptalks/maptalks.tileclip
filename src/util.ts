
export function isNumber(value) {
    return typeof value === 'number';
}

export function checkTileUrl(url: string | Array<string>): Array<string> {
    if (Array.isArray(url)) {
        return url;
    }
    return [url];
}

export const CANVAS_ERROR_MESSAGE = new Error('not find canvas.The current environment does not support OffscreenCanvas');