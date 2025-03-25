import { clipTileOptions, GeoJSONMultiPolygon, GeoJSONPolygon } from './index';
export declare function injectMask(maskId: string, geojson: GeoJSONPolygon | GeoJSONMultiPolygon): GeoJSONPolygon | GeoJSONMultiPolygon | Error;
export declare function removeMask(maskId: string): void;
export declare function clip(options: clipTileOptions): Promise<unknown>;
