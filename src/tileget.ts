import { encodeTerrainTileOptions, getTileOptions, getTileWithMaxZoomOptions } from './index';
import { getCanvas, getCanvasContext, imageFilter, imageGaussianBlur, imageOpacity, imageTileScale, mergeTiles, resizeCanvas, toBlobURL } from './canvas';
import LRUCache from './LRUCache';
import { isNumber, checkTileUrl, FetchCancelError, FetchTimeoutError, createError, HEADERS, disposeImage } from './util';
import { cesiumTerrainToHeights, generateTiandituTerrain, transformQGisGray, transformArcgis, transformMapZen } from './terrain';
import * as lerc from './lerc';


const tileImageCache = new LRUCache(200, (image) => {
    disposeImage(image);
});
const tileBufferCache = new LRUCache(200, (buffer) => {
    // disposeImage(image);
});

function formatTileUrlBySubdomains(url, subdomains) {
    if (!subdomains || !subdomains.length) {
        return url;
    }
    const len = subdomains.length;
    let index = Math.floor(Math.random() * len);
    index = Math.min(index, len - 1);
    while (url.indexOf('{s}') > -1) {
        url = url.replace('{s}', subdomains[index]);
    }
    return url;
}

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
        const taskId = options.__taskId;
        if (!taskId) {
            reject(createError('taskId is null'));
            return;
        }
        const image = tileImageCache.get(url);
        if (image) {
            copyImageBitMap(image);
        } else {
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
            cacheFetch(taskId, control);
            fetch(url, fetchOptions).then(res => res.blob()).then(blob => createImageBitmap(blob)).then(image => {
                if (options.disableCache !== true) {
                    tileImageCache.add(url, image);
                }
                finishFetch(control);
                copyImageBitMap(image);
            }).catch(error => {
                finishFetch(control);
                reject(error);
            });
        }
    });
}

export function fetchTileBuffer(url: string, headers = {}, options) {
    return new Promise((resolve: (buffer: ArrayBuffer) => void, reject) => {
        const copyBuffer = (buffer: ArrayBuffer) => {
            resolve(buffer);
        };
        const taskId = options.__taskId;
        if (!taskId) {
            reject(createError('taskId is null'));
            return;
        }
        const buffer = tileBufferCache.get(url);
        if (buffer) {
            copyBuffer(buffer);
        } else {
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
            cacheFetch(taskId, control);
            fetch(url, fetchOptions).then(res => res.arrayBuffer()).then(buffer => {
                if (options.disableCache !== true) {
                    tileBufferCache.add(url, buffer);
                }
                finishFetch(control);
                copyBuffer(buffer);
            }).catch(error => {
                finishFetch(control);
                reject(error);
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
        const { returnBlobURL, globalCompositeOperation } = options;
        Promise.all(fetchTiles).then(imagebits => {
            const canvas = getCanvas();
            const image = mergeTiles(imagebits, globalCompositeOperation);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            // const filter = options.filter;
            const filterImage = imageFilter(canvas, image, options.filter);
            const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);

            const opImage = imageOpacity(blurImage, options.opacity);
            if (!returnBlobURL) {
                resolve(opImage);
            } else {
                toBlobURL(opImage).then(blob => {
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                }).catch(error => {
                    reject(error);
                });
            }
        }).catch(error => {
            reject(error);
        })
    });
}

export function getTileWithMaxZoom(options: getTileWithMaxZoomOptions) {
    const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, returnBlobURL, globalCompositeOperation } = options;
    return new Promise((resolve, reject) => {
        const urlTemplates = checkTileUrl(urlTemplate);
        for (let i = 0, len = urlTemplates.length; i < len; i++) {
            const urlTemplate = urlTemplates[i];
            if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
                if (!subdomains || subdomains.length === 0) {
                    reject(createError('not find subdomains'));
                    return;
                }
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
            let key = '{x}';
            while (urlTemplate.indexOf(key) > -1) {
                urlTemplate = urlTemplate.replace(key, tileX as unknown as string);
            }
            key = '{y}';
            while (urlTemplate.indexOf(key) > -1) {
                urlTemplate = urlTemplate.replace(key, tileY as unknown as string);
            }
            key = '{z}';
            while (urlTemplate.indexOf(key) > -1) {
                urlTemplate = urlTemplate.replace(key, tileZ as unknown as string);
            }
            return formatTileUrlBySubdomains(urlTemplate, subdomains);
        });
        const headers = Object.assign({}, HEADERS, options.headers || {});

        const fetchTiles = urls.map(url => {
            return fetchTile(url, headers, options);
        })

        Promise.all(fetchTiles).then(imagebits => {
            const canvas = getCanvas();
            const image = mergeTiles(imagebits, globalCompositeOperation);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            const filterImage = imageFilter(canvas, image, options.filter);
            const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);


            let opImage;
            if (zoomOffset <= 0) {
                opImage = (imageOpacity(blurImage, options.opacity));
            } else {
                const { width, height } = blurImage;
                const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
                const imageBitMap = imageTileScale(canvas, blurImage, dx, dy, w, h);
                opImage = imageOpacity(imageBitMap, options.opacity);
            }
            if (!returnBlobURL) {
                resolve(opImage);
            } else {
                toBlobURL(opImage).then(blob => {
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                }).catch(error => {
                    reject(error);
                });
            }
        }).catch(error => {
            reject(error);
        })
    });

}

export function encodeTerrainTile(url, options: encodeTerrainTileOptions) {
    return new Promise((resolve, reject) => {

        const urls = checkTileUrl(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const { returnBlobURL, terrainWidth, tileSize, terrainType, minHeight, maxHeight } = options;
        const returnImage = (terrainImage: ImageBitmap) => {
            if (!returnBlobURL) {
                resolve(terrainImage);
            } else {
                toBlobURL(terrainImage).then(blob => {
                    const url = URL.createObjectURL(blob);
                    resolve(url);
                }).catch(error => {
                    reject(error);
                });
            }
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
                returnImage(terrainImage);
            }).catch(error => {
                reject(error);
            })
        } else if (isTianditu || isCesium || isArcgis) {
            const fetchTiles = urls.map(tileUrl => {
                return fetchTileBuffer(tileUrl, headers, options)
            });
            Promise.all(fetchTiles).then(buffers => {
                if (!buffers || buffers.length === 0) {
                    reject(createError('buffers is null'));
                    return;
                }
                const buffer = buffers[0];
                if (buffer.byteLength === 0) {
                    reject(createError('buffer is empty'));
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
                    reject(createError('generate terrain data error,not find image data'));
                    return;
                }
                resolve(result.image);
            }).catch(error => {
                reject(error);
            })
        } else {
            reject(createError('not support terrainType:' + terrainType));
        }

    });
}
