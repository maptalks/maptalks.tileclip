import { clipBufferOptions } from "./types";
import { createDataError, disposeImage, isImageBitmap, isNumber, rgb2Height } from "./util";
import glur from 'glur';
import { ColorIn } from 'colorin';

let globalCanvas: OffscreenCanvas;

export function getCanvas(tileSize = 256) {
    if (!globalCanvas && OffscreenCanvas) {
        globalCanvas = new OffscreenCanvas(1, 1);
    }
    if (globalCanvas) {
        resizeCanvas(globalCanvas, tileSize, tileSize);
    }
    return globalCanvas;
}

export function resizeCanvas(canvas: OffscreenCanvas, width: number, height: number) {
    if (canvas) {
        canvas.width = width;
        canvas.height = height;
    }

}

export function clearCanvas(ctx: OffscreenCanvasRenderingContext2D) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function getCanvasContext(canvas: OffscreenCanvas) {
    const ctx = canvas.getContext('2d', {
        willReadFrequently: true
    });
    clearCanvas(ctx);
    return ctx;
}

export function getBlankTile(tileSize?: number) {
    const canvas = getCanvas(tileSize);
    getCanvasContext(canvas);
    return canvas.transferToImageBitmap();
}

export function get404Tile(tileSize?: number) {
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'gray';
    ctx.font = "bold 24px serif";
    ctx.fillText('404', canvas.width / 2, canvas.height / 2)
    return canvas.transferToImageBitmap();
}

export function mergeTiles(images: Array<ImageBitmap>, globalCompositeOperation?: GlobalCompositeOperation) {
    if (images.length === 1) {
        return images[0];
    }
    if (images.length === 0) {
        return createDataError('merge tiles error,not find imagebitmaps');
    }
    for (let i = 0, len = images.length; i < len; i++) {
        const image = images[i];
        if (!isImageBitmap(image)) {
            return createDataError('merge tiles error,images not imagebitmap');
        }
    }
    const tileSize = images[0].width;
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    if (globalCompositeOperation) {
        ctx.save();
        ctx.globalCompositeOperation = globalCompositeOperation;
    }
    images.forEach(image => {
        ctx.drawImage(image, 0, 0, tileSize, tileSize);
    });
    if (globalCompositeOperation) {
        ctx.restore();
    }
    disposeImage(images);
    return canvas.transferToImageBitmap();
}

function drawPolygons(ctx: OffscreenCanvasRenderingContext2D, polygons: number[][][][]) {
    const drawPolygon = (polygon: number[][][]) => {
        for (let i = 0, len = polygon.length; i < len; i++) {
            const ring = polygon[i];
            const first = ring[0], last = ring[ring.length - 1];
            const [x1, y1] = first;
            const [x2, y2] = last;
            if (x1 !== x2 || y1 !== y2) {
                ring.push(first);
            }
            for (let j = 0, len1 = ring.length; j < len1; j++) {
                const [x, y] = ring[j];
                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
        }
    };
    polygons.forEach(polygon => {
        drawPolygon(polygon);
    });
}



export function imageClip(tileSize: number, polygons: number[][][][], image: ImageBitmap, reverse: boolean, clipBufferOpts?: clipBufferOptions) {
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    const bufferPixels = [];
    const { width, height } = canvas;
    const imageWidth = image.width;
    const imageHeight = image.height;
    if (clipBufferOpts) {
        const { polygons, bufferSize } = clipBufferOpts;
        ctx.save();
        ctx.beginPath();
        ctx.lineWidth = bufferSize * 2;
        ctx.lineJoin = "round";
        ctx.strokeStyle = 'black';
        //draw black border

        drawPolygons(ctx, polygons);
        ctx.stroke();
        ctx.restore();

        const imageData = ctx.getImageData(0, 0, width, height);
        clearCanvas(ctx);

        ctx.drawImage(image, 0, 0);

        const imageData1 = ctx.getImageData(0, 0, width, height);

        let idx = -1;
        //record black pixel
        const data = imageData1.data;
        for (let i = 0, len = imageData.data.length; i < len; i += 4) {
            const a = imageData.data[i + 3];
            if (a > 0) {
                const R = data[i], G = data[i + 1], B = data[i + 2], A = data[i + 3];
                bufferPixels[++idx] = [i, R, G, B, A];
            }
        }
    }
    clearCanvas(ctx);
    ctx.save();
    ctx.beginPath();
    if (reverse) {
        ctx.rect(0, 0, width, height);
    }
    drawPolygons(ctx, polygons);
    ctx.clip('evenodd');
    ctx.drawImage(image, 0, 0, width, height);
    if (bufferPixels.length) {
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        for (let i = 0, len = bufferPixels.length; i < len; i++) {
            const [idx, R, G, B, A] = bufferPixels[i];
            data[idx] = R;
            data[idx + 1] = G;
            data[idx + 2] = B;
            data[idx + 3] = A;
        }
        ctx.putImageData(imageData, 0, 0);
    }
    let bitImage = canvas.transferToImageBitmap();
    ctx.restore();
    disposeImage(image);
    if (canvas.width === imageWidth && canvas.height === imageHeight) {
        return bitImage;
    }

    resizeCanvas(canvas, imageWidth, imageHeight);
    const ctx1 = getCanvasContext(canvas);
    ctx1.drawImage(bitImage, 0, 0, imageWidth, imageHeight);
    disposeImage(bitImage);
    return canvas.transferToImageBitmap();
}

function toBlobURL(image: ImageBitmap) {
    const canvas = getCanvas();
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    disposeImage(image);
    return canvas.convertToBlob();
}

function imageFilter(image: ImageBitmap, filter: string) {
    if (!filter) {
        return image;
    }
    const canvas = getCanvas(image.width);
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    ctx.save();
    ctx.filter = filter;
    ctx.drawImage(image, 0, 0);
    ctx.restore();
    const bitImage = canvas.transferToImageBitmap();
    disposeImage(image);
    return bitImage;
}


function imageGaussianBlur(image: ImageBitmap, radius: number) {
    if (!isNumber(radius) || radius <= 0) {
        return image;
    }
    const canvas = getCanvas(image.width);
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    glur(imageData.data, canvas.width, canvas.height, radius);
    ctx.putImageData(imageData, 0, 0);
    const bitImage = canvas.transferToImageBitmap();
    disposeImage(image);
    return bitImage;
}

export function imageTileScale(image: ImageBitmap, dx: number, dy: number, w: number, h: number) {
    const canvas = getCanvas(image.width);
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    ctx.save();

    // console.log(dx,dy,w,h);
    ctx.drawImage(image, dx, dy, w, h, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const bitImage = canvas.transferToImageBitmap();
    disposeImage(image);
    return bitImage;
}

function imageOpacity(image: ImageBitmap, opacity = 1) {
    if (!isNumber(opacity) || opacity === 1 || opacity < 0 || opacity > 1) {
        return image;
    }
    const canvas = getCanvas();
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, 0, 0);
    const bitImage = canvas.transferToImageBitmap();
    ctx.globalAlpha = 1;
    disposeImage(image);
    return bitImage;
}


export function layoutTiles(tiles, debug: boolean) {
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    let tileSize = 256;
    tiles.forEach(tile => {
        const [x, y] = tile;
        minx = Math.min(x, minx);
        miny = Math.min(y, miny);
        maxx = Math.max(x, maxx);
        maxy = Math.max(y, maxy);
        tileSize = tile.tileImage.width;
    });
    const width = (maxx - minx + 1) * tileSize;
    const height = (maxy - miny + 1) * tileSize;
    const canvas = getCanvas();
    resizeCanvas(canvas, width, height);
    const ctx = getCanvasContext(canvas);
    if (debug) {
        ctx.font = "bold 28px serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'red';
        ctx.strokeStyle = 'red'
    }
    tiles.forEach(tile => {
        const [x, y, z] = tile;
        const dx = (x - minx) * tileSize;
        const dy = (y - miny) * tileSize;
        let tileImage = tile.tileImage;
        ctx.drawImage(tileImage, dx, dy, tileSize, tileSize);
        if (debug) {
            ctx.rect(dx, dy, tileSize, tileSize);
            ctx.stroke();
            ctx.fillText([x, y, z].join('_').toString(), dx + 100, dy + 100);
        }

    });
    disposeImage(tiles.map(tile => {
        return tile.tileImage;
    }))
    return canvas.transferToImageBitmap();
}

function imageMosaic(image: ImageBitmap, mosaicSize?: number) {
    if (!isNumber(mosaicSize)) {
        return image;
    }
    mosaicSize = Math.ceil(mosaicSize);
    if (mosaicSize < 2) {
        return image;
    }
    const { width, height } = image;
    const canvas = getCanvas(width);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const blur = Math.min(mosaicSize, width, height);
    const cols = Math.ceil(width / blur);
    const rows = Math.ceil(height / blur);


    let col = 1;
    let row = 1;
    const rects = [];
    let idx = -1;
    while (col <= cols) {
        while (row <= rows) {
            const x1 = (col - 1) * blur + 1;
            const y1 = (row - 1) * blur + 1;
            const x2 = Math.min(x1 + blur - 1, width);
            const y2 = Math.min(y1 + blur - 1, height);
            rects[++idx] = [x1, y1, x2, y2];
            row++;
        }
        row = 1;
        col++;
    }
    for (let i = 0, len = rects.length; i < len; i++) {
        const rect = rects[i];
        const [x1, y1, x2, y2] = rect;
        const idxList = [];
        let index = -1;
        let r = 0, g = 0, b = 0, a = 0;
        for (let y = y1; y <= y2; y++) {
            for (let x = x1; x <= x2; x++) {
                const idx = (y - 1) * width * 4 + (x - 1) * 4;
                idxList[++index] = idx;
                const R = data[idx];
                const G = data[idx + 1];
                const B = data[idx + 2];
                const A = data[idx + 3];
                r += R;
                g += G;
                b += B;
                a += A;
            }
        }
        const len1 = idxList.length;
        const ra = Math.round(r / len1);
        const ga = Math.round(g / len1);
        const ba = Math.round(b / len1);
        const aa = Math.round(a / len1);
        for (let j = 0; j < len1; j++) {
            const idx = idxList[j];
            data[idx] = ra;
            data[idx + 1] = ga;
            data[idx + 2] = ba;
            data[idx + 3] = aa;

        }
    }
    ctx.putImageData(imgData, 0, 0);
    disposeImage(image);
    return canvas.transferToImageBitmap();

}

function imageOldPhoto(image: ImageBitmap, oldPhoto: boolean) {
    if (!oldPhoto) {
        return image;
    }
    const { width, height } = image;
    const canvas = getCanvas();
    resizeCanvas(canvas, width, height);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data

    for (var i = 0; i < data.length; i += 4) {
        const r = data[i + 0]
        const g = data[i + 1]
        const b = data[i + 2]

        data[i + 0] = r * 0.28 + g * 0.72 + b * 0.22
        data[i + 1] = r * 0.25 + g * 0.63 + b * 0.13
        data[i + 2] = r * 0.17 + g * 0.66 + b * 0.13
    }

    ctx.putImageData(imageData, 0, 0);
    const bitImage = canvas.transferToImageBitmap();
    disposeImage(image);
    return bitImage;
}


export function postProcessingImage(image: ImageBitmap, options) {
    const filterImage = imageFilter(image, options.filter);
    const blurImage = imageGaussianBlur(filterImage, options.gaussianBlurRadius);
    const opImage = imageOpacity(blurImage, options.opacity);
    const oldImage = imageOldPhoto(opImage, options.oldPhoto);
    const mosaicImage = imageMosaic(oldImage, options.mosaicSize);
    return mosaicImage;
}


export function createImageBlobURL(image: ImageBitmap, returnBlobURL: boolean) {
    return new Promise((resolve: (image: ImageBitmap | string) => void, reject) => {
        if (!returnBlobURL) {
            resolve(image);
        } else {
            toBlobURL(image).then(blob => {
                const url = URL.createObjectURL(blob);
                resolve(url);
            }).catch(error => {
                reject(error);
            });
        }
    })
}

const colorInCache = new Map();

export function colorsTerrainTile(colors, image: ImageBitmap) {
    if (!colors || !Array.isArray(colors) || colors.length < 2) {
        return image;
    }
    const key = JSON.stringify(colors);
    let ci = colorInCache.get(key);
    if (!ci) {
        ci = new ColorIn(colors);
        colorInCache.set(key, ci);
    }
    const { width, height } = image;
    const canvas = getCanvas();
    resizeCanvas(canvas, width, height);
    const ctx = getCanvasContext(canvas);
    ctx.drawImage(image, 0, 0);
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
        const R = data[i];
        const G = data[i + 1];
        const B = data[i + 2];
        const A = data[i + 3];
        if (A === 0) {
            data[i] = 0;
            data[i + 1] = 0;
            data[i + 2] = 0;
        } else {
            const height = rgb2Height(R, G, B);
            const [r, g, b, a] = ci.getColor(height);
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    }
    ctx.putImageData(imageData, 0, 0);
    disposeImage(image);
    return canvas.transferToImageBitmap();
}
