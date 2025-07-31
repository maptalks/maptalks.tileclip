import { registerWorkerAdapter, worker, Util } from 'maptalks';
//@ts-ignore
import WORKERCODE from './worker/worker.bundle.js';
import { createParamsValidateError, FetchCancelError, isNumber, uuid, CANVAS_ERROR_MESSAGE, isImageBitmap, isPolygon, checkBuffers, createNetWorkError, disposeImage } from './util.js';
import { getCanvas } from './canvas';
import {
    privateOptions, getTileOptions, layoutTilesOptions, getTileWithMaxZoomOptions,
    transformTileOptions, clipTileOptions, GeoJSONPolygon, GeoJSONMultiPolygon,
    encodeTerrainTileOptions, colorTerrainTileOptions,
    tileIntersectMaskOptions,
    injectImageOptions,
    getImageTileOptions
} from './types.js';
import { imageTile } from './imagetile.js';
export { getBlankTile, get404Tile } from './canvas';

const WORKERNAME = '__maptalks.tileclip__';

registerWorkerAdapter(WORKERNAME, WORKERCODE as unknown as string);

const maskMap = {};
const imageMap = {};
const SUPPORTPROJECTION = ['EPSG:4326', 'EPSG:3857'];
const TerrainTypes = ['mapzen', 'tianditu', 'cesium', 'arcgis', 'qgis-gray'];

function checkOptions(options, type) {
    return Object.assign(
        {
            referrer: document.location.href,
            tileSize: 256
        },
        options,
        {
            _type: type,
            __taskId: uuid(),
            __workerId: getWorkerId()
        });
}

function getTaskId(options: Record<string, any>) {
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
                reject(createParamsValidateError('getTile error:url is null'));
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

    layoutTiles(options: layoutTilesOptions) {
        options = checkOptions(options, 'layoutTiles');
        const { workerId } = getTaskId(options);
        const promise = new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { urlTemplate, tiles } = options;
            if (!urlTemplate) {
                reject(createParamsValidateError('layoutTiles error:urlTemplate is null'));
                return;
            }
            if (!tiles || tiles.length === 0) {
                reject(createParamsValidateError('layoutTiles error:tiles is null'));
                return;
            }
            const buffers = [];
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
                reject(createParamsValidateError('getTileWithMaxZoom error:maxAvailableZoom is error'));
                return;
            }
            if (!urlTemplate) {
                reject(createParamsValidateError('getTileWithMaxZoom error:urlTemplate is error'));
                return;
            }
            if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
                reject(createParamsValidateError('getTileWithMaxZoom error:x/y/z is error'));
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
                reject(createParamsValidateError('transformTile error:not find projection'));
                return;
            }
            if (SUPPORTPROJECTION.indexOf(projection) === -1) {
                reject(createParamsValidateError('transformTile error:not support projection:' + projection + '.the support:' + SUPPORTPROJECTION.join(',').toString()));
                return;
            }
            if (!maxZoomEnable) {
                reject(createParamsValidateError('transformTile error:maxAvailableZoom is error'));
                return;
            }
            if (!urlTemplate) {
                reject(createParamsValidateError('transformTile error:urlTemplate is error'));
                return;
            }
            if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
                reject(createParamsValidateError('transformTile error:x/y/z is error'));
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
                reject(createParamsValidateError('clipTile error:tile is null.It should be a ImageBitmap'));
                return;
            }
            if (!tileBBOX) {
                reject(createParamsValidateError('clipTile error:tileBBOX is null'));
                return;
            }
            if (!projection) {
                reject(createParamsValidateError('clipTile error:projection is null'));
                return;
            }
            if (!tileSize) {
                reject(createParamsValidateError('clipTile error:tileSize is null'));
                return;
            }
            if (!maskId) {
                reject(createParamsValidateError('clipTile error:maskId is null'));
                return;
            }
            if (!this.maskHasInjected(maskId)) {
                reject(createParamsValidateError('not find mask by maskId:' + maskId));
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

    tileIntersectMask(options: tileIntersectMaskOptions) {
        options = checkOptions(options, 'tileIntersectMask');
        delete (options as unknown as privateOptions).__taskId;
        delete (options as unknown as privateOptions).__workerId;
        const promise = new Promise((resolve: (result: { intersect: boolean }) => void, reject: (error: Error) => void) => {
            const { tileBBOX, maskId } = options;
            if (!tileBBOX) {
                reject(createParamsValidateError('tileIntersectMask error:tileBBOX is null'));
                return;
            }
            if (!maskId) {
                reject(createParamsValidateError('tileIntersectMask error:maskId is null'));
                return;
            }
            if (!this.maskHasInjected(maskId)) {
                reject(createParamsValidateError('not find mask by maskId:' + maskId));
                return;
            }
            const buffers: ArrayBuffer[] = [];
            this.send(options, buffers, (error, result) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    resolve(result);
                }
            });
        });
        wrapPromise(promise, options);
        return promise;
    }

    injectMask(maskId: string, geojsonFeature: GeoJSONPolygon | GeoJSONMultiPolygon) {
        const promise = new Promise((resolve, reject) => {
            if (!maskId) {
                reject(createParamsValidateError('injectMask error:maskId is null'));
                return;
            }
            if (maskMap[maskId]) {
                reject(createParamsValidateError(`injectMask error:${maskId} has injected`));
                return;
            }
            if (!isPolygon(geojsonFeature)) {
                reject(createParamsValidateError('injectMask error:geojsonFeature is not Polygon,It should be GeoJSON Polygon/MultiPolygon'));
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
                reject(createParamsValidateError('removeMask error:maskId is null'));
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
                reject(createParamsValidateError('url is null'));
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
                reject(createParamsValidateError('encodeTerrainTile error:url is null'));
                return;
            }

            if (!terrainType) {
                reject(createParamsValidateError('encodeTerrainTile error:terrainType is null'));
                return;
            }
            if (TerrainTypes.indexOf(terrainType) === -1) {
                reject(createParamsValidateError('encodeTerrainTile error:terrainType:not support the terrainType:' + terrainType));
                return;
            }
            if (terrainType === 'qgis-gray') {
                if (!isNumber(minHeight) || !isNumber(maxHeight) || minHeight > maxHeight) {
                    reject(createParamsValidateError('encodeTerrainTile error:terrainType:qgis-gray,require minHeight/maxHeight should number'));
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
                reject(createParamsValidateError('colorTerrainTile error:tile is not ImageBitMap'));
                return;
            }

            if (!colors || !Array.isArray(colors) || colors.length === 0) {
                reject(createParamsValidateError('colorTerrainTile error:colors is null'));
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

    injectImage(options: injectImageOptions) {
        options = checkOptions(options, 'fetchImage');
        const promise = new Promise((resolve, reject) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { imageId, url, imageBBOX } = options;
            if (!imageId) {
                reject(createParamsValidateError('injectImage error:imageId is null'));
                return;
            }
            if (!url) {
                reject(createParamsValidateError('injectImage error:url is null'));
                return;
            }
            if (this.imageHasInjected(imageId)) {
                reject(createParamsValidateError(`injectImage error:${imageId} has injected`));
                return;
            }
            if (!imageBBOX) {
                reject(createParamsValidateError('injectImage error:imageBBOX is null'));
                return;
            }

            options.url = Util.getAbsoluteURL(url);

            this.send(Object.assign({}, options), [], (error, image) => {
                if (error || (promise as any).canceled) {
                    reject(error || FetchCancelError);
                } else {
                    imageMap[imageId] = {
                        imageBBOX,
                        url,
                        image
                    };
                    resolve(null);
                }
            });
        });
        wrapPromise(promise, {});
        return promise;
    }

    removeImage(imageId: string) {
        const promise = new Promise((resolve, reject) => {
            if (!imageId) {
                reject(createParamsValidateError('removeImage error:imageId is null'));
                return;
            }
            const imageInfo = imageMap[imageId] || {};
            delete imageMap[imageId];
            const image = imageInfo.image;
            disposeImage(image);
            resolve(null);
        });
        wrapPromise(promise, {});
        return promise;
    }

    imageHasInjected(imageId: string) {
        if (!imageId) {
            console.error('imageHasInjected error:imageId is null');
            return false;
        }
        return !!imageMap[imageId];
    }

    getImageTile(options: getImageTileOptions) {
        options = checkOptions(options, 'getImageTile');
        const promise = new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            if (!getCanvas()) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { tileBBOX, projection, imageId } = options;
            if (!tileBBOX) {
                reject(createParamsValidateError('getImageTile error:tileBBOX is null'));
                return;
            }
            if (!imageId) {
                reject(createParamsValidateError('getImageTile error:imageId is null'));
                return;
            }
            if (!projection) {
                reject(createParamsValidateError('getImageTile error:projection is null'));
                return;
            }
            if (!this.imageHasInjected(imageId)) {
                reject(createParamsValidateError('not find image by imageId:' + imageId));
                return;
            }
            const imageInfo = imageMap[imageId];
            const image = imageTile(imageInfo, options);
            resolve(image);
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
