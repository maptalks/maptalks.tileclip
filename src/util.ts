import { createNetWorkError } from './Error';
import LRUCache from './LRUCache';
import { GeoJSONMultiPolygon, GeoJSONPolygon, postProcessingOptionsType, returnResultType, rejectResultType, TileItem, urlTemplateFunction } from './types';

export function allSettled<T>(promiseList: Promise<T>[], urls: string[], isAll?: boolean) {
    return new Promise((resolve: (images: Array<T>) => void, reject: rejectResultType) => {
        const results = [];
        const errors = [];
        const onlyOne = promiseList.length === 1;
        const isEnd = () => {
            if (results.length === promiseList.length) {
                let filterResults = results.filter(image => {
                    return !!image;
                });
                if (isAll && filterResults.length < promiseList.length) {
                    reject(onlyOne ? errors[0] : createNetWorkError(urls));
                    return;
                }
                if (filterResults.length === 0) {
                    reject(onlyOne ? errors[0] : createNetWorkError(urls));
                    return;
                }
                filterResults = filterResults.sort((a, b) => {
                    return a.index - b.index;
                })
                resolve(filterResults.map(item => {
                    return item.data;
                }));
            }
        }
        promiseList.forEach((promise, index) => {
            promise.then(image => {
                results.push({ index, data: image });
                isEnd();
            }).catch(error => {
                results.push(null);
                errors.push(error);
                isEnd();
            })
        });
    });
}

export const CancelTaskLRUCache = new LRUCache<number>(1000, () => {

})

export function removeTimeOut(id: any) {
    clearTimeout(id);
}


export const HEADERS = {
    'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
};


export function isNil(obj) {
    return obj == null;
}

export function isNumber(value) {
    return typeof value === 'number';
}

export function isString(value) {
    return typeof value === 'string';
}

export function isFunction(obj) {
    if (isNil(obj)) {
        return false;
    }
    return typeof obj === 'function' || (obj.constructor !== null && obj.constructor === Function);
}

export function getFunctionBody(str: string) {
    if (!str) {
        return;
    }
    if (isFunction(str)) {
        str = str.toString();
    }
    const start = str.indexOf('{'), end = str.lastIndexOf('}');
    if (start === -1 || end === -1) {
        return;
    }
    return str.substring(start + 1, end);
}

export function checkArray(url: any | Array<any>): Array<any> {
    if (Array.isArray(url)) {
        return url;
    }
    return [url];
}

const BASE64_REG = /data:image\/.*;base64,/;

export function isAbsoluteURL(url: string) {
    if (typeof url !== 'string') {
        return true;
    }
    if (BASE64_REG.test(url)) {
        return true;
    }
    if (url.indexOf('blob:') === 0) {
        return true;
    }
    if (url.indexOf('http') === 0) {
        return true;
    }
    return false;
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

function getDomain(subdomains: string[]) {
    if (!subdomains || !subdomains.length) {
        return;
    }
    const len = subdomains.length;
    let index = Math.floor(Math.random() * len);
    index = Math.min(index, len - 1);
    return subdomains[index];
}

function formatTileUrlBySubdomains(url: string, subdomains: string[]) {
    if (!subdomains || !subdomains.length) {
        return url;
    }
    return replaceAll(url, '{s}', getDomain(subdomains));
}

export function getTileUrl(urlTemplate: string | urlTemplateFunction, x: number, y: number, z: number, subdomains: string[]) {
    if (isFunction(urlTemplate)) {
        const urlFun = urlTemplate as unknown as urlTemplateFunction;
        const url = urlFun(x, y, z, getDomain(subdomains));
        return url;
    }
    urlTemplate = decodeURIComponent(urlTemplate as string);
    let key = '{x}';
    let url = replaceAll(urlTemplate as string, key, x as unknown as string);
    key = '{y}';
    url = replaceAll(url, key, y as unknown as string);
    key = '{z}';
    url = replaceAll(url, key, z as unknown as string);
    return formatTileUrlBySubdomains(url, subdomains);
}

export function validateSubdomains(urlTemplates: string | string[], subdomains: string[]) {
    if (!Array.isArray(urlTemplates)) {
        urlTemplates = [urlTemplates];
    }
    for (let i = 0, len = urlTemplates.length; i < len; i++) {
        const urlTemplate = urlTemplates[i];
        if (isFunction(urlTemplate)) {
            continue;
        }
        if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
            if (!subdomains || subdomains.length === 0) {
                return false;
            }
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

export function createFetchTileList<T>(urls: string[], options: Record<string, any>, fetchFun: Function): Array<Promise<T>> {
    urls = checkArray(urls);
    const headers = Object.assign({}, HEADERS, options.headers || {});
    return urls.map(url => {
        return fetchFun(url, headers, options);
    })
}


export function createUrlTemplateFun(urlTemplate: string | Array<string>): Array<urlTemplateFunction | string> {
    urlTemplate = checkArray(urlTemplate);
    return urlTemplate.map(url => {
        if (url.indexOf('function:') === -1) {
            return url;
        }
        const funBody = url.split('function:')[1];
        return new Function('x', 'y', 'z', 'domain', funBody) as urlTemplateFunction;
    })
}