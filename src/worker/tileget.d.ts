import { getTileOptions, getTileWithMaxZoomOptions } from './index';
export declare function cancelFetch(taskId: string): void;
export declare function getTile(url: any, options: getTileOptions): Promise<unknown>;
export declare function getTileWithMaxZoom(options: getTileWithMaxZoomOptions): Promise<unknown>;
