import { clearCanvas, getCanvas, getCanvasContext, imageFilter, imageOpacity, mergeImages, resizeCanvas } from "./canvas";
import { getTileOptions } from "./index";
import { fetchTile } from "./tileget";
import { checkTileUrl, createError, HEADERS, CANVAS_ERROR_MESSAGE, uuid } from "./util";

const SIZE = 512;

export function imageSlicing(options: getTileOptions) {
    (options as any).disableCache = true;
    return new Promise((resolve, reject) => {
        const { url } = options;
        if (!url) {
            reject(createError('url is null'));
            return;
        }
        const urls = checkTileUrl(url);
        const headers = Object.assign({}, HEADERS, options.headers || {});
        const fetchTiles = urls.map(tileUrl => {
            return fetchTile(tileUrl, headers, options)
        });
        Promise.all(fetchTiles).then(imagebits => {
            const canvas = getCanvas(SIZE);
            if (!canvas) {
                reject(CANVAS_ERROR_MESSAGE);
                return;
            }
            const image = mergeImages(imagebits);
            if (image instanceof Error) {
                reject(image);
                return;
            }
            const { width, height } = image;
            const rows = Math.ceil(height / SIZE);
            const cols = Math.ceil(width / SIZE);
            const items = [];
            for (let row = 1; row <= rows; row++) {
                const y1 = (row - 1) * SIZE;
                const y2 = Math.min(height, row * SIZE);
                for (let col = 1; col <= cols; col++) {
                    const x1 = (col - 1) * SIZE;
                    const x2 = Math.min(width, col * SIZE);
                    const w = x2 - x1, h = y2 - y1;
                    resizeCanvas(canvas, w, h);
                    const ctx = getCanvasContext(canvas);
                    ctx.drawImage(image, x1, y1, w, h, 0, 0, canvas.width, canvas.height);
                    const tempImage = canvas.transferToImageBitmap();
                    const filter = options.filter;
                    let tileImage;
                    if (filter) {
                        tileImage = imageFilter(canvas, tempImage, filter);
                    } else {
                        tileImage = tempImage;
                    }
                    const opImage = imageOpacity(tileImage, options.opacity);
                    items.push({
                        id: uuid(),
                        x: x1,
                        y: y1,
                        width: w,
                        height: h,
                        row,
                        col,
                        image: opImage
                    })
                }
            }
            const result = {
                rows,
                cols,
                rowWidth: SIZE,
                colsHeight: SIZE,
                width,
                height,
                items
            }
            if (image && image.close) {
                image.close();
            }
            resolve(result);
        }).catch(error => {
            reject(error);
        })
    });
}

export function imageToBlobURL(options) {
    return new Promise((resolve, reject) => {
        const debug = options.debug;
        const items = options.items;
        const workerId = options._workerId;
        const temp = [];
        const isEnd = () => {
            return temp.length === items.length;
        }
        items.forEach((item, index) => {
            const canvas = new OffscreenCanvas(item.width, item.height);
            const ctx = getCanvasContext(canvas);
            ctx.drawImage(item.image, 0, 0);
            if (debug) {
                console.log('workerId:' + workerId + ',image to blob url :' + (index + 1) + '/' + items.length);
            }
            canvas.convertToBlob().then(blob => {
                const url = URL.createObjectURL(blob);
                item.url = url;
                temp.push(1);
                delete item.image;
                if (isEnd()) {
                    resolve(items);
                }
            }).catch(error => {
                console.error(error);
                reject(error);
            })
        });
    });
}