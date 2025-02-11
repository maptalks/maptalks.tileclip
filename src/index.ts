import { registerWorkerAdapter, worker } from 'maptalks';
//@ts-ignore
import WORKERCODE from './worker/worker.bundle.js';
import { isPolygon } from './tileclip';
import { BBOXtype } from './bbox';

const WORKERNAME = '__maptalks.tileclip';

registerWorkerAdapter(WORKERNAME, WORKERCODE as unknown as string);

const maskMap = {};

export type getTileOptions = {
    url: string | Array<string>;
    referrer?: string;
    filter?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    opacity?: number;
}

export type getTileWithMaxZoomOptions = Omit<getTileOptions, 'url'> & {
    urlTemplate: string | Array<string>;
    maxAvailableZoom: number;
    x: number;
    y: number;
    z: number;
}

export type clipTileOptions = {
    tile: ImageBitmap;
    tileBBOX: BBOXtype;
    projection: string;
    tileSize: number;
    maskId: string;
    returnBlobURL?: boolean;
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

class TileActor extends worker.Actor {

    getTile(options: getTileOptions) {
        options = Object.assign({}, options);
        return new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            options.referrer = options.referrer || document.location.href;
            this.send(Object.assign({}, { _type: 'getTile' }, options), [], (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
    }

    getTileWithMaxZoom(options: getTileWithMaxZoomOptions) {
        options = Object.assign({}, options);
        return new Promise((resolve: (image: ImageBitmap) => void, reject: (error: Error) => void) => {
            options.referrer = options.referrer || document.location.href;
            this.send(Object.assign({}, { _type: 'getTileWithMaxZoom' }, options), [], (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
    }

    clipTile(options: clipTileOptions) {
        options = Object.assign({}, options);
        return new Promise((resolve: (image: ImageBitmap | string) => void, reject: (error: Error) => void) => {
            const buffers: ArrayBuffer[] = [];
            if (options.tile && options.tile instanceof ImageBitmap) {
                buffers.push(options.tile as unknown as ArrayBuffer);
            }
            this.send(Object.assign({}, { _type: 'clipTile' }, options), buffers, (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
    }

    injectMask(maskId: string, geojsonFeature: GeoJSONPolygon | GeoJSONMultiPolygon) {
        return new Promise((resolve, reject) => {
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
    }

    removeMask(maskId: string) {
        return new Promise((resolve, reject) => {
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
