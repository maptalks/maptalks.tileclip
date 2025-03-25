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