import { isNumber } from "./util";

let globalCanvas: OffscreenCanvas;

export function getCanvas(tileSize = 256) {
    if (!globalCanvas && OffscreenCanvas) {
        globalCanvas = new OffscreenCanvas(1, 1);
    }
    if (globalCanvas) {
        globalCanvas.width = globalCanvas.height = tileSize;
    }
    return globalCanvas;
}

function clearCanvas(ctx: OffscreenCanvasRenderingContext2D) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function getCanvasContext(canvas: OffscreenCanvas) {
    const ctx = canvas.getContext('2d');
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

export function mergeTiles(images: Array<ImageBitmap>) {
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
    canvas.width = imagebitmap.width;
    canvas.height = imagebitmap.height;
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.drawImage(imagebitmap, 0, 0);
    return canvas.convertToBlob();
}

export function imageFilter(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, filter: string) {
    if (!filter) {
        return imagebitmap;
    }
    canvas.width = imagebitmap.width;
    canvas.height = imagebitmap.height;
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
    canvas.width = imagebitmap.width;
    canvas.height = imagebitmap.height;
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
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.globalAlpha = opacity;
    ctx.drawImage(image, 0, 0);
    const bitImage = canvas.transferToImageBitmap();
    ctx.globalAlpha = 1;
    return bitImage;
}
