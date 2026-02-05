import { BBOXtype } from "./bbox";
import { CustomError } from "./Error";

declare global {
    interface AbortController {
        runing?: boolean;
        reject?: Function;
    }

    interface Promise<T> {
        cancel?: () => void;
        canceled?: boolean;
    }
}

export type postProcessingOptionsType = {
    flipY?: boolean;
    filter?: string;
    opacity?: number;
    gaussianBlurRadius?: number;
    mosaicSize?: number;
    oldPhoto?: boolean;
    invertColor?: boolean;
    ignorePostProcessing?: boolean;
}

export type fetchOptionsType = {
    referrer?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    timeout?: number;
    indexedDBCache?: boolean;
    errorLog?: boolean;
}

export type returnResultType = {
    returnBlobURL?: boolean;
    returnUint32Buffer?: boolean;
    returnBase64?: boolean;
    forceReturnImage?: boolean;
    quality?: number;
}

export type getTileOptions = {
    url: string | ImageBitmap | Array<string | ImageBitmap>;
    globalCompositeOperation?: GlobalCompositeOperation;
} & postProcessingOptionsType & fetchOptionsType & returnResultType;

export type urlTemplateFunction = (x: number, y: number, z: number, domain?: string) => string;

export type layoutTilesOptions = {
    urlTemplate: string | urlTemplateFunction;
    tiles: Array<[number, number, number]>;
    subdomains?: Array<string>;
    debug?: boolean;
} & postProcessingOptionsType & fetchOptionsType & returnResultType;

export type encodeTerrainTileOptions = {
    url: string;
    terrainType: 'mapzen' | 'tianditu' | 'cesium' | 'arcgis' | 'qgis-gray';
    minHeight?: number;
    maxHeight?: number;
    terrainWidth?: number;
    tileSize?: number;
    terrainColors?: Array<[number, string]>
} & fetchOptionsType & returnResultType;


export type getTileWithMaxZoomOptions = Omit<getTileOptions, 'url'> & {
    urlTemplate: string | urlTemplateFunction | Array<string | urlTemplateFunction>;
    maxAvailableZoom: number;
    x: number;
    y: number;
    z: number;
    subdomains?: Array<string>;
    tms?: boolean;
}

export type clipTileOptions = {
    tile: ImageBitmap | string;
    tileBBOX: BBOXtype;
    projection: string;
    maskId: string;
    tileSize?: number;
    reverse?: boolean;
    bufferSize?: number;
} & returnResultType;

export type tileIntersectMaskOptions = {
    tileBBOX: BBOXtype;
    maskId: string;
};

export type transformTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    zoomOffset?: number;
    debug?: boolean;
}

export type rectifyTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    tileBBOX: BBOXtype;
    transform: 'WGS84-GCJ02' | 'GCJ02-WGS84',
    tileSize: number;
    debug?: boolean;
    mapZoom?: number;
}

export type rectifyBaiduTileOptions = getTileWithMaxZoomOptions & {
    tileBBOX: BBOXtype;
    transform: 'BAIDU-WGS84' | 'BAIDU-GCJ02',
    tileSize: number;
    debug?: boolean;
    mapZoom?: number;
}

export type colorTerrainTileOptions = {
    tile: ImageBitmap | string;
    colors: Array<[number, string]>;
} & postProcessingOptionsType & returnResultType;

export type privateOptions = getTileOptions & {
    __taskId?: number;
    __workerId?: number;
}

export type GeoJSONPolygon = {
    type: 'Feature',
    geometry: {
        type: 'Polygon',
        coordinates: number[][][]
    },
    properties?: Record<string, any>;
    bbox?: BBOXtype
}

export type GeoJSONMultiPolygon = {
    type: 'Feature',
    geometry: {
        type: 'MultiPolygon',
        coordinates: number[][][][]
    },
    properties?: Record<string, any>;
    bbox?: BBOXtype
}

export type injectImageOptions = {
    imageId: string;
    url: string;
    imageBBOX: BBOXtype;
} & fetchOptionsType;


export type getImageTileOptions = {
    tileBBOX: BBOXtype,
    imageId: string;
    projection: string;
    tileSize?: number;
} & postProcessingOptionsType & returnResultType;

export type terrainTileFixBoundaryOptions = {
    tiles: Array<{ x: number, y: number, z: number, image: ImageBitmap | HTMLImageElement | HTMLCanvasElement }>;
} & returnResultType;

export type clipBufferOptions = {
    bufferSize?: number;
    polygons: number[][][][]
}

export type imageResultType = ImageBitmap | string | ArrayBuffer;
export type resolveResultType = (image: imageResultType) => void;
export type rejectResultType = (error: CustomError) => void;
export type sliceImageItemType = {
    x: number;
    y: number;
    id: number;
    width: number;
    height: number;
    row: number;
    col: number;
    image: imageResultType;
}

export type sliceImageResultType = {
    rows: number;
    cols: number;
    rowWidth: number;
    colHeight: number;
    width: number;
    height: number;
    items: Array<sliceImageItemType>;

}

export type getVTTileOptions = {
    url: string | Array<string>;
    customProperties?: (layerName: string, layer: any, feature: any, featureIndex: number) => void;
} & fetchOptionsType;


export type TileItem = {
    x: number;
    y: number;
    z: number;
    tileImage?: ImageBitmap;
}