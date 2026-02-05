import { createImageTypeResult, postProcessingImage, colorsTerrainTile, getCanvas } from './canvas';
import { createError, createInnerError } from './Error';
import { imageSlicing, imageToBlobURL } from './imageslice';
import { imagetTileFetch } from './imagetile';
import { tileBaduRectify } from './tilebaidurectify';
import { clip, injectMask, removeMask, tileBBOXIntersectMask } from './tileclip';
import { cancelFetch } from './tilefetch';
import { getTile, getTileWithMaxZoom, layout_Tiles } from './tileget';
import { tileRectify } from './tilerectify';
import { encodeTerrainTile, terrainTileColors } from './tileterrain';
import { tileTransform } from './tiletransform';
import { getVTTile } from './tilevt';
import { checkBuffers, isImageBitmap, CancelTaskLRUCache } from './util';

//why native Error not clone code properties
function parseError(error) {
    if (error instanceof Error) {
        let code = -1;
        const message = error.message;
        if (message && message.indexOf('aborted') > -1) {
            code = 499;
        }
        return createError(message, code);
    }
    return error;
}

export const initialize = function () {
};

export const onmessage = function (message, postResponse) {
    const data = message.data || {};
    const type = data.__type;
    if (type === 'getTile') {
        getTile(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'layoutTiles') {
        layout_Tiles(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'getTileWithMaxZoom') {
        getTileWithMaxZoom(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'clipTile') {
        clip(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'tileIntersectMask') {
        const { tileBBOX, maskId } = data;
        tileBBOXIntersectMask(tileBBOX, maskId).then(result => {
            postResponse(null, result, checkBuffers(result));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'transformTile') {
        tileTransform(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'rectifyTile') {
        tileRectify(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'rectifyBaiduTile') {
        tileBaduRectify(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'injectMask') {
        const geojson = injectMask(data.maskId, data.geojsonFeature);
        if (geojson instanceof Error) {
            postResponse(parseError(geojson));
            return;
        }
        postResponse();
        return;
    }
    if (type === 'removeMask') {
        removeMask(data.maskId);
        postResponse();
        return;
    }
    if (type === 'cancelFetch') {
        const taskId = data.taskId || data.__taskId;
        if (!taskId) {
            postResponse(createInnerError('cancelFetch need taskId'));
            return;
        }
        CancelTaskLRUCache.add(taskId, 1);
        cancelFetch(taskId);
        postResponse();
        return;
    }
    if (type === 'imageSlicing') {
        imageSlicing(data).then((result: any) => {
            const buffers = [];
            const items = result.items || [];
            items.forEach(item => {
                if (isImageBitmap(item.image)) {
                    buffers.push(item.image);
                }
            });
            postResponse(null, result, buffers);
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'imageToBlobURL') {
        imageToBlobURL(data).then((result: any) => {
            postResponse(null, result, []);
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'encodeTerrainTile') {

        encodeTerrainTile(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    if (type === 'colorTerrainTile') {
        terrainTileColors(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        })
        return;
        // const { tile, colors } = data;
        // const image = colorsTerrainTile(colors, tile);
        // const postImage = postProcessingImage(image, data);
        // createImageTypeResult(getCanvas(), postImage, data).then(url => {
        //     postResponse(null, url, checkBuffers(url));
        // }).catch(error => {
        //     postResponse(error);
        // })
        return;
    }
    if (type === 'imagetTileFetch') {
        imagetTileFetch(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        })
        return;
    }
    if (type === 'tilePostAndToBlobURL') {
        const { image } = data;
        const postImage = postProcessingImage(image, data);
        createImageTypeResult(getCanvas(), postImage, data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(parseError(error));
        })
        return;
    }
    if (type === 'getVTTile') {
        getVTTile(data).then(buffer => {
            postResponse(null, buffer, checkBuffers(buffer));
        }).catch(error => {
            postResponse(parseError(error));
        });
        return;
    }
    const errorMessage = 'worker message:not support message type:' + type;
    console.error(errorMessage);
    postResponse(createInnerError(errorMessage));
};
