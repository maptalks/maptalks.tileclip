// @ts-ignore
import localforage from './localforage.js';

let tempStore;

function getStore() {
    if (!tempStore) {
        tempStore = localforage.createInstance({
            name: 'maptalks.tileclip',
            storeName: 'tiles',
            description: 'Tile storage for maptalks.tileclip'
        });
    }
    return tempStore;
}

export function storeTile(url: string, data: ImageBitmap | ArrayBuffer) {
    getStore().setItem(url, data)
        .then(() => {
            // console.log(`Tile saved: ${url}`);
        }).catch((error) => {
            console.error(`Error saving tile: ${url}`, error);
        });
}

export function getStoreTile(url: string): Promise<ImageBitmap | ArrayBuffer | null> {
    return getStore().getItem(url)
}