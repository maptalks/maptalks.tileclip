let globalCanvas;

export function getCanvas(tileSize = 256) {
    if (!globalCanvas && OffscreenCanvas) {
        globalCanvas = new OffscreenCanvas(1, 1);
    }
    if (globalCanvas) {
        globalCanvas.width = globalCanvas.height = tileSize;
    }
    return globalCanvas;
}

function clearCanvas(ctx) {
    const canvas = ctx.canvas;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function getCanvasContext(canvas) {
    const ctx = canvas.getContext('2d');
    return ctx;
}

export function getBlankTile(tileSize) {
    const canvas = getCanvas(tileSize);
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    // ctx.fillText('404', 100, 100);
    // ctx.rect(0, 0, canvas.width, canvas.height);
    // ctx.stroke();
    return canvas.transferToImageBitmap();
}

export function imageClip(canvas, polygons, image) {
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

export function toBlobURL(imagebitmap) {
    const canvas = getCanvas();
    canvas.width = imagebitmap.width;
    canvas.height = imagebitmap.height;
    const ctx = getCanvasContext(canvas);
    clearCanvas(ctx);
    ctx.drawImage(imagebitmap, 0, 0);
    return canvas.convertToBlob();
}

export function imageFilter(canvas, imagebitmap, filter) {
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

export function imageTileScale(canvas, imagebitmap, dx, dy, w, h) {
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
