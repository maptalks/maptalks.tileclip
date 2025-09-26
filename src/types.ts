import { BBOXtype } from "./bbox";

export type postProcessingOptionsType = {
    filter?: string;
    opacity?: number;
    gaussianBlurRadius?: number;
    mosaicSize?: number;
    oldPhoto?: boolean;
    invertColor?: boolean;
}

export type fetchOptionsType = {
    referrer?: string;
    headers?: Record<string, string>;
    fetchOptions?: Record<string, any>;
    timeout?: number;
    indexedDBCache?: boolean;
}

export type returnResultType = {
    returnBlobURL?: boolean;
    returnUint32Buffer?: boolean;
    returnBase64?: boolean;
    forceReturnImage?: boolean;
}

export type getTileOptions = {
    url: string | ImageBitmap | Array<string | ImageBitmap>;
    globalCompositeOperation?: GlobalCompositeOperation;
} & postProcessingOptionsType & fetchOptionsType & returnResultType;


export type layoutTilesOptions = {
    urlTemplate: string;
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
    urlTemplate: string | Array<string>;
    maxAvailableZoom: number;
    x: number;
    y: number;
    z: number;
    subdomains?: Array<string>;
}

export type clipTileOptions = {
    tile: ImageBitmap;
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
    errorLog?: boolean;
    zoomOffset?: number;
    debug?: boolean;
}

export type rectifyTileOptions = getTileWithMaxZoomOptions & {
    projection: 'EPSG:4326' | 'EPSG:3857';
    tileBBOX: BBOXtype;
    transform: 'WGS84-GCJ02' | 'GCJ02-WGS84',
    tileSize: number;
    errorLog?: boolean;
    debug?: boolean;
    mapZoom?: number;
}

export type colorTerrainTileOptions = {
    tile: ImageBitmap;
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

export type resolveResultType = (image: ImageBitmap | string | ArrayBuffer) => void;
export type rejectResultType = (error: Error) => void;
export type sliceImageItemType = {
    x: number;
    y: number;
    id: number;
    width: number;
    height: number;
    row: number;
    col: number;
    image: ImageBitmap | string | ArrayBuffer;
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
    url: string | Array<string>
} & fetchOptionsType;


export type TileItem = {
    x: number;
    y: number;
    z: number;
    tileImage?: ImageBitmap;
}