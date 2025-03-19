import { toPoints } from "./bbox";
import { isNumber, lnglat2Mercator } from "./util";

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
    return ctx;
}

export function getBlankTile(tileSize?: number) {
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    // ctx.fillText('404', 100, 100);
    // ctx.rect(0, 0, canvas.width, canvas.height);
    // ctx.stroke();
    return canvas.transferToImageBitmap();
}

export function mergeImages(images: Array<ImageBitmap>) {
    if (images.length === 1) {
        return images[0];
    }
    if (images.length === 0) {
        return new Error('merge tiles error,not find imagebitmaps');
    }
    for (let i = 0, len = images.length; i < len; i++) {
        const image = images[i];
        if (!(image instanceof ImageBitmap)) {
            return new Error('merge tiles error,images not imagebitmap');
        }
    }
    const tileSize = images[0].width;
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    images.forEach(image => {
        ctx.drawImage(image, 0, 0, tileSize, tileSize);
    });
    return canvas.transferToImageBitmap();
}



export function imageClip(canvas: OffscreenCanvas, polygons, image: ImageBitmap) {
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.save();

    const drawPolygon = (rings) => {
        for (let i = 0, len = rings.length; i < len; i++) {
            const ring = rings[i];
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
    ctx.beginPath();
    polygons.forEach(polygon => {
        drawPolygon(polygon);
    });
    ctx.clip('evenodd');
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    const bitImage = canvas.transferToImageBitmap();
    ctx.restore();
    return bitImage;
}

export function toBlobURL(imagebitmap: ImageBitmap) {
    const canvas = getCanvas();
    resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.drawImage(imagebitmap, 0, 0);
    return canvas.convertToBlob();
}

export function imageFilter(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, filter: string) {
    if (!filter) {
        return imagebitmap;
    }
    resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.save();
    ctx.filter = filter;
    ctx.drawImage(imagebitmap, 0, 0);
    ctx.restore();
    const bitImage = canvas.transferToImageBitmap();
    return bitImage;
}

export function imageTileScale(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, dx: number, dy: number, w: number, h: number) {
    resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.save();

    // console.log(dx,dy,w,h);
    ctx.drawImage(imagebitmap, dx, dy, w, h, 0, 0, canvas.width, canvas.height);
    ctx.restore();
    const bitImage = canvas.transferToImageBitmap();
    return bitImage;
}

export function imageOpacity(image: ImageBitmap, opacity = 1) {
    if (!isNumber(opacity) || opacity === 1 || opacity < 0 || opacity > 1) {
        return image;
    }
    const canvas = getCanvas();
    resizeCanvas(canvas, image.width, image.height);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, 0, 0);
    const bitImage = canvas.transferToImageBitmap();
    ctx.globalAlpha = 1;
    return bitImage;
}


export function mergeTiles(tiles, debug: boolean) {
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
    clearCanvas(ctx);
    if (debug) {
        ctx.font = "bold 48px serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'red';
    }
    tiles.forEach(tile => {
        const [x, y, z] = tile;
        const dx = (x - minx) * tileSize;
        const dy = (y - miny) * tileSize;
        let tileImage = tile.tileImage;
        ctx.drawImage(tileImage, dx, dy, tileSize, tileSize);
        if (debug) {
            ctx.fillText([x, y, z].join('_').toString(), dx + 100, dy + 100);
        }

    });
    return canvas.transferToImageBitmap();
}

// export function clipTile(result, image) {
//     const { tilesbbox, mbbox } = result;
//     // console.log(bbox, tilembbox);
//     const coordinates = toPoints(tilesbbox);
//     const mCoordinates = coordinates.map(c => {
//         let [x, y] = c;
//         x = Math.min(x, 180);
//         x = Math.max(-180, x);
//         y = Math.max(-85, y);
//         y = Math.min(85, y);

//         const mc = lnglat2Mercator([x, y]);
//         console.log(c, mc);
//         return mc;
//     });
//     let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
//     mCoordinates.forEach(c => {
//         const [x, y] = c;
//         // console.log(x,y);
//         minx = Math.min(x, minx);
//         miny = Math.min(y, miny);
//         maxx = Math.max(x, maxx);
//         maxy = Math.max(y, maxy);
//     });
//     const ax = image.width / (maxx - minx);
//     const ay = image.height / (maxy - miny);
//     // console.log(miny, maxy, ay);
//     // console.log(ax, ay);
//     const [x1, y1, x2, y2] = mbbox;
//     const px1 = Math.floor((x1 - minx) * ax);
//     const px2 = Math.floor((x2 - minx) * ax);
//     const py2 = Math.floor(image.height - (y1 - miny) * ay);
//     const py1 = Math.floor(image.height - (y2 - miny) * ay);
//     const w = px2 - px1, h = py2 - py1;
//     // console.log(px1, px2, py1, py2, w, h);
//     const canvas = getCanvas();
//     const ctx = getCanvasContext(canvas);
//     clearCanvas(ctx);
//     ctx.drawImage(image, px1, py1, w, h, 0, 0, canvas.width, canvas.height);
//     return canvas.transferToImageBitmap();
// }