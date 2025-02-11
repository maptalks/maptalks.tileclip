import { worker } from 'maptalks';
import { BBOXtype } from './bbox';
export type getTileOptions = {
    url: string | Array<string>;
    referrer?: string;
    filter?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    opacity?: number;
};
export type getTileWithMaxZoomOptions = Omit<getTileOptions, 'url'> & {
    urlTemplate: string | Array<string>;
    maxAvailableZoom: number;
    x: number;
    y: number;
    z: number;
};
export type clipTileOptions = {
    tile: ImageBitmap;
    tileBBOX: BBOXtype;
    projection: string;
    tileSize: number;
    maskId: string;
    returnBlobURL?: boolean;
};
export type GeoJSONPolygon = {
    type: 'Feature';
    geometry: {
        type: 'Polygon';
        coordinates: number[][][];
    };
    properties?: Record<string, any>;
    bbox?: BBOXtype;
};
export type GeoJSONMultiPolygon = {
    type: 'Feature';
    geometry: {
        type: 'MultiPolygon';
        coordinates: number[][][][];
    };
    properties?: Record<string, any>;
    bbox?: BBOXtype;
};
declare class TileActor extends worker.Actor {
    getTile(options: getTileOptions): Promise<ImageBitmap>;
    getTileWithMaxZoom(options: getTileWithMaxZoomOptions): Promise<ImageBitmap>;
    clipTile(options: clipTileOptions): Promise<string | ImageBitmap>;
    injectMask(maskId: string, geojsonFeature: GeoJSONPolygon | GeoJSONMultiPolygon): Promise<unknown>;
    removeMask(maskId: string): Promise<unknown>;
    maskHasInjected(maskId: string): boolean;
}
export declare function getTileActor(): TileActor;
export {};
