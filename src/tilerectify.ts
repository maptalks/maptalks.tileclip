import { getBBOXCenter, pointInBBOX } from "./bbox";
import { createImageTypeResult, getBlankTile, getCanvas, getCanvasContext, layoutTiles, postProcessingImage, resizeCanvas } from "./canvas";
import { rectifyTileOptions } from "./types";
import gcoord from 'gcoord';
import { CancelTaskLRUCache, FetchCancelError, isEPSG3857, isFetchDefaultError, lnglat2Mercator, toTileItems } from "./util";
import { getTileWithMaxZoom } from "./tileget";

const debugCenter = [116.3388992615747, 39.897968400218986];

export function tileRectify(options: rectifyTileOptions) {
    return new Promise((resolve, reject) => {
        const { transform, tileSize, tileBBOX, x, y, z, projection, debug, errorLog, mapZoom } = options;
        let center = getBBOXCenter(tileBBOX);
        let targetCenter;
        if (transform === 'GCJ02-WGS84') {
            targetCenter = gcoord.transform(center, gcoord.WGS84, gcoord.GCJ02);
        } else if (transform === 'WGS84-GCJ02') {
            targetCenter = gcoord.transform(center, gcoord.GCJ02, gcoord.WGS84);
        }
        let [minx, miny, maxx, maxy] = tileBBOX;
        if (isEPSG3857(projection)) {
            [minx, miny] = lnglat2Mercator([minx, miny]);
            [maxx, maxy] = lnglat2Mercator([maxx, maxy]);
            targetCenter = lnglat2Mercator(targetCenter);
            center = lnglat2Mercator(center) as [number, number];
        }

        const dx = (maxx - minx), dy = (maxy - miny);
        const ax = dx / tileSize;
        const ay = dy / tileSize;

        let tx = (targetCenter[0] - center[0]) / ax / tileSize;
        let ty = ((targetCenter[1] - center[1])) / ay / tileSize;

        const isDebugTile = () => {
            return pointInBBOX(debugCenter as [number, number], tileBBOX) && z === Math.round(mapZoom);
        }

        let offsetx: number, offsety: number;
        const mx = tx >= 0 ? 1 : -1;
        const my = ty >= 0 ? -1 : 1;
        //同一个瓦片内
        if (Math.abs(tx) <= 0.5) {
            offsetx = 0;
        } else {
            offsetx = Math.abs(tx) - 0.5;
            offsetx = Math.ceil(offsetx);
            offsetx *= mx;
        }
        //同一个瓦片内
        if (Math.abs(ty) <= 0.5) {
            offsety = 0;
        } else {
            offsety = Math.abs(ty) - 0.5;
            offsety = Math.ceil(offsety);
            offsety *= my;
        }
        const targetBBOX = [];

        targetBBOX[0] = minx + dx * offsetx;
        targetBBOX[1] = miny + dy * -offsety;
        targetBBOX[2] = maxx + dx * offsetx;
        targetBBOX[3] = maxy + dy * -offsety;

        const px = (targetCenter[0] - targetBBOX[0]) / ax;
        const py = tileSize - (targetCenter[1] - targetBBOX[1]) / ay;

        const needLeft = px < tileSize / 2;
        const needTop = py < tileSize / 2;
        const needRight = px > tileSize / 2;
        const needBottom = py > tileSize / 2;

        const left = (needLeft ? tileSize : 0) + ((px - tileSize / 2))
        const top = (needTop ? tileSize : 0) + (py - tileSize / 2);

        const targetX = x + offsetx;
        const targetY = y + offsety;

        let tiles: Array<[number, number, number]> = [
            [targetX - 1, targetY - 1, z],
            [targetX, targetY - 1, z],
            [targetX + 1, targetY - 1, z],
            [targetX - 1, targetY, z],
            [targetX, targetY, z],
            [targetX + 1, targetY, z],
            [targetX - 1, targetY + 1, z],
            [targetX, targetY + 1, z],
            [targetX + 1, targetY + 1, z]
        ];
        if (!needLeft) {
            tiles = tiles.filter(tile => {
                const [x] = tile;
                return x !== targetX - 1;
            });
        }
        if (!needTop) {
            tiles = tiles.filter(tile => {
                const [x, y] = tile;
                return y !== targetY - 1;
            });
        }
        if (!needRight) {
            tiles = tiles.filter(tile => {
                const [x] = tile;
                return x !== targetX + 1;
            });
        }
        if (!needBottom) {
            tiles = tiles.filter(tile => {
                const [x, y] = tile;
                return y !== targetY + 1;
            });
        }


        // if (isDebugTile()) {
        //     console.log(tx, ty);
        //     console.log(offsetx, offsety);
        //     console.log(px, py);
        //     console.log('..........')
        // }

        const result = {
            loadCount: 0
        }

        const tileItemList = toTileItems(tiles);

        const end = () => {
            const taskId = (options as any).__taskId;
            if (CancelTaskLRUCache.has(taskId)) {
                reject(FetchCancelError);
                return;
            }
            const image = layoutTiles(tileItemList, debug);
            const canvas = getCanvas(tileSize);
            const ctx = getCanvasContext(canvas);
            ctx.drawImage(image, left, top, tileSize, tileSize, 0, 0, tileSize, tileSize);
            const sliceImage = canvas.transferToImageBitmap();
            const postImage = postProcessingImage(sliceImage, options);
            createImageTypeResult(getCanvas(), postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }

        const isEnd = () => {
            return result.loadCount >= tileItemList.length;
        }
        tileItemList.forEach(tile => {
            const { x, y, z } = tile;
            getTileWithMaxZoom(Object.assign({}, options, { x, y, z, forceReturnImage: true, ignorePostProcessing: true })).then(image => {
                tile.tileImage = image as ImageBitmap;
                result.loadCount++;
                if (isEnd()) {
                    end();
                }
            }).catch(error => {
                if (errorLog) {
                    console.error(error);
                }
                if (isFetchDefaultError(error)) {
                    reject(FetchCancelError);
                    return;
                }
                tile.tileImage = getBlankTile(tileSize);;
                result.loadCount++;
                if (isEnd()) {
                    end();
                }
            })
        });
    });
}