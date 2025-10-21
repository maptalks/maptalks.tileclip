import { createImageTypeResult, postProcessingImage, colorsTerrainTile, getCanvas } from './canvas';
import { imageSlicing, imageToBlobURL } from './imageslice';
import { imagetTileFetch } from './imagetile';
import { clip, injectMask, removeMask, tileBBOXIntersectMask } from './tileclip';
import { cancelFetch } from './tilefetch';
import { encodeTerrainTile, getTile, getTileWithMaxZoom, getVTTile, layout_Tiles } from './tileget';
import { tileRectify } from './tilerectify';
import { tileTransform } from './tiletransform';
import { checkBuffers, createInnerError, isImageBitmap, CancelTaskLRUCache } from './util';

export const initialize = function () {
};

export const onmessage = function (message, postResponse) {
    const data = message.data || {};
    const type = data.__type;
    if (type === 'getTile') {
        getTile(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'layoutTiles') {
        layout_Tiles(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'getTileWithMaxZoom') {
        getTileWithMaxZoom(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'clipTile') {
        clip(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'tileIntersectMask') {
        const { tileBBOX, maskId } = data;
        tileBBOXIntersectMask(tileBBOX, maskId).then(result => {
            postResponse(null, result, checkBuffers(result));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'transformTile') {
        tileTransform(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'rectifyTile') {
        tileRectify(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'injectMask') {
        const geojson = injectMask(data.maskId, data.geojsonFeature);
        if (geojson instanceof Error) {
            postResponse(geojson);
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
            postResponse(error);
        });
        return;
    }
    if (type === 'imageToBlobURL') {
        imageToBlobURL(data).then((result: any) => {
            postResponse(null, result, []);
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'encodeTerrainTile') {

        encodeTerrainTile(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'colorTerrainTile') {
        const { tile, colors } = data;
        const image = colorsTerrainTile(colors, tile);
        const postImage = postProcessingImage(image, data);
        createImageTypeResult(getCanvas(), postImage, data).then(url => {
            postResponse(null, url, checkBuffers(url));
        }).catch(error => {
            postResponse(error);
        })
        return;
    }
    if (type === 'imagetTileFetch') {
        imagetTileFetch(data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        })
        return;
    }
    if (type === 'tilePostAndToBlobURL') {
        const { image } = data;
        const postImage = postProcessingImage(image, data);
        createImageTypeResult(getCanvas(), postImage, data).then(image => {
            postResponse(null, image, checkBuffers(image));
        }).catch(error => {
            postResponse(error);
        })
        return;
    }
    if (type === 'getVTTile') {
        getVTTile(data).then(buffer => {
            postResponse(null, buffer, checkBuffers(buffer));
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    const errorMessage = 'worker message:not support message type:' + type;
    console.error(errorMessage);
    postResponse(createInnerError(errorMessage));
};
