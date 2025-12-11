import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import vtpbf from 'vt-pbf';
import { fetchTileBuffer } from './tilefetch';
import { getVTTileOptions } from "./types";

import {
    copyArrayBuffer,
    checkArray,
    allSettled,
    createDataError,
    createFetchTileList
} from './util';


function pointArrayToNumberArray(points) {
    if (Array.isArray(points)) {
        const result = [];
        for (let i = 0, len = points.length; i < len; i++) {
            result[i] = (pointArrayToNumberArray(points[i]));
        }
        return result;
    } else {
        return [points.x, points.y];
    }
}

function mergeVTTile(buffers: ArrayBuffer[]): ArrayBuffer {
    if (buffers.length === 1) {
        return copyArrayBuffer(buffers[0]);
    }
    const mergeTile = new VectorTile(new Protobuf(buffers[0]));
    buffers.slice(1, Infinity).forEach(buffer => {
        const tile = new VectorTile(new Protobuf(buffer));
        Object.assign(mergeTile.layers, tile.layers);
    })
    const data = vtpbf(mergeTile);
    return data.buffer;
}

function toGeoJSONVTStruct(customPropertiesFun: Function, buffer: ArrayBuffer) {
    const vtTile = new VectorTile(new Protobuf(buffer));
    const layers = vtTile.layers || {};
    const layerMap: Record<string, any> = {};
    for (const layerName in layers) {
        const layer = layers[layerName];
        const len = layer.length;
        const features = [];
        for (let i = 0; i < len; i++) {
            const feature = layer.feature(i);
            customPropertiesFun(layerName, layer, feature, i);
            const array = pointArrayToNumberArray(feature.loadGeometry());
            const flatFeature = {
                geometry: array,
                tags: feature.properties || {},
                type: feature.type
            }
            features.push(flatFeature);
        }
        const tile = { features };
        layerMap[layerName] = tile;
    }
    return layerMap;
}

function vtCustomProperties(customPropertiesFun: Function, buffers: ArrayBuffer[]): ArrayBuffer {
    if (!customPropertiesFun) {
        return mergeVTTile(buffers);
    }
    try {
        const mergeLayerMap = {};
        buffers.forEach(buffer => {
            Object.assign(mergeLayerMap, toGeoJSONVTStruct(customPropertiesFun, buffer));
        });
        const data = vtpbf.fromGeojsonVt(mergeLayerMap);
        return data.buffer;
    } catch (error) {
        console.error('run customProperties error:', error);
        // console.error(error);
        return mergeVTTile(buffers);
    }
}


export function getVTTile(options: getVTTileOptions) {
    return new Promise((resolve, reject) => {
        const { url, customProperties } = options;
        const urls = checkArray(url);
        const fetchTiles = createFetchTileList<ArrayBuffer>(urls, options, fetchTileBuffer);
        let customPropertiesFun;
        if (customProperties) {
            customPropertiesFun = new Function('layerName', 'layer', 'feature', 'featureIndex', customProperties as unknown as string);
        }
        allSettled(fetchTiles, urls).then(buffers => {
            buffers = buffers.filter(buffer => {
                return !!buffer;
            });
            if (!buffers || buffers.length === 0) {
                reject(createDataError('buffers is empty'));
                return;
            }
            const buffer = vtCustomProperties(customPropertiesFun, buffers);
            resolve(buffer);

        }).catch(error => {
            reject(error);
        })
    });
}