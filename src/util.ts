
export function isNumber(value) {
    return typeof value === 'number';
}

export function checkTileUrl(url: string | Array<string>): Array<string> {
    if (Array.isArray(url)) {
        return url;
    }
    return [url];
}
