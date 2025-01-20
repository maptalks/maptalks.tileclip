import { clipTileOptions, GeoJSONMultiPolygon, GeoJSONPolygon } from './index';
export declare function isPolygon(feature: GeoJSONPolygon | GeoJSONMultiPolygon): boolean;
export declare function isEPSG3857(projection: string): projection is "EPSG:3857";
export declare function injectMask(maskId: string, geojson: GeoJSONPolygon | GeoJSONMultiPolygon): Error | GeoJSONPolygon | GeoJSONMultiPolygon;
export declare function removeMask(maskId: string): void;
export declare function clip(options: clipTileOptions): Promise<unknown>;
