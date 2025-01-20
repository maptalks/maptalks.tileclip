# maptalks.tileclip

[maptalks](https://github.com/maptalks/maptalks.js) TileLayer clip tool

* This plugin requires the runtime environment to support [OffscreenCanvas](https://developer.mozilla.org/zh-CN/docs/Web/API/OffscreenCanvas). Pay attention to relevant compatibility

* Considering performance, all operations are completed within the [web worker](https://developer.mozilla.org/zh-CN/docs/Web/API/Web_Workers_API/Using_web_workers)

* If you are familiar with other map engines, you can also apply them to other map engines  [leaflet demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet.html)

## Examples

* [simple get tile](https://maptalks.github.io/maptalks.tileclip/demo/tile.html)
* [simple get tiles](https://maptalks.github.io/maptalks.tileclip/demo/tile-array.html)
* [get tile with filter](https://maptalks.github.io/maptalks.tileclip/demo/polygon-hole-clip-filter.html)
* [clip by polygon](https://maptalks.github.io/maptalks.tileclip/demo/polygon-clip.html)
* [clip by polygon with holes](https://maptalks.github.io/maptalks.tileclip/demo/polygon-hole-clip.html)
* [clip by multipolygon](https://maptalks.github.io/maptalks.tileclip/demo/multipolygon-clip.html)
* [clip by multipolygon with holes](https://maptalks.github.io/maptalks.tileclip/demo/multipolygon-hole-clip.html)
* [EPSG:4326](https://maptalks.github.io/maptalks.tileclip/demo/4326.html)
* [custom SpatialReference](https://maptalks.github.io/maptalks.tileclip/demo/custom-sp.html)
* [update mask](https://maptalks.github.io/maptalks.tileclip/demo/update-mask.html)
* [mask remove or add](https://maptalks.github.io/maptalks.tileclip/demo/polygon-clip-remve.html)
* [identify projection](https://maptalks.github.io/maptalks.tileclip/demo/identify.html)
* [water mark](https://maptalks.github.io/maptalks.tileclip/demo/watermark.html)
* [maxAvailableZoom](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom.html)
* [maxAvailableZoom tiles](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-array.html)
* [maxAvailableZoom polygon clip](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-polygon-clip.html)
* [maxAvailableZoom tiles polygon clip](https://maptalks.github.io/maptalks.tileclip/demo/maxAvailableZoom-polygon-clip-array.html)
* [underground by clip tile](https://maptalks.github.io/maptalks.tileclip/demo/underground.html)
* [leaflet demo](https://maptalks.github.io/maptalks.tileclip/demo/leaflet.html)

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

* `getTile(options)` get tile [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap) by fetch in worker, return `Promise`
  + `options.url`:tile url orl tiles urls
  + `options.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options.headers`:fetch headers params. if need
  + `options.fetchOptions`:fetch options. if need, If it exists, headers will be ignored

```js
tileActor.getTile({
    url: 'https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/12/1663/3425',
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
```

* `getTileWithMaxZoom(options)` get tile [ImageBitmap](https://developer.mozilla.org/zh-CN/docs/Web/API/ImageBitmap) by fetch in worker, return `Promise`. When the level exceeds the maximum level, tiles will be automatically cut
  + `options.x`:tile col
  + `options.y`:tile row
  + `options.z`:tile zoom
  + `options.maxAvailableZoom`:tile The maximum visible level, such as 18
  + `options.urlTemplate`:tile urlTemplate.https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x} or tiles urlTemplates
  + `options.filter`:[CanvasRenderingContext2D.filter](https://mdn.org.cn/en-US/docs/Web/API/CanvasRenderingContext2D/filter)
  + `options.headers`:fetch headers params. if need
  + `options.fetchOptions`:fetch options. if need, If it exists, headers will be ignored

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
  + `options.returnBlobURL`: to return 
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
    urlTemplate: '/arcgisonline/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
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
