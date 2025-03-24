import { getTileOptions, getTileWithMaxZoomOptions } from './index';
import { getCanvas, imageFilter, imageOpacity, imageTileScale, mergeImages, toBlobURL } from './canvas';
import LRUCache from './LRUCache';
import { isNumber, checkTileUrl, CANVAS_ERROR_MESSAGE, FetchCancelError, FetchTimeoutError } from './util';

const HEADERS = {
    'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
};

const tileCache = new LRUCache(200, (image) => {
    if (image && image.close) {
        image.close();
    }
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

function fetchTile(url: string, headers = {}, options) {
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
            reject(new Error('taskId is null'));
            return;
        }
        const image = tileCache.get(url);
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
                tileCache.add(url, image);
                finishFetch(control);
                copyImageBitMap(image);
            }).catch(error => {
                finishFetch(control);
                reject(error);
            });
        }
    });
}

export function getTile(url, options: getTileOptions) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject(new Error('url is null'));
            return;
        }
        const urls = checkTileUrl(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const fetchTiles = urls.map(tileUrl => {
            return fetchTile(tileUrl, headers, options)
        });
        const { returnBlobURL } = options;
        Promise.all(fetchTiles).then(imagebits => {
            const canvas = getCanvas();
            if (!canvas) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const image = mergeImages(imagebits);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            const filter = options.filter;
            let tileImage;
            if (filter) {
                tileImage = imageFilter(canvas, image, filter);
            } else {
                tileImage = image;
            }

            const opImage = imageOpacity(tileImage, options.opacity);
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
    const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, returnBlobURL } = options;
    const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
    return new Promise((resolve, reject) => {
        if (!maxZoomEnable) {
            reject(new Error('maxAvailableZoom is error'));
            return;
        }
        if (!urlTemplate) {
            reject(new Error('urlTemplate is error'));
            return;
        }
        if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
            reject(new Error('x/y/z is error'));
            return;
        }
        const urlTemplates = checkTileUrl(urlTemplate);
        for (let i = 0, len = urlTemplates.length; i < len; i++) {
            const urlTemplate = urlTemplates[i];
            if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
                if (!subdomains || subdomains.length === 0) {
                    reject(new Error('not find subdomains'));
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
            if (!canvas) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }

            const mergeImage = mergeImages(imagebits);
            if (mergeImage instanceof Error) {
                reject(mergeImage);
                return;
            }
            let image;
            const filter = options.filter;
            if (filter) {
                image = (imageFilter(canvas, mergeImage, filter));
            } else {
                image = mergeImage;
            }
            let opImage;
            if (zoomOffset <= 0) {
                opImage = (imageOpacity(image, options.opacity));
            } else {
                const { width, height } = image;
                const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
                const imageBitMap = imageTileScale(canvas, image, dx, dy, w, h);
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
