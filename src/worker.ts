import { clip, injectMask, removeMask } from './tileclip';
import { getTile, getTileWithMaxZoom } from './tileget';

export const initialize = function () {
};

export const onmessage = function (message, postResponse) {
    const data = message.data || {};
    const type = data._type;
    if (type === 'getTile') {
        const { url } = data;
        getTile(url, data).then(image => {
            postResponse(null, image, [image]);
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'getTileWithMaxZoom') {
        getTileWithMaxZoom(data).then(image => {
            postResponse(null, image, [image]);
        }).catch(error => {
            postResponse(error);
        });
        return;
    }
    if (type === 'clipTile') {
        clip(data).then(image => {
            const buffers = [];
            if (image instanceof ImageBitmap) {
                buffers.push(image);
            }
            postResponse(null, image, buffers);
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
    console.error('not support message type:', type);
};
