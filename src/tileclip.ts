import geojsonbbox from '@maptalks/geojson-bbox';
import lineclip from 'lineclip';
import { createImageTypeResult, getBlankTile, getCanvas, imageClip } from './canvas';
import { bboxInBBOX, bboxIntersect, BBOXtype } from './bbox';
import { clipBufferOptions, clipTileOptions, GeoJSONMultiPolygon, GeoJSONPolygon, getTileOptions } from './types';
import { lnglat2Mercator, isPolygon, isEPSG3857, isNumber, isString } from './util';
import { getTile } from './tileget';
import { createParamsValidateError } from './Error';

const GeoJSONCache = {};



export function injectMask(maskId: string, geojson: GeoJSONPolygon | GeoJSONMultiPolygon) {
    if (!isPolygon(geojson)) {
        return createParamsValidateError('geojson.feature is not Polygon');
    }
    // if (GeoJSONCache[maskId]) {
    //     return createParamsValidateError('the' + maskId + ' geojson Already exists');
    // }
    GeoJSONCache[maskId] = geojson;
    checkGeoJSONFeatureBBOX(geojson);
    return geojson;
}

export function removeMask(maskId: string) {
    delete GeoJSONCache[maskId];
}

function checkGeoJSONFeatureBBOX(feature: GeoJSONPolygon | GeoJSONMultiPolygon) {
    feature.bbox = feature.bbox || geojsonbbox(feature);
}


function transformCoordinates(projection: string, coordinates) {
    if (!isEPSG3857(projection)) {
        return coordinates;
    } else {
        const transformRing = (coord) => {
            const result = [];
            for (let i = 0, len = coord.length; i < len; i++) {
                const c = coord[i];
                if (Array.isArray(c[0])) {
                    result.push(transformRing(c));
                } else {
                    result[i] = lnglat2Mercator(c);
                }
            }
            return result;
        };
        return transformRing(coordinates);
    }
}

function coordinate2Pixel(tileBBOX: BBOXtype, tileSize: number, coordinate) {
    const [minx, miny, maxx, maxy] = tileBBOX;
    const dx = (maxx - minx), dy = (maxy - miny);
    const ax = dx / tileSize, ay = dy / tileSize;
    const [x, y] = coordinate;
    const px = (x - minx) / ax;
    const py = tileSize - (y - miny) / ay;
    return [px, py];
}

function transformPixels(projection: string, tileBBOX: BBOXtype, tileSize: number, coordinates) {
    const [minx, miny, maxx, maxy] = tileBBOX;
    const transformRing = (coord, bbox) => {
        const result = [];
        for (let i = 0, len = coord.length; i < len; i++) {
            const c = coord[i];
            if (Array.isArray(c[0])) {
                result.push(transformRing(c, bbox));
            } else {
                result[i] = coordinate2Pixel(bbox, tileSize, c);
            }
        }
        return result;
    };
    if (isEPSG3857(projection)) {
        const [mminx, mminy] = lnglat2Mercator([minx, miny]);
        const [mmaxx, mmaxy] = lnglat2Mercator([maxx, maxy]);
        const mTileBBOX = [mminx, mminy, mmaxx, mmaxy];
        return transformRing(coordinates, mTileBBOX);
    } else {
        return transformRing(coordinates, tileBBOX);
    }
}

const validateClipRing = (result) => {
    if (result.length > 0) {
        let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
        for (let j = 0, len1 = result.length; j < len1; j++) {
            const [x, y] = result[j];
            minx = Math.min(x, minx);
            miny = Math.min(y, miny);
            maxx = Math.max(x, maxx);
            maxy = Math.max(y, maxy);
        }
        if (minx !== maxx && miny !== maxy) {
            return true;
        }
    }
    return false;
};

function clipPolygons(polygons, tileBBOX: BBOXtype) {
    const clipRings = [];
    for (let i = 0, len = polygons.length; i < len; i++) {
        const polygon = polygons[i];
        for (let j = 0, len1 = polygon.length; j < len1; j++) {
            const ring = polygon[j];
            const result = lineclip.polygon(ring, tileBBOX);
            if (validateClipRing(result)) {
                clipRings.push([result]);
            }
        }
    }
    return clipRings;
}

export function clip(options: clipTileOptions) {
    return new Promise((resolve, reject) => {
        const { tile, tileBBOX, projection, tileSize, maskId, reverse, bufferSize } = options;
        const feature = GeoJSONCache[maskId];
        // const canvas = getCanvas(tileSize);

        const handler = (tile: ImageBitmap) => {
            const returnImage = (image) => {
                createImageTypeResult(getCanvas(), image, options).then(url => {
                    resolve(url);
                }).catch(error => {
                    reject(error);
                })
            };
            const bbox = feature.bbox;
            if (!bbox) {
                returnImage(tile);
                return;
            }
            const { coordinates, type } = feature.geometry;
            if (!coordinates.length) {
                returnImage(tile);
                return;
            }

            const judgeReverse = () => {
                if (!reverse) {
                    returnImage(getBlankTile(tileSize));
                } else {
                    returnImage(tile);
                }
            }
            if (!bboxIntersect(bbox, tileBBOX)) {
                judgeReverse();
                return;
            }
            let polygons = coordinates;
            if (type === 'Polygon') {
                polygons = [polygons];
            }

            let prjCoordinates, clipBufferOpts: clipBufferOptions;

            const transform = () => {
                if (isNumber(bufferSize) && bufferSize !== 0) {
                    const prjCoordinates = transformCoordinates(projection, polygons);
                    const bufferPixels = transformPixels(projection, tileBBOX, tileSize, prjCoordinates);
                    clipBufferOpts = {
                        bufferSize,
                        polygons: bufferPixels
                    }
                }
            }
            if (bboxInBBOX(bbox, tileBBOX)) {
                prjCoordinates = transformCoordinates(projection, polygons);
                const pixels = transformPixels(projection, tileBBOX, tileSize, prjCoordinates);
                transform();
                const image = imageClip(tileSize, pixels, tile, reverse, clipBufferOpts);
                returnImage(image);
                return;
            }



            const clipRings = clipPolygons(polygons, tileBBOX);
            if (clipRings.length === 0) {
                judgeReverse();
                return;
            }

            prjCoordinates = transformCoordinates(projection, clipRings);
            const pixels = transformPixels(projection, tileBBOX, tileSize, prjCoordinates);
            transform();
            const image = imageClip(tileSize, pixels, tile, reverse, clipBufferOpts);
            returnImage(image);
        }
        if (isString(tile)) {
            const fetchOptions = Object.assign({}, options, { forceReturnImage: true, url: tile }) as unknown as getTileOptions;
            getTile(fetchOptions).then(image => {
                handler(image as ImageBitmap);
            }).catch(error => {
                reject(error);
            })
        } else {
            handler(tile);
        }

    });

}

export function tileBBOXIntersectMask(tileBBOX: BBOXtype, maskId: string) {
    return new Promise((resolve, reject) => {
        const feature = GeoJSONCache[maskId];
        if (!feature) {
            reject(createParamsValidateError('not find mask ,the maskId:' + maskId));
            return;
        }

        const notIntersect = () => {
            resolve({
                intersect: false
            });
            return;
        };

        const beIntersect = () => {
            resolve({
                intersect: true
            });
            return;
        };

        const bbox = feature.bbox;
        if (!bbox) {
            notIntersect();
            return;
        }
        const { coordinates, type } = feature.geometry;
        if (!coordinates.length) {
            notIntersect();
            return;
        }
        if (!bboxIntersect(bbox, tileBBOX)) {
            notIntersect();
            return;
        }

        if (bboxInBBOX(bbox, tileBBOX)) {
            beIntersect();
            return;
        }
        let polygons = coordinates;
        if (type === 'Polygon') {
            polygons = [polygons];
        }
        const clipRings = clipPolygons(polygons, tileBBOX);
        if (clipRings.length === 0) {
            notIntersect();
            return;
        }
        beIntersect();

    })

}
