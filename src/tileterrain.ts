import { colorsTerrainTile, createImageTypeResult, getCanvas, postProcessingImage, mergeTiles, resizeCanvas, getCanvasContext } from "./canvas";
import { getTile } from "./tileget";
import { colorTerrainTileOptions, encodeTerrainTileOptions, getTileOptions } from "./types";
import { cesiumTerrainToHeights, generateTiandituTerrain, transformQGisGray, transformArcgis, transformMapZen } from './terrain';
import * as lerc from './lerc';
import {
    checkArray,
    allSettled,
    isString,
    disposeImage,
    createFetchTileList
} from './util';
import { fetchTile, fetchTileBuffer } from './tilefetch';
import { createDataError, createInnerError, createParamsValidateError } from "./Error";


export function encodeTerrainTile(options: encodeTerrainTileOptions) {
    return new Promise((resolve, reject) => {
        const { url } = options;

        const urls = checkArray(url);
        const { terrainWidth, tileSize, terrainType, minHeight, maxHeight, terrainColors } = options;
        const returnImage = (terrainImage: ImageBitmap) => {
            createImageTypeResult(getCanvas(), terrainImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        };
        const isMapZen = terrainType === 'mapzen', isGQIS = terrainType === 'qgis-gray',
            isTianditu = terrainType === 'tianditu',
            isCesium = terrainType === 'cesium', isArcgis = terrainType === 'arcgis';
        if (isMapZen || isGQIS) {
            const fetchTiles = createFetchTileList<ImageBitmap>(urls, options, fetchTile);
            allSettled(fetchTiles, urls).then(imagebits => {
                const canvas = getCanvas();
                const image = mergeTiles(imagebits);
                if (image instanceof Error) {
                    reject(image);
                    return;
                }
                resizeCanvas(canvas, image.width, image.height);
                const ctx = getCanvasContext(canvas);
                ctx.drawImage(image, 0, 0);
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                if (isMapZen) {
                    transformMapZen(imageData);
                } else {
                    transformQGisGray(imageData, minHeight, maxHeight);
                }
                ctx.putImageData(imageData, 0, 0);
                const terrainImage = canvas.transferToImageBitmap();
                disposeImage(image);
                returnImage(colorsTerrainTile(terrainColors, terrainImage));
            }).catch(error => {
                reject(error);
            })
        } else if (isTianditu || isCesium || isArcgis) {
            const fetchTiles = createFetchTileList<ArrayBuffer>(urls, options, fetchTileBuffer);
            allSettled(fetchTiles, urls).then(buffers => {
                if (!buffers || buffers.length === 0) {
                    reject(createDataError('buffers is null'));
                    return;
                }
                const buffer = buffers[0];
                if (buffer.byteLength === 0) {
                    reject(createDataError('buffer is empty'));
                    return;
                }
                let result;
                if (isTianditu) {
                    result = generateTiandituTerrain(buffer, terrainWidth, tileSize);
                } else if (isCesium) {
                    result = cesiumTerrainToHeights(buffer, terrainWidth, tileSize);
                } else if (isArcgis) {
                    result = lerc.decode(buffer);
                    result.image = transformArcgis(result);
                }
                if (!result || !result.image) {
                    reject(createInnerError('generate terrain data error,not find image data'));
                    return;
                }
                returnImage(colorsTerrainTile(terrainColors, result.image));
            }).catch(error => {
                reject(error);
            })
        } else {
            reject(createParamsValidateError('not support terrainType:' + terrainType));
        }

    });
}


export function terrainTileColors(options: colorTerrainTileOptions) {
    return new Promise((resolve, reject) => {
        const { tile, colors } = options;

        const handler = (image: ImageBitmap) => {
            const tileImage = colorsTerrainTile(colors, image);
            const postImage = postProcessingImage(tileImage, options);
            createImageTypeResult(getCanvas(), postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
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


