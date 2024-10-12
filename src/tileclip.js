import geojsonbbox from '@maptalks/geojson-bbox';
import lineclip from 'lineclip';
import { getBlankTile, getCanvas, imageClip } from './cavnas';
import { bboxInBBOX, bboxIntersect } from './bbox';

const GeoJSONCache = {};

export function isPolygon(feature) {
    if (!feature) {
        return false;
    }
    const geometry = feature.geometry || {};
    const type = geometry.type;
    return type === 'Polygon' || type === 'MultiPolygon';
}

export function is3857(projection) {
    return projection === 'EPSG:3857';
}

export function injectMask(maskId, geojson) {
    if (!isPolygon(geojson)) {
        return new Error('geojson.feature is not Polygon');
    }
    if (GeoJSONCache[maskId]) {
        return new Error('the' + maskId + ' geojson Already exists');
    }
    GeoJSONCache[maskId] = geojson;
    checkGeoJSONFeatureBBOX(geojson);
    return geojson;
}

export function removeMask(maskId) {
    delete GeoJSONCache[maskId];
}

function checkGeoJSONFeatureBBOX(feature) {
    feature.bbox = feature.bbox || geojsonbbox(feature);
}

function lnglat2Mercator(coordinates) {
    const [lng, lat] = coordinates;
    const earthRad = 6378137.0;
    const x = lng * Math.PI / 180 * earthRad;
    const a = lat * Math.PI / 180;
    const y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
    return [x, y];
}

function transformCoordinates(projection, coordinates) {
    if (!is3857(projection)) {
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

function coordinate2Pixel(tileBBOX, tileSize, coordinate) {
    const [minx, miny, maxx, maxy] = tileBBOX;
    const dx = (maxx - minx), dy = (maxy - miny);
    const ax = dx / tileSize, ay = dy / tileSize;
    const [x, y] = coordinate;
    const px = (x - minx) / ax;
    const py = tileSize - (y - miny) / ay;
    return [px, py];
}

function transformPixels(projection, tileBBOX, tileSize, coordinates) {
    const [minx, miny, maxx, maxy] = tileBBOX;
    if (is3857(projection)) {
        const [mminx, mminy] = lnglat2Mercator([minx, miny]);
        const [mmaxx, mmaxy] = lnglat2Mercator([maxx, maxy]);
        const mTileBBOX = [mminx, mminy, mmaxx, mmaxy];
        const transformRing = (coord) => {
            const result = [];
            for (let i = 0, len = coord.length; i < len; i++) {
                const c = coord[i];
                if (Array.isArray(c[0])) {
                    result.push(transformRing(c));
                } else {
                    result[i] = coordinate2Pixel(mTileBBOX, tileSize, c);
                }
            }
            return result;
        };
        return transformRing(coordinates);
    }
}

export function clip(options = {}) {
    const { tile, tileBBOX, projection, tileSize, maskId } = options;
    if (!tile) {
        return new Error('tile is null.It should be a ImageBitmap');
    }
    if (!tileBBOX) {
        return new Error('tileBBOX is null');
    }
    if (!projection) {
        return new Error('projection is null');
    }
    if (!tileSize) {
        return new Error('tileSize is null');
    }
    if (!maskId) {
        return new Error('maskId is null');
    }
    const polygon = GeoJSONCache[maskId];
    if (!polygon) {
        return new Error('not find mask by maskId:' + maskId);
    }
    const canvas = getCanvas(tileSize);
    if (!canvas) {
        return new Error('not find canvas.The current environment does not support OffscreenCanvas');
    }
    const feature = GeoJSONCache[maskId];
    const bbox = feature.bbox;
    if (!bboxIntersect(bbox, tileBBOX)) {
        return getBlankTile();
    }
    const { coordinates, type } = polygon.geometry;
    let polygons = coordinates;
    if (type === 'Polygon') {
        polygons = [polygons];
    }

    let newCoordinates;
    if (bboxInBBOX(bbox, tileBBOX)) {
        newCoordinates = transformCoordinates(projection, polygons);
        const pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
        const image = imageClip(canvas, pixels, tile);
        return image;
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
    if (clipRings.length === 0) {
        return getBlankTile();
    }

    newCoordinates = transformCoordinates(projection, clipRings);
    const pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
    const image = imageClip(canvas, pixels, tile);
    return image;
}