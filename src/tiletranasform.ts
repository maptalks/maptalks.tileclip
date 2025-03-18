import { getTileWithMaxZoom } from "./tileget";
//@ts-ignore
import { SphericalMercator } from '@mapbox/sphericalmercator';
// import tileCover from '@mapbox/tile-cover';
import { isNumber, lnglat2Mercator } from "./util";
import { clearCanvas, getBlankTile, getCanvas, getCanvasContext, mergeTiles } from "./canvas";
import { bboxOfBBOXList, toBBOX, toPoints } from "./bbox";

const FirstRes = 1.40625, mFirstRes = 156543.03392804097;
const TILESIZE = 256;
const ORIGIN = [-180, 90];
const MORIGIN = [-20037508.342787, 20037508.342787];
const SUPPORTPROJECTION = ['EPSG:4326', 'EPSG:3857'];

const TILE_SIZE = 256;
const merc = new SphericalMercator({
    size: TILE_SIZE,
    // antimeridian: true
});

function get4326Res(zoom: number) {
    return FirstRes / Math.pow(2, zoom);
}

function get3857Res(zoom: number) {
    return mFirstRes / Math.pow(2, zoom);
}


function tile4326BBOX(x, y, z) {
    const [orginX, orginY] = ORIGIN;
    const res = get4326Res(z) * TILESIZE;

    let mincol = x;
    let maxcol = x;
    let minrow = y;
    let maxrow = y;
    mincol = Math.floor(mincol);
    maxcol = Math.floor(maxcol);
    minrow = Math.floor(minrow);
    maxrow = Math.floor(maxrow);

    const xmin = orginX + (mincol) * res;
    const xmax = orginX + (maxcol + 1) * res;
    const ymin = (maxrow) * res - orginY;
    const ymax = (minrow + 1) * res - orginY;
    return [xmin, ymin, xmax, ymax];
}


function cal4326Tiles(x: number, y: number, z: number, zoomOffset = 0) {
    zoomOffset = zoomOffset || 0;
    const [orginX, orginY] = ORIGIN;
    const res = get4326Res(z) * TILESIZE;
    const tileBBOX = merc.bbox(x, y, z);
    const [minx, miny, maxx, maxy] = tileBBOX;
    let mincol = (minx - orginX) / res, maxcol = (maxx - orginX) / res;
    let minrow = (orginY - maxy) / res, maxrow = (orginY - miny) / res;
    mincol = Math.floor(mincol);
    maxcol = Math.floor(maxcol);
    minrow = Math.floor(minrow);
    maxrow = Math.floor(maxrow);
    if (maxcol < mincol || maxrow < minrow) {
        return;
    }
    const tiles: Array<[number, number, number]> = [];
    for (let row = minrow; row <= maxrow; row++) {
        for (let col = mincol; col <= maxcol; col++) {
            tiles.push([col - 1, row, z + zoomOffset]);
        }
    }
    const xmin = orginX + (mincol - 1) * res;
    const xmax = orginX + (maxcol) * res;
    const ymin = (maxrow - 1) * res - orginY;
    const ymax = (minrow) * res - orginY;
    const coordinates: Array<[number, number]> = toPoints(tileBBOX).map(c => {
        return lnglat2Mercator(c) as [number, number];
    })
    return {
        tiles,
        tilesbbox: [xmin, ymin, xmax, ymax],
        bbox: tileBBOX,
        mbbox: toBBOX(coordinates),
        x,
        y,
        z
    };
}

function cal3857Tiles(x: number, y: number, z: number, zoomOffset = 0) {
    zoomOffset = zoomOffset || 0;
    const [orginX, orginY] = MORIGIN;
    const res = get3857Res(z) * TILESIZE;
    const tileBBOX = tile4326BBOX(x, y, z);
    const mbbox = toBBOX(toPoints(tileBBOX as any).map(c => {
        const result = merc.forward(c);
        return result;
    }));
    const [minx, miny, maxx, maxy] = mbbox;
    let mincol = (minx - orginX) / res, maxcol = (maxx - orginX) / res;
    let minrow = (orginY - maxy) / res, maxrow = (orginY - miny) / res;
    mincol = Math.floor(mincol);
    maxcol = Math.floor(maxcol);
    minrow = Math.floor(minrow);
    maxrow = Math.floor(maxrow);
    if (maxcol < mincol || maxrow < minrow) {
        return;
    }
    const tiles: Array<[number, number, number]> = [];
    for (let row = minrow; row <= maxrow; row++) {
        for (let col = mincol; col <= maxcol; col++) {
            tiles.push([col, row, z + zoomOffset]);
        }
    }
    const bboxList = tiles.map(tile => {
        const [x, y, z] = tile;
        return merc.bbox(x, y, z, false, '900913');
    })
    const [xmin, ymin, xmax, ymax] = bboxOfBBOXList(bboxList);

    return {
        tiles,
        tilesbbox: [xmin, ymin, xmax, ymax],
        bbox: tileBBOX,
        mbbox,
        x,
        y,
        z
    };
}


function tilesImageData(image, tilesbbox, tilebbox, projection) {
    const { width, height } = image;
    const [minx, miny, maxx, maxy] = tilesbbox;
    const ax = (maxx - minx) / width, ay = (maxy - miny) / height;

    let [tminx, tminy, tmaxx, tmaxy] = tilebbox;
    // console.log(tilesbbox, tilebbox);
    //buffer one pixel
    tminx -= ax;
    tmaxx += ax;
    tminy -= ay;
    tmaxy += ay;

    let x1 = (tminx - minx) / ax;
    let y1 = (maxy - tmaxy) / ay;
    let x2 = (tmaxx - minx) / ax;
    let y2 = (maxy - tminy) / ay;
    x1 = Math.floor(x1);
    y1 = Math.floor(y1);
    x2 = Math.ceil(x2);
    y2 = Math.ceil(y2);
    // console.log(x1, x2, y1, y2);
    const w = x2 - x1, h = y2 - y1;
    const tileCanvas = getCanvas();
    tileCanvas.width = w;
    tileCanvas.height = h;

    const ctx = getCanvasContext(tileCanvas);
    clearCanvas(ctx);
    ctx.drawImage(image, x1, y1, w, h, 0, 0, w, h);

    const imageData = ctx.getImageData(0, 0, w, h).data;
    const pixels = [];
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    let index = -1;
    const method = projection === 'EPSG:4326' ? merc.forward : merc.inverse;
    for (let row = 1; row <= h; row++) {
        const y = tmaxy - (row - 1) * ay;
        const y1 = y - ay;
        for (let col = 1; col <= w; col++) {
            const idx = (row - 1) * w * 4 + (col - 1) * 4;
            const r = imageData[idx], g = imageData[idx + 1], b = imageData[idx + 2], a = imageData[idx + 3];
            const x = tminx + (col - 1) * ax;
            const coordinates = [x, y];
            const point = method(coordinates as any);
            xmin = Math.min(xmin, point[0]);
            xmax = Math.max(xmax, point[0]);
            ymin = Math.min(ymin, point[1]);
            ymax = Math.max(ymax, point[1]);
            const coordinates1 = [x, y1];
            pixels[++index] = {
                point,
                point1: method(coordinates1 as any),
                r,
                g,
                b,
                a
            };
        }
    }
    return {
        pixels,
        bbox: [xmin, ymin, xmax, ymax],
        width: w,
        height: h,
        // image: tileCanvas.transferToImageBitmap()
        // canvas: tileCanvas
    };
}

function transformTiles(pixelsresult, mbbox) {
    const [xmin, ymin, xmax, ymax] = mbbox;
    const ax = (xmax - xmin) / TILESIZE, ay = (ymax - ymin) / TILESIZE;
    const { pixels, bbox } = pixelsresult;
    const [minx, miny, maxx, maxy] = bbox;
    let width = (maxx - minx) / ax, height = (maxy - miny) / ay;
    width = Math.round(width);
    height = Math.round(height);
    if (isNaN(width) || isNaN(height) || Math.min(width, height) === 0 || Math.abs(width) === Infinity || Math.abs(height) === Infinity) {
        // console.log(width, height, result);
        return;
    }
    const canvas = getCanvas();
    canvas.width = width;
    canvas.height = height;
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);

    function transformPixel(x, y) {
        let col = Math.round((x - minx) / ax + 1);
        col = Math.min(col, width);
        let row = Math.round((maxy - y) / ay + 1);
        row = Math.min(row, height);
        return [col, row];
    }

    const imageData = ctx.createImageData(width, height);
    const data = imageData.data;
    for (let i = 0, len = pixels.length; i < len; i++) {
        const { point, point1, r, g, b, a } = pixels[i];
        const [x1, y1] = point;
        const [x2, y2] = point1;
        const [col1, row1] = transformPixel(x1, y1);
        // eslint-disable-next-line no-unused-vars
        const [col2, row2] = transformPixel(x2, y2);
        for (let j = row1; j <= row2; j++) {
            const idx = (j - 1) * width * 4 + (col1 - 1) * 4;
            data[idx] = r;
            data[idx + 1] = g;
            data[idx + 2] = b;
            data[idx + 3] = a;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    const image = canvas.transferToImageBitmap();
    const px = Math.round((xmin - minx) / ax);
    const py = Math.round((maxy - ymax) / ay);
    const canvas1 = getCanvas();
    canvas.width = TILESIZE;
    canvas.height = TILESIZE;
    const ctx1 = getCanvasContext(canvas);
    clearCanvas(ctx1);
    ctx1.drawImage(image, px - 1, py, TILESIZE, TILESIZE, 0, 0, TILESIZE, TILESIZE);
    // ctx1.textAlign = 'center';
    // ctx1.textBaseline = 'middle';
    // ctx1.fillStyle = 'red';
    // ctx1.fillText('design by deyihu', TILESIZE / 2, TILESIZE / 2);
    return canvas1.transferToImageBitmap();
}




export function tileTransform(options) {
    return new Promise((resolve, reject) => {
        const { urlTemplate, x, y, z, maxAvailableZoom, projection, zoomOffset, errorLog } = options;
        const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
        if (!projection) {
            reject(new Error('not find projection'));
            return;
        }
        if (SUPPORTPROJECTION.indexOf(projection) === -1) {
            reject(new Error('not support projection:' + projection + '.the support:' + SUPPORTPROJECTION.join(',').toString()));
            return;
        }
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
        // if (x < 0 || y < 0) {
        //     resolve(getBlankTile());
        //     return;
        // }

        const loadTiles = () => {
            let result;
            if (projection === 'EPSG:4326') {
                result = cal4326Tiles(x, y, z, zoomOffset || 0);

            } else if (projection === 'EPSG:3857') {
                result = cal3857Tiles(x, y, z, zoomOffset || 0);
            }
            // console.log(result);
            const { tiles } = result || {};
            if (!tiles || tiles.length === 0) {
                resolve(getBlankTile());
                return;
            }
            result.loadCount = 0;
            const loadTile = () => {
                if (result.loadCount >= tiles.length) {
                    const image = mergeTiles(tiles);
                    let image1;
                    if (projection === 'EPSG:4326') {
                        const imageData = tilesImageData(image, result.tilesbbox, result.bbox, projection);
                        image1 = transformTiles(imageData, result.mbbox);
                    } else {
                        const imageData = tilesImageData(image, result.tilesbbox, result.mbbox, projection);
                        image1 = transformTiles(imageData, result.bbox);
                    }
                    resolve(image1 || getBlankTile());
                } else {
                    const tile = tiles[result.loadCount];
                    const [x, y, z] = tile;
                    getTileWithMaxZoom(Object.assign({}, options, { x, y, z })).then(image => {
                        tile.tileImage = image;
                        result.loadCount++;
                        loadTile();
                    }).catch(error => {
                        if (errorLog) {
                            console.error(error);
                        }
                        tile.tileImage = getBlankTile();;
                        result.loadCount++;
                        loadTile();
                    });
                }
            }
            loadTile();
        }
        loadTiles();

    })
}