import { registerWorkerAdapter, worker } from 'maptalks';
import WORKERCODE from './dist/worker';
import { isPolygon } from './src/tileclip';

const WORKERNAME = '__maptalks.tileclip';

registerWorkerAdapter(WORKERNAME, WORKERCODE);

const maskMap = {};

class TileActor extends worker.Actor {

    getTile(options = {}) {
        return new Promise((resolve, reject) => {
            options.referrer = options.referrer || document.location.href;
            this.send(Object.assign({}, { _type: 'getTile' }, options), null, (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
    }

    getTileWithMaxZoom(options = {}) {
        return new Promise((resolve, reject) => {
            options.referrer = options.referrer || document.location.href;
            this.send(Object.assign({}, { _type: 'getTileWithMaxZoom' }, options), null, (error, image) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(image);
                }
            });
        });
    }

    clipTile(options = {}) {
        return new Promise((resolve, reject) => {
            const buffers = [];
            if (options.tile && options.tile instanceof ImageBitmap) {
                buffers.push(options.tile);
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

    injectMask(maskId, geojsonFeature) {
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
                resolve();
                maskMap[maskId] = true;
            });
        });
    }

    removeMask(maskId) {
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
                resolve();
                delete maskMap[maskId];
            });
        });
    }

    maskHasInjected(maskId) {
        if (!maskId) {
            console.error('maskId is null');
            return false;
        }
        return !!maskMap[maskId];
    }
}

let actor;

export function getTileActor() {
    if (!actor) {
        actor = new TileActor(WORKERNAME);
    }
    return actor;
}
