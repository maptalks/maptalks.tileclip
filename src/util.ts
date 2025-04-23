import { GeoJSONMultiPolygon, GeoJSONPolygon } from './index';

export function isNumber(value) {
    return typeof value === 'number';
}

export function createError(message: string): Error {
    return new Error(message);
}

export function checkTileUrl(url: string | Array<string>): Array<string> {
    if (Array.isArray(url)) {
        return url;
    }
    return [url];
}

export const CANVAS_ERROR_MESSAGE = createError('not find canvas.The current environment does not support OffscreenCanvas');

export function lnglat2Mercator(coordinates: Array<number>) {
    const [lng, lat] = coordinates;
    const earthRad = 6378137.0;
    const x = lng * Math.PI / 180 * earthRad;
    const a = lat * Math.PI / 180;
    const y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
    return [x, y];
}


export const FetchCancelError = createError('fetch tile data cancel');
export const FetchTimeoutError = createError('fetch tile data timeout');


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

export const HEADERS = {
    'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
};

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

export function transformMapZen(imageData: ImageData) {
    const data = imageData.data;
    const out: [number, number, number] = [0, 0, 0];
    for (let i = 0, len = data.length; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a === 0) {
            continue;
        }
        const height = (r * 256 + g + b / 256) - 32768;
        const [r1, g1, b1] = encodeMapBox(height, out);
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
    }
    return imageData;
}