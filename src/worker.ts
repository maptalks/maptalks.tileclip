import { imageSlicing, imageToBlobURL } from './imageslice';
import { clip, injectMask, removeMask } from './tileclip';
import { cancelFetch, getTile, getTileWithMaxZoom } from './tileget';
import { tileTransform } from './tiletranasform';
import { createError, isImageBitmap } from './util';

export const initialize = function () {
};

function checkBuffers(image) {
    const buffers = [];
    if (isImageBitmap(image)) {
        buffers.push(image);
    }
    return buffers;
}

export const onmessage = function (message, postResponse) {
    const data = message.data || {};
    const type = data._type;
    if (type === 'getTile') {
        const { url } = data;
        getTile(url, data).then(image => {
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
    if (type === 'transformTile') {
        tileTransform(data).then(image => {
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
            postResponse(createError('cancelFetch need taskId'));
            return;
        }
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
    const errorMessage = 'not support message type:' + type;
    console.error(errorMessage);
    postResponse(createError(errorMessage));
};
