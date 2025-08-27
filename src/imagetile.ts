import { bboxIntersect, bboxToPoints } from "./bbox";
import { getBlankTile, getCanvas, getCanvasContext } from "./canvas";
import { getImageTileOptions, injectImageOptions } from "./types";
import { createNetWorkError, isEPSG3857, lnglat2Mercator } from "./util";

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
        return getBlankTile();
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
        return getBlankTile();
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
        const { url, headers } = options;
        const fetchOptions = options.fetchOptions || {
            headers,
            referrer: options.referrer
        };

        fetch(url, fetchOptions).then(res => {
            if (!res.ok) {
                reject(createNetWorkError(url))
            }
            return res.blob();
        }).then(blob => createImageBitmap(blob)).then(image => {
            resolve(image);
        }).catch(error => {
            reject(error);
        });
    })
}