import { bboxInBBOX, bboxIntersect, BBOXtype, getBBOXCenter, pointInBBOX } from "./bbox";
import { clearCanvas, createImageTypeResult, getBlankTile, getCanvas, getCanvasContext, layoutTiles, postProcessingImage, resizeCanvas } from "./canvas";
import { rectifyBaiduTileOptions, rectifyTileOptions } from "./types";
import gcoord from 'gcoord';
import { CancelTaskLRUCache, disposeImage, lnglat2Mercator, toTileItems } from "./util";
import { getTileWithMaxZoom } from "./tileget";
import { FetchCancelError, isFetchDefaultError } from "./Error";

// const debugCenter = [
//     114.6426559419478,
//     38.21552784082945
// ]

const CHINABBOX: BBOXtype = [73.49899865092078, 3.3978889711295124, 135.08738721798764, 53.56131498508575];

function toBaiduMeter(c) {
    return gcoord.transform(c, gcoord.Baidu, gcoord.BD09Meter);
}

function forwordBaidu(c) {
    return gcoord.transform(c, gcoord.BD09Meter, gcoord.Baidu);
}

// function webMercatorTo84(c) {
//     return gcoord.transform(c, gcoord.WebMercator, gcoord.WGS84);
// }

// function wgb84ToBaidu(c) {
//     return gcoord.transform(c, gcoord.WGS1984, gcoord.Baidu);
// }

function baduToWGS84(c) {
    return gcoord.transform(c, gcoord.Baidu, gcoord.WGS84);
}

function transformPixel(image: ImageBitmap, allTilesBBOX: BBOXtype, needTransform: boolean, left: number, top: number, tileSize: number) {
    if (!needTransform) {
        return image;
    }
    //baidu墨卡托bbox
    const [bxmin, bymin, bxmax, bymax] = allTilesBBOX;

    const minpc = [bxmin, bymin], maxpc = [bxmax, bymax];
    const minc = forwordBaidu(minpc);
    const maxc = forwordBaidu(maxpc);

    const c1 = baduToWGS84(minc);
    const c2 = baduToWGS84(maxc);


    //墨卡托米制bbox
    const m1 = lnglat2Mercator(c1);
    const m2 = lnglat2Mercator(c2);

    const [xmin, ymin] = m1 as number[];
    const [xmax, ymax] = m2 as number[];

    const { width, height } = image;

    // const imgData = ctx.getImageData(0, 0, width, height);

    const bax = (bxmax - bxmin) / width;
    const bay = (bymax - bymin) / height;

    // const bax = (bxmax - bxmin) / width;
    const ay = (ymax - ymin) / height;

    const cells = [];
    const cellSize = 8;
    let minY = Infinity, maxY = -Infinity, idx = -1;
    for (let row = 1; row <= height; row += cellSize) {
        const y1 = bymax - (row - 1) * bay;
        const y2 = bymax - (row - 1 - cellSize) * bay;
        for (let col = 1; col <= width; col += cellSize) {
            const x = bxmin + (col - 1) * bax;

            const b1 = forwordBaidu([x, y1]);
            const b2 = forwordBaidu([x, y2]);

            const c1 = baduToWGS84(b1);
            const c2 = baduToWGS84(b2);

            const m1 = lnglat2Mercator(c1);
            const m2 = lnglat2Mercator(c2);

            // const idx = (row - 1) * width * 4 + (col - 1) * 4;
            // const R = imgData.data[idx];
            // const G = imgData.data[idx + 1];
            // const B = imgData.data[idx + 2];
            // const A = imgData.data[idx + 3];

            const px1 = (x - bxmin) / bax;
            const px2 = px1 + cellSize;

            let row1 = (m1[1] - ymin) / ay;
            row1 = Math.round(height - row1);
            let row2 = (m2[1] - ymin) / ay;
            row2 = Math.round(height - row2);
            minY = Math.min(row1, row2, minY);
            maxY = Math.max(row1, row2, maxY);

            const py1 = Math.min(row1, row2);
            const py2 = Math.max(row1, row2);
            cells[++idx] = {
                x1: (col - 1),
                x2: (col - 1) + cellSize,
                y1: (row - 1),
                y2: (row - 1) + cellSize,
                px1,
                px2,
                py1,
                py2,
            };
        }
    }
    const canvas = getCanvas();
    resizeCanvas(canvas, width, height);
    let ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    const offsetY = minY < 0 ? Math.abs(minY) : 0;
    for (let i = 0, len = cells.length; i < len; i++) {
        const { x1, y1, x2, y2, px1, py1, px2, py2 } = cells[i];
        ctx.drawImage(image, x1, y1, x2 - x1, y2 - y1, px1, py1 + offsetY, px2 - px1, py2 - py1);
    }
    disposeImage(image);
    const tempImage = canvas.transferToImageBitmap();
    resizeCanvas(canvas, tileSize, tileSize);
    ctx == getCanvasContext(canvas);
    ctx.drawImage(tempImage, left, top, tileSize, tileSize, 0, 0, tileSize, tileSize);
    disposeImage(tempImage);
    return canvas.transferToImageBitmap();

}

export function tileBaduRectify(options: rectifyBaiduTileOptions) {
    return new Promise((resolve, reject) => {
        const { transform, tileSize, tileBBOX, x, y, z, debug, errorLog, mapZoom } = options;

        const isDebug = () => {
            return false;
            // return (x === 49849 && y === 17899) || (x === 49850 && y === 17899);
        }
        let tiles: Array<[number, number, number]> = [
            [x, y, z]
        ];
        let left = 0, top = 0;
        const needTransform = z > 10;
        let allTilesBBOX: BBOXtype = [0, 0, 0, 0];
        if (needTransform && bboxIntersect(tileBBOX, CHINABBOX)) {
            let center = getBBOXCenter(tileBBOX);
            let targetCenter;
            const to84 = transform === 'BAIDU-WGS84'
            if (to84) {
                targetCenter = gcoord.transform(center, gcoord.WGS1984, gcoord.Baidu);
            } else {
                targetCenter = gcoord.transform(center, gcoord.GCJ02, gcoord.Baidu);
            }
            let [minx, miny, maxx, maxy] = tileBBOX;

            [minx, miny] = toBaiduMeter([minx, miny]);
            [maxx, maxy] = toBaiduMeter([maxx, maxy]);
            center = toBaiduMeter(center);
            targetCenter = toBaiduMeter(targetCenter);

            const dx = (maxx - minx);
            const dy = (maxy - miny);
            const ax = dx / tileSize;
            const ay = dy / tileSize;

            let tx = (targetCenter[0] - center[0]) / ax / tileSize;
            let ty = ((targetCenter[1] - center[1])) / ay / tileSize;

            let offsetx: number, offsety: number;
            const mx = tx >= 0 ? 1 : -1;
            const my = ty >= 0 ? 1 : -1;
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
            targetBBOX[1] = miny + dy * offsety;
            targetBBOX[2] = maxx + dx * offsetx;
            targetBBOX[3] = maxy + dy * offsety;

            if (isDebug()) {
                console.log(offsetx, offsety);
            }

            const px = (targetCenter[0] - targetBBOX[0]) / ax;
            const py = tileSize - (targetCenter[1] - targetBBOX[1]) / ay;

            let needLeft = px < tileSize / 2;
            let needTop = py < tileSize / 2;
            let needRight = px > tileSize / 2;
            let needBottom = py > tileSize / 2;

            left = (needLeft ? tileSize : 0) + ((px - tileSize / 2))
            top = (needTop ? tileSize : 0) + (py - tileSize / 2);

            const targetX = x + offsetx;
            const targetY = y + offsety;

            tiles = [
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
            allTilesBBOX = [...targetBBOX] as BBOXtype;
            allTilesBBOX[0] -= dx;
            allTilesBBOX[2] += dx;
            allTilesBBOX[1] -= dy;
            allTilesBBOX[3] += dy;
            if (!needLeft) {
                tiles = tiles.filter(tile => {
                    const [x] = tile;
                    return x !== targetX - 1;
                });
                allTilesBBOX[0] += dx;
            }
            if (!needTop) {
                tiles = tiles.filter(tile => {
                    const [x, y] = tile;
                    return y !== targetY + 1;
                });
                allTilesBBOX[3] -= dy;
            }
            if (!needRight) {
                tiles = tiles.filter(tile => {
                    const [x] = tile;
                    return x !== targetX + 1;
                });
                allTilesBBOX[2] -= dx;
            }
            if (!needBottom) {
                tiles = tiles.filter(tile => {
                    const [x, y] = tile;
                    return y !== targetY - 1;
                });
                allTilesBBOX[1] += dy;
            }
        }

        const result = {
            loadCount: 0
        }

        const tileItemList = toTileItems(tiles);

        if (isDebug()) {
            console.log(top);
        }

        const end = () => {
            const taskId = (options as any).__taskId;
            if (CancelTaskLRUCache.has(taskId)) {
                reject(FetchCancelError);
                return;
            }
            const image = layoutTiles(tileItemList, debug, true);
            const transformImage = transformPixel(image, allTilesBBOX, needTransform, left, top, tileSize);
            const postImage = postProcessingImage(transformImage, options);
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
            getTileWithMaxZoom(Object.assign({}, options, { x, y, z, forceReturnImage: true, ignorePostProcessing: true, tms: true })).then(image => {
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