import { registerWorkerAdapter, worker } from 'maptalks';
//@ts-ignore
import WORKERCODE from './worker/worker.bundle.js';
import { isPolygon } from './tileclip';
import { BBOXtype } from './bbox';
import { isNumber } from './util.js';

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
    returnBlobURL?: boolean;
}

export type transformTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    errorLog?: boolean
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
    return Object.assign({ referrer: document.location.href }, options, { _type: type }, { __taskId: uuid(), __workerId: getWorkerId() });
}

class TileActor extends worker.Actor {


    _cancelTask(options) {
        const workerId = options.__workerId;
        const taskId = options.__taskId;
        if (!isNumber(workerId) || !isNumber(taskId)) {
            return;
        }
        if (taskId) {
            this.send({ _type: 'cancelFetch', taskId }, [], (error, image) => {
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
        const workerId = (options as any).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            this.send(Object.assign(options), [], (error, image) => {
                if (error) {
                    reject(error);
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
        const workerId = (options as any).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            options.referrer = options.referrer || document.location.href;
            this.send(options, [], (error, image) => {
                if (error) {
                    reject(error);
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
        const workerId = (options as any).__workerId;
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            options.referrer = options.referrer || document.location.href;
            this.send(options, [], (error, image) => {
                if (error) {
                    reject(error);
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
        delete (options as any).taskId;
        const promise = new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            const buffers: ArrayBuffer[] = [];
            if (options.tile && options.tile instanceof ImageBitmap) {
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
                reject(new Error('maskId is null'));
                return;
            }
            if (maskMap[maskId]) {
                reject(new Error(`${maskId} has injected`));
                return;
            }
            if (!isPolygon(geojsonFeature)) {
                reject(new Error('geojsonFeature is not Polygon,It should be GeoJSON Polygon/MultiPolygon'));
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
                reject(new Error('maskId is null'));
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

let globalId = 0;
function uuid() {
    globalId++;
    return globalId;
}

function wrapPromise(promise: Promise<any>, options) {
    (promise as any).cancel = () => {
        getTileActor()._cancelTask(options);
    }
}
