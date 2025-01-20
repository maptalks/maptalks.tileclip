export declare function getCanvas(tileSize?: number): OffscreenCanvas;
export declare function getCanvasContext(canvas: OffscreenCanvas): OffscreenCanvasRenderingContext2D;
export declare function getBlankTile(tileSize?: number): ImageBitmap;
export declare function mergeTiles(images: Array<ImageBitmap>): ImageBitmap | Error;
export declare function imageClip(canvas: OffscreenCanvas, polygons: any, image: any): ImageBitmap;
export declare function toBlobURL(imagebitmap: ImageBitmap): Promise<Blob>;
export declare function imageFilter(canvas: OffscreenCanvas, imagebitmap: ImageBitmap, filter: string): ImageBitmap;
export declare function imageTileScale(canvas: any, imagebitmap: any, dx: any, dy: any, w: any, h: any): any;
