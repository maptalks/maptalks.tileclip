# maptalks.tileclip

[maptalks](https://github.com/maptalks/maptalks.js) TileLayer tiles merge/clip/transform  tool

* This plugin requires the runtime environment to support [OffscreenCanvas](https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas). Pay attention to relevant compatibility

* Considering performance, all operations are completed within the [web worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers)

* If you are familiar with other map engines, you can also apply them to other map engines  [leaflet demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet.html)

## Examples

### Common

* [simple get tile](https://maptalks.github.io/maptalks.tileclip/demo/tile.html)
* [merge tiles](https://maptalks.github.io/maptalks.tileclip/demo/tile-array.html)
* [tiles filter by geojson mask](https://maptalks.github.io/maptalks.tileclip/demo/tile-mask-filter.html)
* [css filter](https://maptalks.github.io/maptalks.tileclip/demo/cssfilter.html)
* [clip by polygon](https://maptalks.github.io/maptalks.tileclip/demo/polygon-clip.html)
* [clip by polygon with holes](https://maptalks.github.io/maptalks.tileclip/demo/polygon-hole-clip.html)
* [clip by multipolygon](https://maptalks.github.io/maptalks.tileclip/demo/multipolygon-clip.html)
* [clip by multipolygon with holes](https://maptalks.github.io/maptalks.tileclip/demo/multipolygon-hole-clip.html)

* [maxAvailableZoom](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom.html)
* [maxAvailableZoom tiles](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-array.html)
* [maxAvailableZoom polygon clip](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-polygon-clip.html)
* [maxAvailableZoom tiles polygon clip](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-polygon-clip-array.html)

* [update mask](https://maptalks.github.io/maptalks.tileclip/demo/update-mask.html)
* [mask remove or add](https://maptalks.github.io/maptalks.tileclip/demo/polygon-clip-remve.html)
* [water mark](https://maptalks.github.io/maptalks.tileclip/demo/watermark.html)
* [gaussian Blur](https://maptalks.github.io/maptalks.tileclip/demo/gaussianBlurRadius.html)
* [big image slice](https://maptalks.github.io/maptalks.tileclip/demo/imageslicing.html)

### Custom Prj

* [EPSG:4326](https://maptalks.github.io/maptalks.tileclip/demo/4326.html)
* [custom SpatialReference](https://maptalks.github.io/maptalks.tileclip/demo/custom-sp.html)
* [identify projection](https://maptalks.github.io/maptalks.tileclip/demo/identify.html)
* [EPSG:9807](https://maptalks.github.io/maptalks.tileclip/demo/epsg9807.html)

### Transform

* [transform EPSG4326 to EPSG3857](https://maptalks.github.io/maptalks.tileclip/demo/4326-transform-3857.html)
* [transform EPSG3857 to EPSG4326](https://maptalks.github.io/maptalks.tileclip/demo/3857-transform-4326.html)

## Others

* [underground by clip tile](https://maptalks.github.io/maptalks.tileclip/demo/underground.html)
* [leaflet clip demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet.html)
* [leaflet gettile demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet-simple.html)
* [leaflet transform tile demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet-transform.html)

## Install

### NPM

```sh
npm i maptalks
#or
# npm i maptalks-gl
npm i maptalks.tileclip
```

## CDN

```html
<script type="text/javascript" src="https://cdn.jsdelivr.net/npm/maptalks-gl/dist/maptalks-gl.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/maptalks.tileclip/dist/maptalks.tileclip.js"></script>
```

## API

### `getTileActor()`

return `TileActor` instance

```js
import {
    getTileActor
} from 'maptalks.tileclip'

const tileActor = getTileActor();
```

### `TileActor` class

Tile clip worker interaction class. about [maptalks. Actor](https://github.com/maptalks/maptalks.js/blob/master/packages/map/src/core/worker/Actor.ts) details

```js
import {
    getTileActor
} from 'maptalks.tileclip'

const tileActor = getTileActor();
```

#### methods

all methods return Promise with `cancel()` method

* `getTile(options)` get tile [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap) by fetch in worker, return `Promise`
  + `options.url`:tile url or tiles urls
  + `options?.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options?.headers`:fetch headers params. if need
  + `options?.fetchOptions`:fetch options. if need, If it exists, headers will be ignored
  + `options?.timeout`: fetch timeout
  + `options?.opacity`: tile opacity if need
  + `options?.gaussianBlurRadius`: gaussian Blur Radius if need
  + `options?.returnBlobURL`: to return 
  [Blob URL by createObjectURL() ](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static)? **When the blob URL is no longer in use, be sure to destroy its value** [revokeObjectURL()](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/revokeObjectURL_static)

```js
tileActor.getTile({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/Word_Imagery/MapServer/tile/12/1663/3425',
    //or url:[ur1,ur2],
    fetchOptions: {
        referrer: document.location.href,
        headers: {
            ...
        }
        ...
    }
}).then(imagebitmap => {
    consle.log(imagebitmap);
}).catch(error => {
    //do some things
})

//or if you want to cancel task
const promise = tileActor.getTile({
    ...
});
//mock cancel fetch task
setTimeout(() => {
    promise.cancel();
}, 2000);

promise.then((imagebitmap) => {

}).catch(error => {
    //do some things
    console.error(error);
})
```

* `getTileWithMaxZoom(options)` get tile [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap) by fetch in worker, return `Promise`. When the level exceeds the maximum level, tiles will be automatically cut
  + `options.x`:tile col
  + `options.y`:tile row
  + `options.z`:tile zoom
  + `options.maxAvailableZoom`:tile The maximum visible level, such as 18
  + `options.urlTemplate`:tile urlTemplate.https://services.arcgisonline.com/ArcGIS/rest/services/Word_Imagery/MapServer/tile/{z}/{y}/{x} or tiles urlTemplates
  + `options?.subdomains`:subdomains, such as [1, 2, 3, 4, 5]
  + `options?.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options?.headers`:fetch headers params. if need
  + `options?.fetchOptions`:fetch options. if need, If it exists, headers will be ignored
  + `options?.timeout`: fetch timeout
  + `options?.opacity`: tile opacity if need
  + `options?.gaussianBlurRadius`: gaussian Blur Radius if need
  + `options?.returnBlobURL`: to return 
  [Blob URL by createObjectURL() ](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static)? **When the blob URL is no longer in use, be sure to destroy its value** [revokeObjectURL()](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/revokeObjectURL_static)

```js
const {
    x,
    y,
    z
} = tile;
const urlTemplate = baseLayer.options.urlTemplate;
const maxAvailableZoom = 18;

tileActor.getTileWithMaxZoom({
    x,
    y,
    z,
    urlTemplate,
    //or urlTemplate:[urlTemplate1,urlTemplate2],
    maxAvailableZoom,
    fetchOptions: {
        referrer: document.location.href,
        headers: {
            ...
        }
        ...
    }
}).then(imagebitmap => {
    consle.log(imagebitmap);
}).catch(error => {
    //do some things
})

//or if you want to cancel task
const promise = tileActor.getTileWithMaxZoom({
    ...
});
//mock cancel fetch task
setTimeout(() => {
    promise.cancel();
}, 2000);

promise.then((imagebitmap) => {

}).catch(error => {
    //do some things
    console.error(error);
})
```

* `transformTile(options)` Reprojection tile in worker, return `Promise`
  + `options.x`:tile col
  + `options.y`:tile row
  + `options.z`:tile zoom
  + `options.projection`: Projection code, only support `EPSG:4326`,            `EPSG:3857`. Note that only global standard pyramid slicing is supported
  + `options.maxAvailableZoom`:tile The maximum visible level, such as 18
  + `options.urlTemplate`:tile urlTemplate.https://services.arcgisonline.com/ArcGIS/rest/services/Word_Imagery/MapServer/tile/{z}/{y}/{x} or tiles urlTemplates
  + `options?.subdomains`:subdomains, such as [1, 2, 3, 4, 5]
  + `options?.errorog`: Is there a printing error
  + `options?.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options?.headers`:fetch headers params. if need
  + `options?.fetchOptions`:fetch options. if need, If it exists, headers will be ignored
  + `options?.timeout`: fetch timeout
  + `options?.opacity`: tile opacity if need
  + `options?.gaussianBlurRadius`: gaussian Blur Radius if need
  + `options?.returnBlobURL`: to return 
  [Blob URL by createObjectURL() ](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static)? **When the blob URL is no longer in use, be sure to destroy its value** [revokeObjectURL()](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/revokeObjectURL_static)

```js
const {
    x,
    y,
    z
} = tile;
const maxAvailableZoom = 18;
tileActor.transformTile({
    x,
    y,
    z,
    urlTemplate,
    projection: 'EPSG:4326',
    maxAvailableZoom: 18,
}).then(imagebitmap => {
    callback(imagebitmap);
}).catch(error => {
    //do some things
    console.error(error);
})

//or if you want to cancel task
const promise = tileActor.transformTile({
    ...
});
//mock cancel fetch task
setTimeout(() => {
    promise.cancel();
}, 2000);

promise.then((imagebitmap) => {

}).catch(error => {
    //do some things
    console.error(error);
})
```

* `injectMask(maskId,Polygon/MultiPolygon)` inject Mask(GeoJSON. Polygon) for clip tiles . return `Promise`

  + `maskId`: mask id, Cache mask data in the worker
  + `Polygon/MultiPolygon` GeoJSON Polygon/MultiPolygon [GeoJSON SPEC](https://datatracker.ietf.org/doc/html/rfc7946#section-3.1.6)

```js
const maskId = 'china';

const polygon = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": []
    }
}

tileActor.injectMask(maskId, polygon).then(data => {
    // baseLayer.addTo(map);
}).catch(error => {
    console.error(error);
})
```

* `removeMask(maskId)` remove Mask from cache . return `Promise`

  + `maskId`: mask id

```js
const maskId = 'china';

tileActor.removeMask(maskId).then(data => {

}).catch(error => {
    console.error(error);
})
```

* `maskHasInjected(maskId)` Has the mask been injected . return `Boolean`

  + `maskId`: mask id

```js
const maskId = 'china';
const result = tileActor.maskHasInjected(maskId);
```

* `clipTile(options)` clip tile by mask . return `Promise`
  + `options.tile`:tile [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap)  data
  + `options.tileBBOX`:tile BBOX `[minx,miny,maxx,maxy]`
  + `options.projection`: Projection code, such as : EPSG:3857
  + `options.tileSize`:tile size 
  + `options.maskId`:mask key
  + `options?.returnBlobURL`: to return 
  [Blob URL by createObjectURL() ](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static)? **When the blob URL is no longer in use, be sure to destroy its value** [revokeObjectURL()](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/revokeObjectURL_static)

```js
import * as maptalks from 'maptalks-gl';
import {
    getTileActor
} from 'maptalks.tileclip';

const tileActor = getTileActor();
const maskId = 'china';

const baseLayer = new maptalks.TileLayer('base', {
    debug: true,
    urlTemplate: '/arcgisonline/rest/services/Word_Imagery/MapServer/tile/{z}/{y}/{x}',
    subdomains: ["a", "b", "c", "d"],
    // bufferPixel: 1
})

baseLayer.on('renderercreate', function(e) {
    //load tile image
    //   img(Image): an Image object
    //   url(String): the url of the tile
    e.renderer.loadTileBitmap = function(url, tile, callback) {
        //get Tile data
        tileActor.getTile({
            url: maptalks.Util.getAbsoluteURL(url)
        }).then(imagebitmap => {

            //clip tile
            tileActor.clipTile({
                tile: imagebitmap,
                tileBBOX: baseLayer._getTileBBox(tile),
                projection: baseLayer.getProjection().code,
                tileSize: baseLayer.getTileSize().width,
                maskId,
            }).then(image => {
                callback(image);
            }).catch(error => {
                //do some things
                console.error(error);
            })
        }).catch(error => {
            //do some things
            console.error(error);
        })
    };
});

const polygon = {
    "type": "Feature",
    "geometry": {
        "type": "Polygon",
        "coordinates": []
    }
}

tileActor.injectMask(maskId, polygon).then(data => {
    baseLayer.addTo(map);
}).catch(error => {
    console.error(error);
})
```

* `imageSlicing(options)` slice big image  in worker, return `Promise`
  + `options.url`:image url or images urls
  + `options?.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options?.headers`:fetch headers params. if need
  + `options?.fetchOptions`:fetch options. if need, If it exists, headers will be ignored
  + `options?.timeout`: fetch timeout
  + `options?.opacity`: tile opacity if need
  + `options?.gaussianBlurRadius`: gaussian Blur Radius if need
  + `options?.returnBlobURL`: to return 
  [Blob URL by createObjectURL() ](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/createObjectURL_static)? **When the blob URL is no longer in use, be sure to destroy its value** [revokeObjectURL()](https://developer.mozilla.org/zh-CN/docs/Web/API/URL/revokeObjectURL_static)

```js
tileActor.imageSlicing({

    url: './big.png',
    //or url:[ur1,ur2],
    fetchOptions: {
        referrer: document.location.href,
        headers: {
            ...
        }
        ...
    }

}).then(result => {

    consle.log(result);

}).catch(error => {

    //do some things

})
