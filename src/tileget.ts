import { encodeTerrainTileOptions, getTileOptions, getTileWithMaxZoomOptions, getVTTileOptions, layoutTilesOptions, resolveResultType } from './types';
import {
    colorsTerrainTile, createImageTypeResult, getCanvas, getCanvasContext, imageTileScale,
    layoutTiles, mergeTiles, postProcessingImage, resizeCanvas
} from './canvas';
import {
    checkArray, createParamsValidateError, createInnerError, HEADERS, disposeImage,
    createDataError, validateSubdomains, getTileUrl,
    copyArrayBuffer,
    toTileItems,
    allSettled
} from './util';
import { cesiumTerrainToHeights, generateTiandituTerrain, transformQGisGray, transformArcgis, transformMapZen } from './terrain';
import * as lerc from './lerc';
import { VectorTile } from '@mapbox/vector-tile';
import Protobuf from 'pbf';
import vtpbf from 'vt-pbf';
import { fetchTile, fetchTileBuffer } from './tilefetch';

export function getTile(options: getTileOptions) {
    return new Promise((resolve, reject) => {
        const { url } = options;
        const urls = checkArray(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const fetchTiles = urls.map(tileUrl => {
            return fetchTile(tileUrl, headers, options)
        });
        const { globalCompositeOperation } = options;
        allSettled(fetchTiles, urls).then(imagebits => {
            const canvas = getCanvas();
            const image = mergeTiles(imagebits, globalCompositeOperation);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            // const filter = options.filter;
            const postImage = postProcessingImage(image, options);
            createImageTypeResult(canvas, postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }).catch(error => {
            reject(error);
        })
    });
}

export function getTileWithMaxZoom(options: getTileWithMaxZoomOptions) {
    const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, globalCompositeOperation, tms } = options;
    return new Promise((resolve: resolveResultType, reject) => {
        const urlTemplates = checkArray(urlTemplate);
        for (let i = 0, len = urlTemplates.length; i < len; i++) {
            const urlTemplate = urlTemplates[i];
            if (!validateSubdomains(urlTemplate, subdomains)) {
                reject(createParamsValidateError('not find subdomains'));
                return;
            }
        }
        // const isDebug = x === 398789 && y === 143180;
        const isDebug = false;
        let dxScale, dyScale, wScale, hScale;
        let tileX = x, tileY = y, tileZ = z;
        const zoomOffset = z - maxAvailableZoom;
        if (zoomOffset > 0) {
            let px = x, py = y;
            let zoom = z;
            // parent tile
            while (zoom > maxAvailableZoom) {
                px = Math.floor(px / 2);
                py = Math.floor(py / 2)
                zoom--;
            }
            if (isDebug) {
                console.log(px, py);
            }
            const scale = Math.pow(2, zoomOffset);
            // child tiles
            let startX = Math.floor(px * scale);
            let endX = startX + scale;
            let startY = Math.floor(py * scale);
            let endY = startY + scale;
            if (startX > x) {
                startX--;
                endX--;
            }
            if (startY > y) {
                startY--;
                endY--;
            }
            // console.log(startCol, endCol, startRow, endRow);
            dxScale = (x - startX) / (endX - startX);
            dyScale = (y - startY) / (endY - startY);
            if (tms) {
                const ady = 1 / (endY - startY);
                const offsety = endY - y - 1;
                dyScale = offsety * ady;
                if (isDebug) {
                    console.log(offsety);
                }
            }

            if (isDebug) {
                console.log(startY, endY);
                // console.log(startX, endX);
                console.log(dxScale, dyScale);
            }
            wScale = 1 / (endX - startX);
            hScale = 1 / (endY - startY);
            // console.log(dxScale, dyScale, wScale, hScale);
            tileX = px;
            tileY = py;
            tileZ = maxAvailableZoom;
            // console.log(dxScale, dyScale);
        }
        const urls = urlTemplates.map(urlTemplate => {
            return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
        });
        const headers = Object.assign({}, HEADERS, options.headers || {});

        const fetchTiles = urls.map(url => {
            return fetchTile(url, headers, options);
        })

        allSettled(fetchTiles, urls).then(imagebits => {
            // const canvas = getCanvas();
            const image = mergeTiles(imagebits, globalCompositeOperation);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            // const filterImage = imageFilter(canvas, image, options.filter);
            // const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);

            const postImage = postProcessingImage(image, options);
            let sliceImage;
            if (zoomOffset <= 0) {
                sliceImage = postImage;
            } else {
                const { width, height } = postImage;
                const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
                sliceImage = imageTileScale(postImage, dx, dy, w, h);
                // opImage = imageOpacity(imageBitMap, options.opacity);
            }
            createImageTypeResult(getCanvas(), sliceImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }).catch(error => {
            reject(error);
        })
    });

}
export function layout_Tiles(options: layoutTilesOptions) {
    const { urlTemplate, tiles, subdomains, debug } = options;
    return new Promise((resolve, reject) => {
        if (!validateSubdomains(urlTemplate, subdomains)) {
            reject(createParamsValidateError('not find subdomains'));
            return;
        }
        const tileItemList = toTileItems(tiles);

        const urls = tileItemList.map(tile => {
            const { x, y, z } = tile;
            return getTileUrl(urlTemplate, x, y, z, subdomains);
        });
        const headers = Object.assign({}, HEADERS, options.headers || {});

        const fetchTiles = urls.map(url => {
            return fetchTile(url, headers, options);
        })

        allSettled(fetchTiles, urls, true).then(imagebits => {
            imagebits.forEach((image, index) => {
                tileItemList[index].tileImage = image;
            });
            const bigImage = layoutTiles(tileItemList, debug, false);
            const postImage = postProcessingImage(bigImage, options);
            createImageTypeResult(getCanvas(), postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }).catch(error => {
            reject(error);
        })
    });

}

export function encodeTerrainTile(options: encodeTerrainTileOptions) {
    return new Promise((resolve, reject) => {
        const { url } = options;

        const urls = checkArray(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
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
            const fetchTiles = urls.map(tileUrl => {
                return fetchTile(tileUrl, headers, options)
            });
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
            const fetchTiles = urls.map(tileUrl => {
                return fetchTileBuffer(tileUrl, headers, options)
            });
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


export function getVTTile(options: getVTTileOptions) {
    return new Promise((resolve, reject) => {
        const { url } = options;
        const urls = checkArray(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const fetchTiles = urls.map(tileUrl => {
            return fetchTileBuffer(tileUrl, headers, options)
        });
        allSettled(fetchTiles, urls).then(buffers => {
            buffers = buffers.filter(buffer => {
                return !!buffer;
            });
            if (!buffers || buffers.length === 0) {
                reject(createDataError('buffers is null'));
                return;
            }
            if (buffers.length === 1) {
                resolve(copyArrayBuffer(buffers[0]));
            } else {
                const mergeTile = new VectorTile(new Protobuf(buffers[0]));
                buffers.slice(1, Infinity).forEach(buffer => {
                    const tile = new VectorTile(new Protobuf(buffer));
                    Object.assign(mergeTile.layers, tile.layers);
                })
                const data = vtpbf(mergeTile);
                resolve(data.buffer);
            }

        }).catch(error => {
            reject(error);
        })
    });
}