import LRUCache from './LRUCache';
import { GeoJSONMultiPolygon, GeoJSONPolygon, postProcessingOptionsType, returnResultType, TileItem } from './types';

class CustomError extends Error {
    public code: number;

    constructor(message: string, code: number) {
        super(message);
        this.code = code;
    }
}

export const CancelTaskLRUCache = new LRUCache<number>(1000, () => {

})

export function removeTimeOut(id: number) {
    clearTimeout(id);
}


export const HEADERS = {
    'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
};

export function isNumber(value) {
    return typeof value === 'number';
}

function createError(message: string, code: number): Error {
    return new CustomError(message, code);
}

export const CANVAS_ERROR_MESSAGE = createError('not find canvas.The current environment does not support OffscreenCanvas', -4);
export const FetchCancelError = createError('fetch tile data cancel', 499);
export const FetchTimeoutError = createError('fetch tile data timeout', 408);
export const TaskCancelError = createError('the task is cancel', -6);

export function isFetchDefaultError(error: Error) {
    return error === FetchCancelError || error === FetchTimeoutError;
}

export function createNetWorkError(url: string) {
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

export function checkArray(url: any | Array<any>): Array<any> {
    if (Array.isArray(url)) {
        return url;
    }
    return [url];
}


export function lnglat2Mercator(coordinates: Array<number>) {
    const [lng, lat] = coordinates;
    const earthRad = 6378137.0;
    const x = lng * Math.PI / 180 * earthRad;
    const a = lat * Math.PI / 180;
    const b = Math.sin(a);
    const y = earthRad / 2 * Math.log((1.0 + b) / (1.0 - b));
    return [x, y];
}


export function isPolygon(feature: GeoJSONPolygon | GeoJSONMultiPolygon) {
    if (!feature) {
        return false;
    }
    const geometry = feature.geometry || { type: null };
    const type = geometry.type;
    return type === 'Polygon' || type === 'MultiPolygon';
}

export function isEPSG3857(projection: string) {
    return projection === 'EPSG:3857';
}


let globalId = 0;
export function uuid() {
    globalId++;
    return globalId;
}

export function isImageBitmap(image: any) {
    return image && image instanceof ImageBitmap;
}

export function disposeImage(images: ImageBitmap | ImageBitmap[]) {
    if (!Array.isArray(images)) {
        images = [images];
    }
    images.forEach(image => {
        if (image && image.close) {
            image.close();
        }
    });
}

export function encodeMapBox(height: number, out?: [number, number, number]) {
    const value = Math.floor((height + 10000) * 10);
    const r = value >> 16;
    const g = value >> 8 & 0x0000FF;
    const b = value & 0x0000FF;
    if (out) {
        out[0] = r;
        out[1] = g;
        out[2] = b;
        return out;
    } else {
        return [r, g, b];
    }
}

export function rgb2Height(R: number, G: number, B: number) {
    return -10000 + ((R * 256 * 256 + G * 256 + B) * 0.1);
}

export function replaceAll(template: string, key: string, value: string) {
    while (template.indexOf(key) > -1) {
        template = template.replace(key, value);
    }
    return template;
}


export function checkBuffers(image: any) {
    const images = checkArray(image);
    const buffers = [];
    images.forEach(item => {
        if (isImageBitmap(item) || (item && (item as unknown as ArrayBuffer instanceof ArrayBuffer))) {
            buffers.push(item);
        }
    });
    return buffers;
}

export function toTileItems(tiles: Array<[number, number, number]>): Array<TileItem> {
    return tiles.map(tile => {
        const [x, y, z] = tile;
        const item: TileItem = {
            x,
            y,
            z,
        };
        return item;
    })
}


function formatTileUrlBySubdomains(url: string, subdomains: string[]) {
    if (!subdomains || !subdomains.length) {
        return url;
    }
    const len = subdomains.length;
    let index = Math.floor(Math.random() * len);
    index = Math.min(index, len - 1);
    return replaceAll(url, '{s}', subdomains[index])
}

export function getTileUrl(urlTemplate: string, x: number, y: number, z: number, subdomains: string[]) {
    let key = '{x}';
    let url = replaceAll(urlTemplate, key, x as unknown as string);
    key = '{y}';
    url = replaceAll(url, key, y as unknown as string);
    key = '{z}';
    url = replaceAll(url, key, z as unknown as string);
    return formatTileUrlBySubdomains(url, subdomains);
}

export function validateSubdomains(urlTemplate: string, subdomains: string[]) {
    if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
        if (!subdomains || subdomains.length === 0) {
            return false;
        }
    }
    return true;
}

export function getBlankVTTile() {
    return new Uint8Array(0).buffer;
}

export function copyArrayBuffer(buffer: ArrayBuffer) {
    const array = new Uint8Array(buffer);
    return new Uint8Array(array).buffer;
}

export function needFormatImageType(options: returnResultType) {
    const { returnBase64, returnBlobURL, returnUint32Buffer, forceReturnImage } = options;
    if (forceReturnImage) {
        return false;
    }
    return (returnBase64 || returnBlobURL || returnUint32Buffer);
}

export function needPostProcessingImage(options: postProcessingOptionsType) {
    const { filter, opacity, gaussianBlurRadius, mosaicSize, oldPhoto } = options;
    return (filter || opacity || gaussianBlurRadius || mosaicSize || oldPhoto);
}
