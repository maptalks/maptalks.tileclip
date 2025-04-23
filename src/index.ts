import { registerWorkerAdapter, worker } from 'maptalks';
//@ts-ignore
import WORKERCODE from './worker/worker.bundle.js';
import { isImageBitmap, isPolygon } from './util';
import { BBOXtype } from './bbox';
import { createError, FetchCancelError, isNumber, uuid } from './util.js';

const WORKERNAME = '__maptalks.tileclip';

registerWorkerAdapter(WORKERNAME, WORKERCODE as unknown as string);

const maskMap = {};

export type getTileOptions = {
    url: string | Array<string>;
    referrer?: string;
    filter?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    timeout?: number;
    opacity?: number;
    returnBlobURL?: boolean;
    gaussianBlurRadius?: number;
    globalCompositeOperation?: GlobalCompositeOperation;
}

export type getTileWithMaxZoomOptions = Omit<getTileOptions, 'url'> & {
    urlTemplate: string | Array<string>;
    maxAvailableZoom: number;
    x: number;
    y: number;
    z: number;
    subdomains?: Array<string>;
}

export type clipTileOptions = {
    tile: ImageBitmap;
    tileBBOX: BBOXtype;
    projection: string;
    tileSize: number;
    maskId: string;
    reverse?: boolean;
    returnBlobURL?: boolean;
}

export type transformTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    errorLog?: boolean
}

type privateOptions = getTileOptions & {
    __taskId?: number;
    __workerId?: number;
}

export type GeoJSONPolygon = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: number[][][]
    },
    properties?: Record<string, any>;
    bbox?: BBOXtype
}

export type GeoJSONMultiPolygon = {
    type: 'Feature',
    geometry: {
        type: 'MultiPolygon',
        coordinates: number[][][][]
    },
    properties?: Record<string, any>;
    bbox?: BBOXtype
}

function checkOptions(options, type: string) {
    return Object.assign({ referrer: document.location.href }, options, { _type: type, __taskId: uuid(), __workerId: getWorkerId() });
}


class TileActor extends worker.Actor {

    _cancelTask(options: privateOptions) {
        const workerId = options.__workerId;
        const __taskId = options.__taskId;
        if (!isNumber(workerId) || !isNumber(__taskId)) {
            return;
        }
        if (__taskId) {
            this.send({ _type: 'cancelFetch', __taskId }, [], (error, image) => {
                // if (error) {
                //     reject(error);
                // } else {
                //     resolve(image);
                // }
            }, workerId);
        }
    }

    getTile(options: getTileOptions) {
        options = checkOptions(options, 'getTile');
        const workerId = (options as privateOptions).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            this.send(Object.assign(options), [], (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    resolve(image);
                }
            }, workerId);
        });
        wrapPromise(promise, options);
        return promise;
    }

    getTileWithMaxZoom(options: getTileWithMaxZoomOptions) {
        options = checkOptions(options, 'getTileWithMaxZoom');
        const workerId = (options as unknown as privateOptions).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            this.send(options, [], (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    resolve(image);
                }
            }, workerId);
        });
        wrapPromise(promise, options);
        return promise;
    }

    transformTile(options: transformTileOptions) {
        options = checkOptions(options, 'transformTile');
        const workerId = (options as unknown as privateOptions).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            this.send(options, [], (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    resolve(image);
                }
            }, workerId);
        });
        wrapPromise(promise, options);
        return promise;
    }

    clipTile(options: clipTileOptions) {
        options = checkOptions(options, 'clipTile');
        delete (options as unknown as privateOptions).__taskId;
        delete (options as unknown as privateOptions).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            const buffers: ArrayBuffer[] = [];
            if (isImageBitmap(options.tile)) {
                buffers.push(options.tile as unknown as ArrayBuffer);
            }
            this.send(options, buffers, (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
        wrapPromise(promise, options);
        return promise;
    }

    injectMask(maskId: string, geojsonFeature: GeoJSONPolygon | GeoJSONMultiPolygon) {
        const promise = new Promise((resolve, reject) => {
            if (!maskId) {
                reject(createError('maskId is null'));
                return;
            }
            if (maskMap[maskId]) {
                reject(createError(`${maskId} has injected`));
                return;
            }
            if (!isPolygon(geojsonFeature)) {
                reject(createError('geojsonFeature is not Polygon,It should be GeoJSON Polygon/MultiPolygon'));
                return;
            }
            this.broadcast({
                maskId,
                geojsonFeature,
                _type: 'injectMask'
            }, [], (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(null);
                maskMap[maskId] = true;
            });
        });
        wrapPromise(promise, {});
        return promise;
    }

    removeMask(maskId: string) {
        const promise = new Promise((resolve, reject) => {
            if (!maskId) {
                reject(createError('maskId is null'));
                return;
            }
            this.broadcast({
                maskId,
                _type: 'removeMask'
            }, [], (error, data) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve(null);
                delete maskMap[maskId];
            });
        });
        wrapPromise(promise, {});
        return promise;
    }

    maskHasInjected(maskId: string) {
        if (!maskId) {
            console.error('maskId is null');
            return false;
        }
        return !!maskMap[maskId];
    }

    imageSlicing(options: getTileOptions) {
        options = checkOptions(options, 'imageSlicing');
        const workerId = (options as privateOptions).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            this.send(options, [], (error, result) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    const returnBlobURL = options.returnBlobURL;
                    if (!returnBlobURL) {
                        resolve(result);
                    } else {
                        const items = result.items || [];
                        const workerIds = [];
                        while (1) {
                            const workerId = getWorkerId();
                            if (workerIds.indexOf(workerId) === -1) {
                                workerIds.push(workerId);
                            } else {
                                break;
                            }
                        }
                        const pageSize = Math.ceil(items.length / workerIds.length);
                        let temp = [];
                        const isEnd = () => {
                            return temp.length === items.length;
                        }
                        const mergeResult = () => {
                            temp.forEach(d => {
                                for (let i = 0, len = items.length; i < len; i++) {
                                    const item = items[i];
                                    if (item.id === d.id) {
                                        item.image = d.url;
                                        break;
                                    }
                                }
                            });
                            resolve(result);
                        }
                        for (let i = 0, len = workerIds.length; i < len; i++) {
                            const workerId = workerIds[i];
                            const start = i * pageSize;
                            const end = start + pageSize;
                            const subItems = items.slice(start, end);
                            if (subItems.length === 0) {
                                if (isEnd()) {
                                    mergeResult();
                                }
                                continue;
                            }
                            const opts = Object.assign({}, options);
                            (opts as any)._type = 'imageToBlobURL';
                            (opts as any).items = subItems;
                            (opts as any)._workerId = workerId;
                            const buffers = subItems.map(item => item.image as ArrayBuffer);
                            this.send(opts, buffers, (error, resultItems) => {
                                if (error) {
                                    reject(error);
                                    return;
                                } else {
                                    temp = temp.concat(resultItems);
                                    if (isEnd()) {
                                        mergeResult();
                                    }
                                }
                            }, workerId);
                        }
                    }
                }
            }, workerId);
        });
        wrapPromise(promise, options);
        return promise;
    }
}

let actor: TileActor;

export function getTileActor() {
    if (!actor) {
        actor = new TileActor(WORKERNAME);
    }
    return actor;
}

let globalWorkerId = 0;
function getWorkerId() {
    const actor = getTileActor();
    const workers = actor.workers || [];
    const id = globalWorkerId % workers.length;
    globalWorkerId++;
    return id;
}

function wrapPromise(promise: Promise<any>, options) {
    (promise as any).cancel = () => {
        getTileActor()._cancelTask(options);
        (promise as any).canceled = true;
    }
}
