export declare function getCanvas(tileSize?: number): OffscreenCanvas;
export declare function resizeCanvas(canvas: OffscreenCanvas, width: number, height: number): void;
export declare function clearCanvas(ctx: OffscreenCanvasRenderingContext2D): void;
export declare function getCanvasContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D;
export declare function getBlankTile(tileSize?: number): ImageBitmap;
export declare function mergeImages(images: Array<ImageBitmap>): Error | ImageBitmap;
export declare function imageClip(canvas: OffscreenCanvas, polygons: any, image: ImageBitmap): ImageBitmap;
export declare function toBlobURL(imagebitmap: ImageBitmap): Promise<Blob>;
export declare function imageFilter(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, filter: string): ImageBitmap;
export declare function imageTileScale(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, dx: number, dy: number, w: number, h: number): ImageBitmap;
export declare function imageOpacity(image: ImageBitmap, opacity?: number): ImageBitmap;
export declare function mergeTiles(tiles: any, debug: boolean): ImageBitmap;
