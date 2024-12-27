import { getCanvas, imageFilter, imageTileScale } from './canvas';
import LRUCache from './LRUCache';

const CANVAS_ERROR_MESSAGE = new Error('not find canvas.The current environment does not support OffscreenCanvas');

const HEADERS = {
    'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
};

function isNumber(value) {
    return typeof value === 'number';
}

const tileCache = new LRUCache(200, (image) => {
    if (image && image.close) {
        image.close();
    }
});

function fetchTile(url, headers = {}, options) {
    return new Promise((resolve, reject) => {
        const copyImageBitMap = (image) => {
            createImageBitmap(image).then(imagebit => {
                resolve(imagebit);
            }).catch(error => {
                reject(error);
            });
        };
        const image = tileCache.get(url);
        if (image) {
            copyImageBitMap(image);
        } else {
            const fetchOptions = options.fetchOptions || {
                headers,
                referrer: options.referrer
            };
            fetch(url, fetchOptions).then(res => res.blob()).then(blob => createImageBitmap(blob)).then(image => {
                tileCache.add(url, image);
                copyImageBitMap(image);
            }).catch(error => {
                reject(error);
            });
        }
    });
}

export function getTile(url, options = {}) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject(new Error('url is null'));
            return;
        }
        const headers = Object.assign({}, HEADERS, options.headers || {});
        fetchTile(url, headers, options).then(imagebit => {
            const filter = options.filter;
            if (filter) {
                const canvas = getCanvas();
                if (!canvas) {
                    reject(CANVAS_ERROR_MESSAGE);
                } else {
                    resolve(imageFilter(canvas, imagebit, filter));
                }
            } else {
                resolve(imagebit);
            }
        }).catch(error => {
            reject(error);
        });
    });
}

export function getTileWithMaxZoom(options = {}) {
    const { urlTemplate, x, y, z, maxAvailableZoom } = options;
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
        const url = urlTemplate.replace('{x}', tileX).replace('{y}', tileY).replace('{z}', tileZ);
        const headers = Object.assign({}, HEADERS, options.headers || {});

        fetchTile(url, headers, options).then(imagebit => {
            let image;
            const filter = options.filter;
            if (filter) {
                const canvas = getCanvas();
                if (!canvas) {
                    reject(CANVAS_ERROR_MESSAGE);
                    return;
                } else {
                    image = (imageFilter(canvas, imagebit, filter));
                }
            } else {
                image = imagebit;
            }
            if (zoomOffset <= 0) {
                resolve(image);
                return;
            }
            const canvas = getCanvas();
            if (!canvas) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const { width, height } = image;
            const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
            const imageBitMap = imageTileScale(canvas, image, dx, dy, w, h);
            resolve(imageBitMap);
        }).catch(error => {
            reject(error);
        });
    });

}
