import { registerWorkerAdapter, worker } from 'maptalks';
//@ts-ignore
import WORKERCODE from './worker/worker.bundle.js';
import { BBOXtype } from './bbox';
import { createError, FetchCancelError, isNumber, uuid, CANVAS_ERROR_MESSAGE, isImageBitmap, isPolygon, checkTileUrl, checkBuffers } from './util.js';
import { getCanvas } from './canvas';
export { getBlankTile, get404Tile } from './canvas';

const WORKERNAME = '__maptalks.tileclip__';

registerWorkerAdapter(WORKERNAME, WORKERCODE as unknown as string);

const maskMap = {};
const SUPPORTPROJECTION = ['EPSG:4326', 'EPSG:3857'];
const TerrainTypes = ['mapzen', 'tianditu', 'cesium', 'arcgis', 'qgis-gray'];

export type getTileOptions = {
    url: string | ImageBitmap | Array<string | ImageBitmap>;
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

export type encodeTerrainTileOptions = {
    url: string;
    terrainType: 'mapzen' | 'tianditu' | 'cesium' | 'arcgis' | 'qgis-gray';
    minHeight?: number;
    maxHeight?: number;
    terrainWidth?: number;
    tileSize?: number;
    referrer?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    timeout?: number;
    returnBlobURL?: boolean;
    terrainColors?: Array<[number, string]>
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
    maskId: string;
    tileSize?: number;
    reverse?: boolean;
    returnBlobURL?: boolean;
}

export type transformTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    errorLog?: boolean;
    zoomOffset?: number;
    debug?: boolean;
}

export type colorTerrainTileOptions = {
    tile: ImageBitmap;
    colors: Array<[number, string]>;
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
    return Object.assign({ referrer: document.location.href, tileSize: 256 }, options, { _type: type, __taskId: uuid(), __workerId: getWorkerId() });
}

function getTaskId(options) {
    const workerId = options.__workerId;
    const taskId = options.__taskId;
    return {
        workerId,
        taskId
    }
}


class TileActor extends worker.Actor {

    _cancelTask(options: privateOptions) {
        const { workerId, taskId } = getTaskId(options);
        if (!isNumber(workerId) || !isNumber(taskId)) {
            return;
        }
        if (taskId) {
            this.send({ _type: 'cancelFetch', __taskId: taskId }, [], (error, image) => {
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
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { url } = options;
            if (!url) {
                reject(createError('getTile error:url is null'));
                return;
            }
            const buffers = checkBuffers(url);
            this.send(options, buffers, (error, image) => {
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
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { urlTemplate, maxAvailableZoom, x, y, z } = options;
            const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
            if (!maxZoomEnable) {
                reject(createError('getTileWithMaxZoom error:maxAvailableZoom is error'));
                return;
            }
            if (!urlTemplate) {
                reject(createError('getTileWithMaxZoom error:urlTemplate is error'));
                return;
            }
            if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
                reject(createError('getTileWithMaxZoom error:x/y/z is error'));
                return;
            }
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
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { urlTemplate, x, y, z, maxAvailableZoom, projection, zoomOffset, errorLog, debug, returnBlobURL } = options;
            const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
            if (!projection) {
                reject(createError('transformTile error:not find projection'));
                return;
            }
            if (SUPPORTPROJECTION.indexOf(projection) === -1) {
                reject(createError('transformTile error:not support projection:' + projection + '.the support:' + SUPPORTPROJECTION.join(',').toString()));
                return;
            }
            if (!maxZoomEnable) {
                reject(createError('transformTile error:maxAvailableZoom is error'));
                return;
            }
            if (!urlTemplate) {
                reject(createError('transformTile error:urlTemplate is error'));
                return;
            }
            if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
                reject(createError('transformTile error:x/y/z is error'));
                return;
            }
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
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { tile, tileBBOX, projection, tileSize, maskId } = options;
            if (!tile) {
                reject(createError('clipTile error:tile is null.It should be a ImageBitmap'));
                return;
            }
            if (!tileBBOX) {
                reject(createError('clipTile error:tileBBOX is null'));
                return;
            }
            if (!projection) {
                reject(createError('clipTile error:projection is null'));
                return;
            }
            if (!tileSize) {
                reject(createError('clipTile error:tileSize is null'));
                return;
            }
            if (!maskId) {
                reject(createError('clipTile error:maskId is null'));
                return;
            }
            if (!this.maskHasInjected(maskId)) {
                reject(createError('not find mask by maskId:' + maskId));
                return;
            }
            const buffers: ArrayBuffer[] = [];
            if (isImageBitmap(options.tile)) {
                buffers.push(options.tile as unknown as ArrayBuffer);
            }
            this.send(options, buffers, (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
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
                reject(createError('injectMask error:maskId is null'));
                return;
            }
            if (maskMap[maskId]) {
                reject(createError(`injectMask error:${maskId} has injected`));
                return;
            }
            if (!isPolygon(geojsonFeature)) {
                reject(createError('injectMask error:geojsonFeature is not Polygon,It should be GeoJSON Polygon/MultiPolygon'));
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
                reject(createError('removeMask error:maskId is null'));
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
            console.error('maskHasInjected error:maskId is null');
            return false;
        }
        return !!maskMap[maskId];
    }

    imageSlicing(options: getTileOptions) {
        options = checkOptions(options, 'imageSlicing');
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { url } = options;
            if (!url) {
                reject(createError('url is null'));
                return;
            }
            const buffers = checkBuffers(url);
            this.send(options, buffers, (error, result) => {
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

    encodeTerrainTile(options: encodeTerrainTileOptions) {
        options = checkOptions(options, 'encodeTerrainTile');
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { url, terrainType, minHeight, maxHeight } = options;
            if (!url) {
                reject(createError('encodeTerrainTile error:url is null'));
                return;
            }

            if (!terrainType) {
                reject(createError('encodeTerrainTile error:terrainType is null'));
                return;
            }
            if (TerrainTypes.indexOf(terrainType) === -1) {
                reject(createError('encodeTerrainTile error:terrainType:not support the terrainType:' + terrainType));
                return;
            }
            if (terrainType === 'qgis-gray') {
                if (!isNumber(minHeight) || !isNumber(maxHeight) || minHeight > maxHeight) {
                    reject(createError('encodeTerrainTile error:terrainType:qgis-gray,require minHeight/maxHeight should number'));
                    return;
                }
            }
            this.send(Object.assign({ terrainWidth: 65, tileSize: 256 }, options), [], (error, image) => {
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

    colorTerrainTile(options: colorTerrainTileOptions) {
        options = checkOptions(options, 'colorTerrainTile');
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { tile, colors } = options;
            if (!tile || !isImageBitmap(tile)) {
                reject(createError('colorTerrainTile error:tile is not ImageBitMap'));
                return;
            }

            if (!colors || !Array.isArray(colors) || colors.length === 0) {
                reject(createError('colorTerrainTile error:colors is null'));
                return;
            }
            const buffers = checkBuffers(tile);
            this.send(Object.assign({}, options), buffers, (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    resolve(image);
                }
            });
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
