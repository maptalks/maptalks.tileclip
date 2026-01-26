import {
    getTileOptions, getTileWithMaxZoomOptions,
    layoutTilesOptions, resolveResultType
} from './types';
import {
    createImageTypeResult, getCanvas, imageTileScale,
    layoutTiles, mergeTiles, postProcessingImage
} from './canvas';
import {
    checkArray,
    getTileUrl,
    toTileItems,
    allSettled,
    createFetchTileList,
    createUrlTemplateFun
} from './util';
import { fetchTile } from './tilefetch';
export function getTile(options: getTileOptions) {
    return new Promise((resolve, reject) => {
        const { url } = options;
        const urls = checkArray(url);
        const fetchTiles = createFetchTileList<ImageBitmap>(urls, options, fetchTile);
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
    const { x, y, z, maxAvailableZoom, subdomains, globalCompositeOperation, tms } = options;
    let urlTemplate = options.urlTemplate;
    urlTemplate = createUrlTemplateFun(urlTemplate as string);
    return new Promise((resolve: resolveResultType, reject) => {
        const urlTemplates = checkArray(urlTemplate);
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

        let urls;
        try {
            urls = urlTemplates.map(urlTemplate => {
                return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
            });
        } catch (error) {
            console.error(error);
            reject(error);
            return;

        }
        const fetchTiles = createFetchTileList<ImageBitmap>(urls, options, fetchTile);
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
    const { tiles, subdomains, debug } = options;
    let urlTemplate = options.urlTemplate;
    urlTemplate = createUrlTemplateFun(urlTemplate as string)[0];
    return new Promise((resolve, reject) => {
        const tileItemList = toTileItems(tiles);

        let urls;
        try {
            urls = tileItemList.map(tile => {
                const { x, y, z } = tile;
                return getTileUrl(urlTemplate, x, y, z, subdomains);
            });
        } catch (error) {
            console.error(error);
            reject(error);
            return;
        }

        const fetchTiles = createFetchTileList<ImageBitmap>(urls, options, fetchTile);

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