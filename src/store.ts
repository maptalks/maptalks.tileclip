// @ts-ignore
// import localforage from './localforage.js';
import { get, set, createStore } from 'idb-keyval';
const STORE_NAME = 'maptalks.tileclip.store';
const DBSTORE = createStore(STORE_NAME, 'tiles');

// function getStore() {
//     if (!tempStore) {
//         tempStore = localforage.createInstance({
//             name: 'maptalks.tileclip',
//             storeName: 'tiles',
//             description: 'Tile storage for maptalks.tileclip'
//         });
//     }
//     return tempStore;
// }

// export function saveStoreTile(url: string, data: ImageBitmap | ArrayBuffer) {
//     getStore().setItem(url, data)
//         .then(() => {
//             // console.log(`Tile saved: ${url}`);
//         }).catch((error) => {
//             console.error(`Error saving tile: ${url}`, error);
//         });
// }

// export function getStoreTile(url: string): Promise<ImageBitmap | ArrayBuffer | null> {
//     return getStore().getItem(url)
// }


export function saveStoreTile(url: string, data: ImageBitmap | ArrayBuffer) {
    set(url, data, DBSTORE)
        .then(() => {
            // console.log(`Tile saved: ${url}`);
        }).catch((error) => {
            console.error(`Error saving tile: ${url}`, error);
        });
}

export function getStoreTile(url: string): Promise<ImageBitmap | ArrayBuffer | null> {
    return get(url, DBSTORE)
}