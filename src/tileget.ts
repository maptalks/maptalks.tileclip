import { encodeTerrainTileOptions, getTileOptions, getTileWithMaxZoomOptions, layoutTilesOptions } from './types';
import { colorsTerrainTile, createImageBlobURL, getCanvas, getCanvasContext, imageTileScale, layoutTiles, mergeTiles, postProcessingImage, resizeCanvas } from './canvas';
import LRUCache from './LRUCache';
import {
    isNumber, checkTileUrl, FetchCancelError, FetchTimeoutError, createParamsValidateError, createInnerError, HEADERS, disposeImage,
    isImageBitmap, createDataError, validateSubdomains, getTileUrl,
    createNetWorkError
} from './util';
import { cesiumTerrainToHeights, generateTiandituTerrain, transformQGisGray, transformArcgis, transformMapZen } from './terrain';
import * as lerc from './lerc';
import { getStoreTile, storeTile } from './store';

const LRUCount = 200;

const tileImageCache = new LRUCache<ImageBitmap>(LRUCount, (image) => {
    disposeImage(image as ImageBitmap);
});
const tileBufferCache = new LRUCache<ArrayBuffer>(LRUCount, (buffer) => {
    buffer = null;
    // disposeImage(image);
});


const CONTROLCACHE: Record<string, Array<AbortController>> = {};

function cacheFetch(taskId: string, control: AbortController) {
    CONTROLCACHE[taskId] = CONTROLCACHE[taskId] || [];
    CONTROLCACHE[taskId].push(control);
}

export function cancelFetch(taskId: string) {
    const controlList = CONTROLCACHE[taskId] || [];
    if (controlList.length) {
        controlList.forEach(control => {
            control.abort(FetchCancelError);
        });
    }
    delete CONTROLCACHE[taskId];
}

function finishFetch(control: AbortController) {
    const deletekeys = [];
    for (let key in CONTROLCACHE) {
        const controlList = CONTROLCACHE[key] || [];
        if (controlList.length) {
            const index = controlList.indexOf(control);
            if (index > -1) {
                controlList.splice(index, 1);
            }
        }
        if (controlList.length === 0) {
            deletekeys.push(key);
        }
    }
    deletekeys.forEach(key => {
        delete CONTROLCACHE[key];
    });

}

function generateFetchOptions(headers, options) {
    const fetchOptions = options.fetchOptions || {
        headers,
        referrer: options.referrer
    };
    const timeout = options.timeout || 0;
    const control = new AbortController();
    const signal = control.signal;
    if (timeout && isNumber(timeout) && timeout > 0) {
        setTimeout(() => {
            control.abort(FetchTimeoutError);
        }, timeout);
    }
    fetchOptions.signal = signal;
    delete fetchOptions.timeout;
    return {
        fetchOptions,
        control
    }
}

export function fetchTile(url: string, headers = {}, options) {
    // console.log(abortControlCache);
    return new Promise((resolve: (image: ImageBitmap) => void, reject) => {
        const copyImageBitMap = (image: ImageBitmap) => {
            createImageBitmap(image).then(imagebit => {
                resolve(imagebit);
            }).catch(error => {
                reject(error);
            });
        };
        if (isImageBitmap(url)) {
            copyImageBitMap(url as unknown as ImageBitmap);
            return;
        }
        const { indexedDBCache } = options;

        const fetchTileData = () => {
            const taskId = options.__taskId;
            if (!taskId) {
                reject(createInnerError('taskId is null'));
                return;
            }
            const image = tileImageCache.get(url);
            if (image) {
                copyImageBitMap(image);
            } else {
                const { fetchOptions, control } = generateFetchOptions(headers, options);
                cacheFetch(taskId, control);
                fetch(url, fetchOptions).then(res => {
                    if (!res.ok) {
                        reject(createNetWorkError(url))
                    }
                    return res.blob();
                }).then(blob => createImageBitmap(blob)).then(image => {
                    if (options.disableCache !== true) {
                        tileImageCache.add(url, image);
                    }
                    if (indexedDBCache) {
                        storeTile(url, image);
                    }
                    finishFetch(control);
                    copyImageBitMap(image);
                }).catch(error => {
                    finishFetch(control);
                    reject(error);
                });
            }
        }
        if (!indexedDBCache) {
            fetchTileData();
            return;
        }
        getStoreTile(url).then(image => {
            if (image && indexedDBCache) {
                copyImageBitMap(image as ImageBitmap);
            } else {
                fetchTileData();
            }
        }).catch(() => {

        });

    });
}

export function fetchTileBuffer(url: string, headers = {}, options) {
    return new Promise((resolve: (buffer: ArrayBuffer) => void, reject) => {
        const copyBuffer = (buffer: ArrayBuffer) => {
            resolve(buffer);
        };
        const taskId = options.__taskId;
        if (!taskId) {
            reject(createInnerError('taskId is null'));
            return;
        }
        const buffer = tileBufferCache.get(url);
        if (buffer) {
            copyBuffer(buffer);
        } else {
            const { indexedDBCache } = options;
            const fetchTileData = () => {
                const { fetchOptions, control } = generateFetchOptions(headers, options);
                cacheFetch(taskId, control);
                fetch(url, fetchOptions).then(res => {
                    if (!res.ok) {
                        reject(createNetWorkError(url))
                    }
                    return res.arrayBuffer();
                }).then(buffer => {
                    if (options.disableCache !== true) {
                        tileBufferCache.add(url, buffer);
                    }
                    finishFetch(control);
                    if (indexedDBCache) {
                        storeTile(url, buffer);
                    }
                    copyBuffer(buffer);
                }).catch(error => {
                    finishFetch(control);
                    reject(error);
                });
            }
            if (!indexedDBCache) {
                fetchTileData();
                return;
            }

            getStoreTile(url).then(buffer => {
                if (buffer && indexedDBCache) {
                    copyBuffer(buffer as ArrayBuffer);
                } else {
                    fetchTileData();
                }
            }).catch(() => {

            });
        }
    });

}

export function getTile(url, options: getTileOptions) {
    return new Promise((resolve, reject) => {
        const urls = checkTileUrl(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const fetchTiles = urls.map(tileUrl => {
            return fetchTile(tileUrl, headers, options)
        });
        const { globalCompositeOperation } = options;
        Promise.all(fetchTiles).then(imagebits => {
            const canvas = getCanvas();
            const image = mergeTiles(imagebits, globalCompositeOperation);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            // const filter = options.filter;
            const postImage = postProcessingImage(image, options);
            createImageBlobURL(canvas, postImage, options).then(url => {
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
    const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, globalCompositeOperation } = options;
    return new Promise((resolve, reject) => {
        const urlTemplates = checkTileUrl(urlTemplate);
        for (let i = 0, len = urlTemplates.length; i < len; i++) {
            const urlTemplate = urlTemplates[i];
            if (!validateSubdomains(urlTemplate, subdomains)) {
                reject(createParamsValidateError('not find subdomains'));
                return;
            }
        }
        let dxScale, dyScale, wScale, hScale;
        let tileX = x, tileY = y, tileZ = z;
        const zoomOffset = z - maxAvailableZoom;
        if (zoomOffset > 0) {
            let px = x, py = y;
            let zoom = z;
            // parent tile
            while (zoom > maxAvailableZoom) {
                px = Math.floor(px / 2);
                py = Math.floor(py / 2);
                zoom--;
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
            wScale = 1 / (endX - startX);
            hScale = 1 / (endY - startY);
            // console.log(dxScale, dyScale, wScale, hScale);
            tileX = px;
            tileY = py;
            tileZ = maxAvailableZoom;
        }
        const urls = urlTemplates.map(urlTemplate => {
            return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
        });
        const headers = Object.assign({}, HEADERS, options.headers || {});

        const fetchTiles = urls.map(url => {
            return fetchTile(url, headers, options);
        })

        Promise.all(fetchTiles).then(imagebits => {
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
            createImageBlobURL(getCanvas(), sliceImage, options).then(url => {
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

        const urls = tiles.map(tile => {
            const [tileX, tileY, tileZ] = tile;
            return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
        });
        const headers = Object.assign({}, HEADERS, options.headers || {});

        const fetchTiles = urls.map(url => {
            return fetchTile(url, headers, options);
        })

        Promise.all(fetchTiles).then(imagebits => {
            imagebits.forEach((image, index) => {
                (tiles[index] as any).tileImage = image;
            });
            const bigImage = layoutTiles(tiles, debug);
            const postImage = postProcessingImage(bigImage, options);
            createImageBlobURL(getCanvas(), postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }).catch(error => {
            reject(error);
        })
    });

}

export function encodeTerrainTile(url, options: encodeTerrainTileOptions) {
    return new Promise((resolve, reject) => {

        const urls = checkTileUrl(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const { terrainWidth, tileSize, terrainType, minHeight, maxHeight, terrainColors } = options;
        const returnImage = (terrainImage: ImageBitmap) => {
            createImageBlobURL(getCanvas(), terrainImage, options).then(url => {
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
            Promise.all(fetchTiles).then(imagebits => {
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
                returnImage(colorsTerrainTile(terrainColors, terrainImage));
            }).catch(error => {
                reject(error);
            })
        } else if (isTianditu || isCesium || isArcgis) {
            const fetchTiles = urls.map(tileUrl => {
                return fetchTileBuffer(tileUrl, headers, options)
            });
            Promise.all(fetchTiles).then(buffers => {
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