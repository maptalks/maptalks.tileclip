
import LRUCache from './LRUCache';
import {
    isNumber, FetchCancelError, FetchTimeoutError, createInnerError, disposeImage,
    isImageBitmap,
    createNetWorkError,
    removeTimeOut,
    checkArray
} from './util';
import { getStoreTile, saveStoreTile } from './store';

const LRUCount = 500;

const tileImageCache = new LRUCache<ImageBitmap>(LRUCount, (image) => {
    disposeImage(image);
});
const tileBufferCache = new LRUCache<ArrayBuffer>(LRUCount, (buffer) => {
    buffer = null;
});

type FetchQueueItem = {
    control: AbortController;
    fetchRun: Function
}
const FetchRuningQueue: number[] = [];
const FetchWaitQueue: Array<FetchQueueItem> = [];
const FETCHMAXCOUNT = 6;

function addFetchQueue(control: AbortController, fetchRun: Function) {
    if (FetchRuningQueue.length < FETCHMAXCOUNT) {
        FetchRuningQueue.push(1);
        control.runing = true;
        fetchRun();
    } else {
        FetchWaitQueue.push({
            control,
            fetchRun
        });
    }
}

function removeFetchQueue(controls: Array<AbortController>) {
    controls = checkArray(controls);
    if (!controls.length) {
        return;
    }
    controls.forEach(control => {
        if (FetchRuningQueue.length) {
            FetchRuningQueue.shift();
        }
        if (FetchWaitQueue.length) {
            let item = FetchWaitQueue.filter(item => {
                return item.control === control;
            })[0];
            if (item) {
                const index = FetchWaitQueue.indexOf(item);
                if (index > -1) {
                    FetchWaitQueue.splice(index, 1);
                }
            }
        }
        if (FetchWaitQueue.length && FetchRuningQueue.length < FETCHMAXCOUNT) {
            const item = FetchWaitQueue.shift();
            addFetchQueue(item.control, item.fetchRun);
        }
    });


}


const CONTROLCACHE: Record<string, Array<AbortController>> = {};

function cacheFetch(taskId: string, control: AbortController) {
    CONTROLCACHE[taskId] = CONTROLCACHE[taskId] || [];
    CONTROLCACHE[taskId].push(control);
}

export function cancelFetch(taskId: string) {
    const controlList = CONTROLCACHE[taskId] || [];
    if (controlList.length) {
        controlList.forEach(control => {
            abortFetch(control, FetchCancelError);
        });
    }
    removeFetchQueue(controlList);
    delete CONTROLCACHE[taskId];
}

function finishFetch(control: AbortController) {
    removeFetchQueue([control]);
    const deletekeys = [];
    for (let key in CONTROLCACHE) {
        const controlList = CONTROLCACHE[key] || [];
        if (controlList.length) {
            const index = controlList.indexOf(control);
            if (index > -1) {
                controlList.splice(index, 1);
            }
        }
        if (controlList.length === 0) {
            deletekeys.push(key);
        }
    }
    deletekeys.forEach(key => {
        delete CONTROLCACHE[key];
    });
}

function abortFetch(constrol: AbortController, error: Error) {
    if (constrol.runing) {
        constrol.abort(error);
    } else if (constrol.reject) {
        constrol.reject(error);
    }
}

function generateFetchOptions(headers, options, reject: Function) {
    const fetchOptions = options.fetchOptions || {
        headers,
        referrer: options.referrer
    };
    const timeout = options.timeout || 0;
    const control = new AbortController();
    control.reject = reject;
    const signal = control.signal;
    if (timeout && isNumber(timeout) && timeout > 0) {
        const tid = setTimeout(() => {
            abortFetch(control, FetchTimeoutError);
            removeTimeOut(tid);
        }, timeout);
    }
    fetchOptions.signal = signal;
    delete fetchOptions.timeout;
    return {
        fetchOptions,
        control
    }
}

export function fetchTile(url: string, headers = {}, options) {
    return new Promise((resolve: (image: ImageBitmap) => void, reject) => {
        const copyImageBitMap = (image: ImageBitmap) => {
            createImageBitmap(image).then(imagebit => {
                const tid = setTimeout(() => {
                    removeTimeOut(tid);
                    resolve(imagebit);
                }, 50);
            }).catch(error => {
                reject(error);
            });
        };
        if (isImageBitmap(url)) {
            copyImageBitMap(url as unknown as ImageBitmap);
            return;
        }

        const image = tileImageCache.get(url);
        if (image) {
            copyImageBitMap(image);
            return;
        }
        const { indexedDBCache } = options;
        const { fetchOptions, control } = generateFetchOptions(headers, options, reject);
        const taskId = options.__taskId;
        if (!taskId) {
            reject(createInnerError('taskId is null'));
            return;
        }
        cacheFetch(taskId, control);
        const fetchTileData = () => {
            fetch(url, fetchOptions).then(res => {
                if (!res.ok) {
                    finishFetch(control);
                    reject(createNetWorkError(url));
                    return;
                }
                return res.arrayBuffer();
            }).then(buffer => {
                return new Blob([buffer]);
            }).then(blob => createImageBitmap(blob)).then(image => {
                if (options.disableCache !== true) {
                    tileImageCache.add(url, image);
                }
                if (indexedDBCache) {
                    saveStoreTile(url, image);
                }
                finishFetch(control);
                copyImageBitMap(image);
            }).catch(error => {
                finishFetch(control);
                reject(error);
            });
        }
        if (!indexedDBCache) {
            addFetchQueue(control, fetchTileData);
            return;
        }
        getStoreTile(url).then(image => {
            if (image && indexedDBCache) {
                copyImageBitMap(image as ImageBitmap);
            } else {
                addFetchQueue(control, fetchTileData);
            }
        }).catch(() => {

        });

    });
}

export function fetchTileBuffer(url: string, headers = {}, options) {
    return new Promise((resolve: (buffer: ArrayBuffer) => void, reject) => {
        const copyBuffer = (buffer: ArrayBuffer) => {
            resolve(buffer);
        };
        const taskId = options.__taskId;
        if (!taskId) {
            reject(createInnerError('taskId is null'));
            return;
        }
        const buffer = tileBufferCache.get(url);
        if (buffer) {
            copyBuffer(buffer);
            return;
        }
        const { indexedDBCache } = options;
        const { fetchOptions, control } = generateFetchOptions(headers, options, reject);
        cacheFetch(taskId, control);
        const fetchTileData = () => {
            fetch(url, fetchOptions).then(res => {
                if (!res.ok) {
                    finishFetch(control);
                    reject(createNetWorkError(url));
                    return;
                }
                return res.arrayBuffer();
            }).then(buffer => {
                if (options.disableCache !== true) {
                    tileBufferCache.add(url, buffer);
                }
                finishFetch(control);
                if (indexedDBCache) {
                    saveStoreTile(url, buffer);
                }
                copyBuffer(buffer);
            }).catch(error => {
                finishFetch(control);
                reject(error);
            });
        }
        if (!indexedDBCache) {
            addFetchQueue(control, fetchTileData);
            return;
        }

        getStoreTile(url).then(buffer => {
            if (buffer && indexedDBCache) {
                copyBuffer(buffer as ArrayBuffer);
            } else {
                addFetchQueue(control, fetchTileData);
            }
        }).catch(() => {

        });
    });

}
