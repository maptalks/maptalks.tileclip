import { bboxIntersect, bboxToPoints } from "./bbox";
import { getBlankTile, getCanvas, getCanvasContext, mergeTiles } from "./canvas";
import { fetchTile } from "./tilefetch";
import { getImageTileOptions, injectImageOptions } from "./types";
import { allSettled, checkArray, createFetchTileList, isEPSG3857, lnglat2Mercator } from "./util";

export function imageTile(imageInfo, options: getImageTileOptions) {
    const imageBBOX = imageInfo.imageBBOX;
    const image = imageInfo.image;
    const { width, height } = image;
    let { tileBBOX, projection, tileSize } = options;
    const [x1, y1, x2, y2] = imageBBOX;
    const ax = width / (x2 - x1);
    const ay = height / (y2 - y1);
    let [minx, miny, maxx, maxy] = tileBBOX;

    if (isEPSG3857(projection)) {
        minx = Infinity;
        miny = Infinity;
        maxx = -Infinity;
        maxy = -Infinity;
        const points = bboxToPoints(tileBBOX);
        points.forEach(p => {
            const m = lnglat2Mercator(p);
            const [x, y] = m;
            minx = Math.min(x, minx);
            miny = Math.min(y, miny);
            maxx = Math.max(x, maxx);
            maxy = Math.max(y, maxy);
        });
    }
    if (!bboxIntersect(imageBBOX, [minx, miny, maxx, maxy])) {
        return getBlankTile(tileSize);
    }

    let left = (minx - x1) * ax;
    let right = (maxx - x1) * ax;
    let bottom = height - (miny - y1) * ay;
    let top = height - (maxy - y1) * ay;

    left = Math.floor(left);
    bottom = Math.floor(bottom);
    top = Math.floor(top);
    right = Math.floor(right);
    if (right < 0 || left > width || top > height || bottom < 0) {
        return getBlankTile(tileSize);
    }
    if (left === right) {
        right++;
    }
    if (bottom === top) {
        bottom--;
    }
    tileSize = tileSize || 256;
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, left, top, right - left, bottom - top, 0, 0, tileSize, tileSize);
    return canvas.transferToImageBitmap();

}

export function imagetTileFetch(options: injectImageOptions) {
    return new Promise((resolve: (image: ImageBitmap) => void, reject) => {
        const { url } = options;
        const urls = checkArray(url);
        const fetchTiles = createFetchTileList<ImageBitmap>(urls, options, fetchTile);
        allSettled(fetchTiles, urls).then(imagebits => {
            const image = mergeTiles(imagebits);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            resolve(image);
        }).catch(error => {
            reject(error);
        })
    })
}