import { colorsTerrainTile, createImageTypeResult, getCanvas, postProcessingImage } from "./canvas";
import { getTile } from "./tileget";
import { colorTerrainTileOptions, getTileOptions } from "./types";
import { isString } from "./util";


export function terrainTileColors(options: colorTerrainTileOptions) {
    return new Promise((resolve, reject) => {
        const { tile, colors } = options;

        const handler = (image: ImageBitmap) => {
            const tileImage = colorsTerrainTile(colors, image);
            const postImage = postProcessingImage(tileImage, options);
            createImageTypeResult(getCanvas(), postImage, options).then(url => {
                resolve(url);
            }).catch(error => {
                reject(error);
            })
        }
        if (isString(tile)) {
            const fetchOptions = Object.assign({}, options, { forceReturnImage: true, url: tile }) as unknown as getTileOptions;
            getTile(fetchOptions).then(image => {
                handler(image as ImageBitmap);
            }).catch(error => {
                reject(error);
            })
        } else {
            handler(tile);
        }
    });
}


