export default ` (function (exports) { 'use strict';

  function bbox(geojson) {
    let b = [
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
    ];
    switch (geojson.type) {
      case 'FeatureCollection':
        const len = geojson.features.length;
        for (let i = 0; i < len; i++) {
          feature(geojson.features[i], b);
        }
        break;
      case 'Feature':
        feature(geojson, b);
        break;
      default:
        geometry(geojson, b);
        break;
    }
    return b;
  }

  function feature(f, b) {
    geometry(f.geometry, b);
  }

  function geometry(g, b) {
    if (!g) {
      return;
    }
    switch (g.type) {
      case 'Point':
        point(g.coordinates, b);
        break;
      case 'MultiPoint':
        line(g.coordinates, b);
        break;
      case 'LineString':
        line(g.coordinates, b);
        break;
      case 'MultiLineString':
        multiline(g.coordinates, b);
        break;
      case 'Polygon':
        polygon(g.coordinates, b);
        break;
      case 'MultiPolygon':
        multipolygon(g.coordinates, b);
        break;
      case 'GeometryCollection':
        const len = g.geometries.length;
        for (let i = 0; i < len; i++) {
          geometry(g.geometries[i], b);
        }
        break;
    }
  }

  function point(p, b) {
    b[0] = Math.min(b[0], p[0]);
    b[1] = Math.min(b[1], p[1]);
    b[2] = Math.max(b[2], p[0]);
    b[3] = Math.max(b[3], p[1]);
  }

  function line(l, b) {
    for (let i = 0, len = l.length; i < len; i++) {
      point(l[i], b);
    }
  }

  function multiline(ml, b) {
    for (let i = 0, len = ml.length; i < len; i++) {
      line(ml[i], b);
    }
  }

  function polygon(p, b) {
    //Just calculate the outer ring,Don't participate in the calculation of holes
    //测试10000个鄱阳湖的数据,表现为性能可以提高25%
    if (p.length) {
      line(p[0], b);
    }
  }

  function multipolygon(mp, b) {
    for (let i = 0, len = mp.length; i < len; i++) {
      polygon(mp[i], b);
    }
  }

  var bbox_cjs = bbox;

  var lineclip_1 = lineclip;

  lineclip.polyline = lineclip;
  lineclip.polygon = polygonclip;


  // Cohen-Sutherland line clippign algorithm, adapted to efficiently
  // handle polylines rather than just segments

  function lineclip(points, bbox, result) {

      var len = points.length,
          codeA = bitCode(points[0], bbox),
          part = [],
          i, a, b, codeB, lastCode;

      if (!result) result = [];

      for (i = 1; i < len; i++) {
          a = points[i - 1];
          b = points[i];
          codeB = lastCode = bitCode(b, bbox);

          while (true) {

              if (!(codeA | codeB)) { // accept
                  part.push(a);

                  if (codeB !== lastCode) { // segment went outside
                      part.push(b);

                      if (i < len - 1) { // start a new line
                          result.push(part);
                          part = [];
                      }
                  } else if (i === len - 1) {
                      part.push(b);
                  }
                  break;

              } else if (codeA & codeB) { // trivial reject
                  break;

              } else if (codeA) { // a outside, intersect with clip edge
                  a = intersect(a, b, codeA, bbox);
                  codeA = bitCode(a, bbox);

              } else { // b outside
                  b = intersect(a, b, codeB, bbox);
                  codeB = bitCode(b, bbox);
              }
          }

          codeA = lastCode;
      }

      if (part.length) result.push(part);

      return result;
  }

  // Sutherland-Hodgeman polygon clipping algorithm

  function polygonclip(points, bbox) {

      var result, edge, prev, prevInside, i, p, inside;

      // clip against each side of the clip rectangle
      for (edge = 1; edge <= 8; edge *= 2) {
          result = [];
          prev = points[points.length - 1];
          prevInside = !(bitCode(prev, bbox) & edge);

          for (i = 0; i < points.length; i++) {
              p = points[i];
              inside = !(bitCode(p, bbox) & edge);

              // if segment goes through the clip window, add an intersection
              if (inside !== prevInside) result.push(intersect(prev, p, edge, bbox));

              if (inside) result.push(p); // add a point if it's inside

              prev = p;
              prevInside = inside;
          }

          points = result;

          if (!points.length) break;
      }

      return result;
  }

  // intersect a segment against one of the 4 lines that make up the bbox

  function intersect(a, b, edge, bbox) {
      return edge & 8 ? [a[0] + (b[0] - a[0]) * (bbox[3] - a[1]) / (b[1] - a[1]), bbox[3]] : // top
             edge & 4 ? [a[0] + (b[0] - a[0]) * (bbox[1] - a[1]) / (b[1] - a[1]), bbox[1]] : // bottom
             edge & 2 ? [bbox[2], a[1] + (b[1] - a[1]) * (bbox[2] - a[0]) / (b[0] - a[0])] : // right
             edge & 1 ? [bbox[0], a[1] + (b[1] - a[1]) * (bbox[0] - a[0]) / (b[0] - a[0])] : // left
             null;
  }

  // bit code reflects the point position relative to the bbox:

  //         left  mid  right
  //    top  1001  1000  1010
  //    mid  0001  0000  0010
  // bottom  0101  0100  0110

  function bitCode(p, bbox) {
      var code = 0;

      if (p[0] < bbox[0]) code |= 1; // left
      else if (p[0] > bbox[2]) code |= 2; // right

      if (p[1] < bbox[1]) code |= 4; // bottom
      else if (p[1] > bbox[3]) code |= 8; // top

      return code;
  }

  function isNumber(value) {
      return typeof value === 'number';
  }
  function checkTileUrl(url) {
      if (Array.isArray(url)) {
          return url;
      }
      return [url];
  }
  const CANVAS_ERROR_MESSAGE = new Error('not find canvas.The current environment does not support OffscreenCanvas');
  function lnglat2Mercator(coordinates) {
      const [lng, lat] = coordinates;
      const earthRad = 6378137.0;
      const x = lng * Math.PI / 180 * earthRad;
      const a = lat * Math.PI / 180;
      const y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
      return [x, y];
  }

  let globalCanvas;
  function getCanvas(tileSize = 256) {
      if (!globalCanvas && OffscreenCanvas) {
          globalCanvas = new OffscreenCanvas(1, 1);
      }
      if (globalCanvas) {
          globalCanvas.width = globalCanvas.height = tileSize;
      }
      return globalCanvas;
  }
  function clearCanvas(ctx) {
      const canvas = ctx.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function getCanvasContext(canvas) {
      const ctx = canvas.getContext('2d', {
          willReadFrequently: true
      });
      return ctx;
  }
  function getBlankTile(tileSize) {
      const canvas = getCanvas(tileSize);
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      // ctx.fillText('404', 100, 100);
      // ctx.rect(0, 0, canvas.width, canvas.height);
      // ctx.stroke();
      return canvas.transferToImageBitmap();
  }
  function mergeImages(images) {
      if (images.length === 1) {
          return images[0];
      }
      if (images.length === 0) {
          return new Error('merge tiles error,not find imagebitmaps');
      }
      for (let i = 0, len = images.length; i < len; i++) {
          const image = images[i];
          if (!(image instanceof ImageBitmap)) {
              return new Error('merge tiles error,images not imagebitmap');
          }
      }
      const tileSize = images[0].width;
      const canvas = getCanvas(tileSize);
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      images.forEach(image => {
          ctx.drawImage(image, 0, 0, tileSize, tileSize);
      });
      return canvas.transferToImageBitmap();
  }
  function imageClip(canvas, polygons, image) {
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      ctx.save();
      const drawPolygon = (rings) => {
          for (let i = 0, len = rings.length; i < len; i++) {
              const ring = rings[i];
              const first = ring[0], last = ring[ring.length - 1];
              const [x1, y1] = first;
              const [x2, y2] = last;
              if (x1 !== x2 || y1 !== y2) {
                  ring.push(first);
              }
              for (let j = 0, len1 = ring.length; j < len1; j++) {
                  const [x, y] = ring[j];
                  if (j === 0) {
                      ctx.moveTo(x, y);
                  }
                  else {
                      ctx.lineTo(x, y);
                  }
              }
          }
      };
      ctx.beginPath();
      polygons.forEach(polygon => {
          drawPolygon(polygon);
      });
      ctx.clip('evenodd');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      const bitImage = canvas.transferToImageBitmap();
      ctx.restore();
      return bitImage;
  }
  function toBlobURL(imagebitmap) {
      const canvas = getCanvas();
      canvas.width = imagebitmap.width;
      canvas.height = imagebitmap.height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      ctx.drawImage(imagebitmap, 0, 0);
      return canvas.convertToBlob();
  }
  function imageFilter(canvas, imagebitmap, filter) {
      if (!filter) {
          return imagebitmap;
      }
      canvas.width = imagebitmap.width;
      canvas.height = imagebitmap.height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      ctx.save();
      ctx.filter = filter;
      ctx.drawImage(imagebitmap, 0, 0);
      ctx.restore();
      const bitImage = canvas.transferToImageBitmap();
      return bitImage;
  }
  function imageTileScale(canvas, imagebitmap, dx, dy, w, h) {
      canvas.width = imagebitmap.width;
      canvas.height = imagebitmap.height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      ctx.save();
      // console.log(dx,dy,w,h);
      ctx.drawImage(imagebitmap, dx, dy, w, h, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      const bitImage = canvas.transferToImageBitmap();
      return bitImage;
  }
  function imageOpacity(image, opacity = 1) {
      if (!isNumber(opacity) || opacity === 1 || opacity < 0 || opacity > 1) {
          return image;
      }
      const canvas = getCanvas();
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      ctx.globalAlpha = opacity;
      ctx.drawImage(image, 0, 0);
      const bitImage = canvas.transferToImageBitmap();
      ctx.globalAlpha = 1;
      return bitImage;
  }
  function mergeTiles(tiles) {
      let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
      let tileSize = 256;
      tiles.forEach(tile => {
          const [x, y] = tile;
          minx = Math.min(x, minx);
          miny = Math.min(y, miny);
          maxx = Math.max(x, maxx);
          maxy = Math.max(y, maxy);
          tileSize = tile.tileImage.width;
      });
      const width = (maxx - minx + 1) * tileSize;
      const height = (maxy - miny + 1) * tileSize;
      const canvas = getCanvas();
      canvas.width = width;
      canvas.height = height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      tiles.forEach(tile => {
          const [x, y] = tile;
          const dx = (x - minx) * tileSize;
          const dy = (y - miny) * tileSize;
          ctx.drawImage(tile.tileImage, dx, dy, tileSize, tileSize);
      });
      return canvas.transferToImageBitmap();
  }
  // export function clipTile(result, image) {
  //     const { tilesbbox, mbbox } = result;
  //     // console.log(bbox, tilembbox);
  //     const coordinates = toPoints(tilesbbox);
  //     const mCoordinates = coordinates.map(c => {
  //         let [x, y] = c;
  //         x = Math.min(x, 180);
  //         x = Math.max(-180, x);
  //         y = Math.max(-85, y);
  //         y = Math.min(85, y);
  //         const mc = lnglat2Mercator([x, y]);
  //         console.log(c, mc);
  //         return mc;
  //     });
  //     let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
  //     mCoordinates.forEach(c => {
  //         const [x, y] = c;
  //         // console.log(x,y);
  //         minx = Math.min(x, minx);
  //         miny = Math.min(y, miny);
  //         maxx = Math.max(x, maxx);
  //         maxy = Math.max(y, maxy);
  //     });
  //     const ax = image.width / (maxx - minx);
  //     const ay = image.height / (maxy - miny);
  //     // console.log(miny, maxy, ay);
  //     // console.log(ax, ay);
  //     const [x1, y1, x2, y2] = mbbox;
  //     const px1 = Math.floor((x1 - minx) * ax);
  //     const px2 = Math.floor((x2 - minx) * ax);
  //     const py2 = Math.floor(image.height - (y1 - miny) * ay);
  //     const py1 = Math.floor(image.height - (y2 - miny) * ay);
  //     const w = px2 - px1, h = py2 - py1;
  //     // console.log(px1, px2, py1, py2, w, h);
  //     const canvas = getCanvas();
  //     const ctx = getCanvasContext(canvas);
  //     clearCanvas(ctx);
  //     ctx.drawImage(image, px1, py1, w, h, 0, 0, canvas.width, canvas.height);
  //     return canvas.transferToImageBitmap();
  // }

  function bboxIntersect(bbox1, bbox2) {
      if (bbox1[2] < bbox2[0]) {
          return false;
      }
      if (bbox1[1] > bbox2[3]) {
          return false;
      }
      if (bbox1[0] > bbox2[2]) {
          return false;
      }
      if (bbox1[3] < bbox2[1]) {
          return false;
      }
      return true;
  }
  function bboxInBBOX(bbox1, bbox2) {
      const [x1, y1, x2, y2] = bbox1;
      return x1 >= bbox2[0] && x2 <= bbox2[2] && y1 >= bbox2[1] && y2 <= bbox2[3];
  }
  function toPoints(bbox) {
      const [minx, miny, maxx, maxy] = bbox;
      return [
          [minx, miny],
          [maxx, miny],
          [maxx, maxy],
          [minx, maxy]
      ];
  }
  function toBBOX(points) {
      let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
      points.forEach(point => {
          xmin = Math.min(xmin, point[0]);
          xmax = Math.max(xmax, point[0]);
          ymin = Math.min(ymin, point[1]);
          ymax = Math.max(ymax, point[1]);
      });
      return [xmin, ymin, xmax, ymax];
  }
  function bboxOfBBOXList(bboxList) {
      let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
      bboxList.forEach(bbox => {
          const [minx, miny, maxx, maxy] = bbox;
          xmin = Math.min(xmin, minx);
          xmax = Math.max(xmax, maxx);
          ymin = Math.min(ymin, miny);
          ymax = Math.max(ymax, maxy);
      });
      return [xmin, ymin, xmax, ymax];
  }

  const GeoJSONCache = {};
  function isPolygon(feature) {
      if (!feature) {
          return false;
      }
      const geometry = feature.geometry || { type: null };
      const type = geometry.type;
      return type === 'Polygon' || type === 'MultiPolygon';
  }
  function isEPSG3857(projection) {
      return projection === 'EPSG:3857';
  }
  function injectMask(maskId, geojson) {
      if (!isPolygon(geojson)) {
          return new Error('geojson.feature is not Polygon');
      }
      if (GeoJSONCache[maskId]) {
          return new Error('the' + maskId + ' geojson Already exists');
      }
      GeoJSONCache[maskId] = geojson;
      checkGeoJSONFeatureBBOX(geojson);
      return geojson;
  }
  function removeMask(maskId) {
      delete GeoJSONCache[maskId];
  }
  function checkGeoJSONFeatureBBOX(feature) {
      feature.bbox = feature.bbox || bbox_cjs(feature);
  }
  function transformCoordinates(projection, coordinates) {
      if (!isEPSG3857(projection)) {
          return coordinates;
      }
      else {
          const transformRing = (coord) => {
              const result = [];
              for (let i = 0, len = coord.length; i < len; i++) {
                  const c = coord[i];
                  if (Array.isArray(c[0])) {
                      result.push(transformRing(c));
                  }
                  else {
                      result[i] = lnglat2Mercator(c);
                  }
              }
              return result;
          };
          return transformRing(coordinates);
      }
  }
  function coordinate2Pixel(tileBBOX, tileSize, coordinate) {
      const [minx, miny, maxx, maxy] = tileBBOX;
      const dx = (maxx - minx), dy = (maxy - miny);
      const ax = dx / tileSize, ay = dy / tileSize;
      const [x, y] = coordinate;
      const px = (x - minx) / ax;
      const py = tileSize - (y - miny) / ay;
      return [px, py];
  }
  function transformPixels(projection, tileBBOX, tileSize, coordinates) {
      const [minx, miny, maxx, maxy] = tileBBOX;
      const transformRing = (coord, bbox) => {
          const result = [];
          for (let i = 0, len = coord.length; i < len; i++) {
              const c = coord[i];
              if (Array.isArray(c[0])) {
                  result.push(transformRing(c, bbox));
              }
              else {
                  result[i] = coordinate2Pixel(bbox, tileSize, c);
              }
          }
          return result;
      };
      if (isEPSG3857(projection)) {
          const [mminx, mminy] = lnglat2Mercator([minx, miny]);
          const [mmaxx, mmaxy] = lnglat2Mercator([maxx, maxy]);
          const mTileBBOX = [mminx, mminy, mmaxx, mmaxy];
          return transformRing(coordinates, mTileBBOX);
      }
      else {
          return transformRing(coordinates, tileBBOX);
      }
  }
  function clip(options) {
      return new Promise((resolve, reject) => {
          const { tile, tileBBOX, projection, tileSize, maskId, returnBlobURL } = options;
          if (!tile) {
              reject(new Error('tile is null.It should be a ImageBitmap'));
              return;
          }
          if (!tileBBOX) {
              reject(new Error('tileBBOX is null'));
              return;
          }
          if (!projection) {
              reject(new Error('projection is null'));
              return;
          }
          if (!tileSize) {
              reject(new Error('tileSize is null'));
              return;
          }
          if (!maskId) {
              reject(new Error('maskId is null'));
              return;
          }
          const feature = GeoJSONCache[maskId];
          if (!feature) {
              reject(new Error('not find mask by maskId:' + maskId));
              return;
          }
          const canvas = getCanvas(tileSize);
          if (!canvas) {
              reject(CANVAS_ERROR_MESSAGE);
              return;
          }
          const returnImage = (image) => {
              if (!returnBlobURL) {
                  resolve(image);
              }
              else {
                  toBlobURL(image).then(blob => {
                      const url = URL.createObjectURL(blob);
                      resolve(url);
                  }).catch(error => {
                      reject(error);
                  });
              }
          };
          const bbox = feature.bbox;
          if (!bbox) {
              returnImage(tile);
              return;
          }
          const { coordinates, type } = feature.geometry;
          if (!coordinates.length) {
              returnImage(tile);
              return;
          }
          if (!bboxIntersect(bbox, tileBBOX)) {
              returnImage(getBlankTile(tileSize));
              return;
          }
          let polygons = coordinates;
          if (type === 'Polygon') {
              polygons = [polygons];
          }
          let newCoordinates;
          if (bboxInBBOX(bbox, tileBBOX)) {
              newCoordinates = transformCoordinates(projection, polygons);
              const pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
              const image = imageClip(canvas, pixels, tile);
              returnImage(image);
              return;
          }
          const validateClipRing = (result) => {
              if (result.length > 0) {
                  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
                  for (let j = 0, len1 = result.length; j < len1; j++) {
                      const [x, y] = result[j];
                      minx = Math.min(x, minx);
                      miny = Math.min(y, miny);
                      maxx = Math.max(x, maxx);
                      maxy = Math.max(y, maxy);
                  }
                  if (minx !== maxx && miny !== maxy) {
                      return true;
                  }
              }
              return false;
          };
          const clipRings = [];
          for (let i = 0, len = polygons.length; i < len; i++) {
              const polygon = polygons[i];
              for (let j = 0, len1 = polygon.length; j < len1; j++) {
                  const ring = polygon[j];
                  const result = lineclip_1.polygon(ring, tileBBOX);
                  if (validateClipRing(result)) {
                      clipRings.push([result]);
                  }
              }
          }
          if (clipRings.length === 0) {
              returnImage(getBlankTile());
              return;
          }
          newCoordinates = transformCoordinates(projection, clipRings);
          const pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
          const image = imageClip(canvas, pixels, tile);
          returnImage(image);
      });
  }

  // copy from https://github.com/maptalks/maptalks.js/blob/master/src/core/util/LRUCache.ts
  const nullOnRemove = () => { };

  class LRUCache {
      constructor(max, onRemove) {
          this.max = max;
          this.onRemove = onRemove || nullOnRemove;
          this.reset();
      }

      reset() {
          if (this.data) {
              const values = this.data.values();
              for (const p of values) {
                  this.onRemove(p);
              }
          }

          this.data = new Map();
          return this;
      }

      clear() {
          this.reset();
          delete this.onRemove;
      }

      add(key, data) {
          if (!data) {
              return this;
          }
          if (this.has(key)) {
              this.data.delete(key);
              this.data.set(key, data);
              if (this.data.size > this.max) {
                  this.shrink();
              }
          } else {
              this.data.set(key, data);
              if (this.data.size > this.max) {
                  this.shrink();
              }
          }

          return this;
      }

      keys() {
          const keys = new Array(this.data.size);
          let i = 0;
          const iterator = this.data.keys();
          for (const k of iterator) {
              keys[i++] = k;
          }
          return keys;
      }

      shrink() {
          const iterator = this.data.keys();
          let item = iterator.next();
          while (this.data.size > this.max) {
              const removedData = this.getAndRemove(item.value);
              if (removedData) {
                  this.onRemove(removedData);
              }
              item = iterator.next();
          }
      }

      has(key) {
          return this.data.has(key);
      }

      getAndRemove(key) {
          if (!this.has(key)) { return null; }

          const data = this.data.get(key);
          this.data.delete(key);
          return data;
      }

      get(key) {
          if (!this.has(key)) { return null; }

          const data = this.data.get(key);
          return data;
      }

      remove(key) {
          if (!this.has(key)) { return this; }

          const data = this.data.get(key);
          this.data.delete(key);
          this.onRemove(data);

          return this;
      }

      setMaxSize(max) {
          this.max = max;
          if (this.data.size > this.max) {
              this.shrink();
          }
          return this;
      }
  }

  const HEADERS = {
      'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
  };
  const tileCache = new LRUCache(200, (image) => {
      if (image && image.close) {
          image.close();
      }
  });
  function formatTileUrlBySubdomains(url, subdomains) {
      if (!subdomains || !subdomains.length) {
          return url;
      }
      const len = subdomains.length;
      let index = Math.floor(Math.random() * len);
      index = Math.min(index, len - 1);
      while (url.indexOf('{s}') > -1) {
          url = url.replace('{s}', subdomains[index]);
      }
      return url;
  }
  function fetchTile(url, headers = {}, options) {
      return new Promise((resolve, reject) => {
          const copyImageBitMap = (image) => {
              createImageBitmap(image).then(imagebit => {
                  resolve(imagebit);
              }).catch(error => {
                  reject(error);
              });
          };
          const image = tileCache.get(url);
          if (image) {
              copyImageBitMap(image);
          }
          else {
              const fetchOptions = options.fetchOptions || {
                  headers,
                  referrer: options.referrer
              };
              fetch(url, fetchOptions).then(res => res.blob()).then(blob => createImageBitmap(blob)).then(image => {
                  tileCache.add(url, image);
                  copyImageBitMap(image);
              }).catch(error => {
                  reject(error);
              });
          }
      });
  }
  function getTile(url, options) {
      return new Promise((resolve, reject) => {
          if (!url) {
              reject(new Error('url is null'));
              return;
          }
          const urls = checkTileUrl(url);
          const headers = Object.assign({}, HEADERS, options.headers || {});
          const fetchTiles = urls.map(tileUrl => {
              return fetchTile(tileUrl, headers, options);
          });
          Promise.all(fetchTiles).then(imagebits => {
              const canvas = getCanvas();
              if (!canvas) {
                  reject(CANVAS_ERROR_MESSAGE);
                  return;
              }
              const image = mergeImages(imagebits);
              if (image instanceof Error) {
                  reject(image);
                  return;
              }
              const filter = options.filter;
              let tileImage;
              if (filter) {
                  tileImage = imageFilter(canvas, image, filter);
              }
              else {
                  tileImage = image;
              }
              resolve(imageOpacity(tileImage, options.opacity));
          }).catch(error => {
              reject(error);
          });
      });
  }
  function getTileWithMaxZoom(options) {
      const { urlTemplate, x, y, z, maxAvailableZoom, subdomains } = options;
      const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
      return new Promise((resolve, reject) => {
          if (!maxZoomEnable) {
              reject(new Error('maxAvailableZoom is error'));
              return;
          }
          if (!urlTemplate) {
              reject(new Error('urlTemplate is error'));
              return;
          }
          if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
              reject(new Error('x/y/z is error'));
              return;
          }
          const urlTemplates = checkTileUrl(urlTemplate);
          for (let i = 0, len = urlTemplates.length; i < len; i++) {
              const urlTemplate = urlTemplates[i];
              if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
                  if (!subdomains || subdomains.length === 0) {
                      reject(new Error('not find subdomains'));
                      return;
                  }
              }
          }
          let dxScale, dyScale, wScale, hScale;
          let tileX = x, tileY = y, tileZ = z;
          const zoomOffset = z - maxAvailableZoom;
          if (zoomOffset > 0) {
              let px = x, py = y;
              let zoom = z;
              // parent tile
              while (zoom > maxAvailableZoom) {
                  px = Math.floor(px / 2);
                  py = Math.floor(py / 2);
                  zoom--;
              }
              const scale = Math.pow(2, zoomOffset);
              // child tiles
              let startX = Math.floor(px * scale);
              let endX = startX + scale;
              let startY = Math.floor(py * scale);
              let endY = startY + scale;
              if (startX > x) {
                  startX--;
                  endX--;
              }
              if (startY > y) {
                  startY--;
                  endY--;
              }
              // console.log(startCol, endCol, startRow, endRow);
              dxScale = (x - startX) / (endX - startX);
              dyScale = (y - startY) / (endY - startY);
              wScale = 1 / (endX - startX);
              hScale = 1 / (endY - startY);
              // console.log(dxScale, dyScale, wScale, hScale);
              tileX = px;
              tileY = py;
              tileZ = maxAvailableZoom;
          }
          const urls = urlTemplates.map(urlTemplate => {
              let key = '{x}';
              while (urlTemplate.indexOf(key) > -1) {
                  urlTemplate = urlTemplate.replace(key, tileX);
              }
              key = '{y}';
              while (urlTemplate.indexOf(key) > -1) {
                  urlTemplate = urlTemplate.replace(key, tileY);
              }
              key = '{z}';
              while (urlTemplate.indexOf(key) > -1) {
                  urlTemplate = urlTemplate.replace(key, tileZ);
              }
              return formatTileUrlBySubdomains(urlTemplate, subdomains);
          });
          const headers = Object.assign({}, HEADERS, options.headers || {});
          const fetchTiles = urls.map(url => {
              return fetchTile(url, headers, options);
          });
          Promise.all(fetchTiles).then(imagebits => {
              const canvas = getCanvas();
              if (!canvas) {
                  reject(CANVAS_ERROR_MESSAGE);
                  return;
              }
              const mergeImage = mergeImages(imagebits);
              if (mergeImage instanceof Error) {
                  reject(mergeImage);
                  return;
              }
              let image;
              const filter = options.filter;
              if (filter) {
                  image = (imageFilter(canvas, mergeImage, filter));
              }
              else {
                  image = mergeImage;
              }
              if (zoomOffset <= 0) {
                  resolve(imageOpacity(image, options.opacity));
                  return;
              }
              const { width, height } = image;
              const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
              const imageBitMap = imageTileScale(canvas, image, dx, dy, w, h);
              resolve(imageOpacity(imageBitMap, options.opacity));
          }).catch(error => {
              reject(error);
          });
      });
  }

  const D2R = Math.PI / 180;
  const R2D = 180 / Math.PI;
  // 900913 properties;
  const A = 6378137.0;
  const MAXEXTENT = 20037508.342789244;
  const SPHERICAL_MERCATOR_SRS = '900913'; // https://epsg.io/900913, https://epsg.io/3857
  const WGS84 = 'WGS84'; // https://epsg.io/4326

  const cache = {};
  function isFloat(n) {
      return Number(n) === n && n % 1 !== 0;
  }
  class SphericalMercator {
      #size;
      #expansion;
      #Bc;
      #Cc;
      #zc;
      #Ac;
      constructor(options = {}) {
          this.#size = options.size || 256;
          this.#expansion = options.antimeridian ? 2 : 1;
          if (!cache[this.#size]) {
              let size = this.#size;
              const c = (cache[this.#size] = {});
              c.Bc = [];
              c.Cc = [];
              c.zc = [];
              c.Ac = [];
              for (let d = 0; d < 30; d++) {
                  c.Bc.push(size / 360);
                  c.Cc.push(size / (2 * Math.PI));
                  c.zc.push(size / 2);
                  c.Ac.push(size);
                  size *= 2;
              }
          }
          this.#Bc = cache[this.#size].Bc;
          this.#Cc = cache[this.#size].Cc;
          this.#zc = cache[this.#size].zc;
          this.#Ac = cache[this.#size].Ac;
      }
      px(ll, zoom) {
          if (isFloat(zoom)) {
              const size = this.#size * Math.pow(2, zoom);
              const d = size / 2;
              const bc = size / 360;
              const cc = size / (2 * Math.PI);
              const ac = size;
              const f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
              let x = d + ll[0] * bc;
              let y = d + 0.5 * Math.log((1 + f) / (1 - f)) * -cc;
              x > ac * this.#expansion && (x = ac * this.#expansion);
              y > ac && (y = ac);
              //(x < 0) && (x = 0);
              //(y < 0) && (y = 0);
              return [x, y];
          }
          else {
              const d = this.#zc[zoom];
              const f = Math.min(Math.max(Math.sin(D2R * ll[1]), -0.9999), 0.9999);
              let x = Math.round(d + ll[0] * this.#Bc[zoom]);
              let y = Math.round(d + 0.5 * Math.log((1 + f) / (1 - f)) * -this.#Cc[zoom]);
              x > this.#Ac[zoom] * this.#expansion &&
                  (x = this.#Ac[zoom] * this.#expansion);
              y > this.#Ac[zoom] && (y = this.#Ac[zoom]);
              //(x < 0) && (x = 0);
              //(y < 0) && (y = 0);
              return [x, y];
          }
      }
      ll(px, zoom) {
          if (isFloat(zoom)) {
              const size = this.#size * Math.pow(2, zoom);
              const bc = size / 360;
              const cc = size / (2 * Math.PI);
              const zc = size / 2;
              const g = (px[1] - zc) / -cc;
              const lon = (px[0] - zc) / bc;
              const lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
              return [lon, lat];
          }
          else {
              const g = (px[1] - this.#zc[zoom]) / -this.#Cc[zoom];
              const lon = (px[0] - this.#zc[zoom]) / this.#Bc[zoom];
              const lat = R2D * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
              return [lon, lat];
          }
      }
      convert(bbox, to) {
          if (to === SPHERICAL_MERCATOR_SRS) {
              return [
                  ...this.forward(bbox.slice(0, 2)),
                  ...this.forward(bbox.slice(2, 4)),
              ];
          }
          else {
              return [
                  ...this.inverse(bbox.slice(0, 2)),
                  ...this.inverse(bbox.slice(2, 4)),
              ];
          }
      }
      inverse(xy) {
          return [
              (xy[0] * R2D) / A,
              (Math.PI * 0.5 - 2.0 * Math.atan(Math.exp(-xy[1] / A))) * R2D,
          ];
      }
      forward(ll) {
          const xy = [
              A * ll[0] * D2R,
              A * Math.log(Math.tan(Math.PI * 0.25 + 0.5 * ll[1] * D2R)),
          ];
          // if xy value is beyond maxextent (e.g. poles), return maxextent.
          xy[0] > MAXEXTENT && (xy[0] = MAXEXTENT);
          xy[0] < -MAXEXTENT && (xy[0] = -MAXEXTENT);
          xy[1] > MAXEXTENT && (xy[1] = MAXEXTENT);
          xy[1] < -MAXEXTENT && (xy[1] = -MAXEXTENT);
          return xy;
      }
      bbox(x, y, zoom, tmsStyle, srs) {
          // Convert xyz into bbox with srs WGS84
          if (tmsStyle) {
              y = Math.pow(2, zoom) - 1 - y;
          }
          // Use +y to make sure it's a number to avoid inadvertent concatenation.
          const ll = [x * this.#size, (+y + 1) * this.#size]; // lower left
          // Use +x to make sure it's a number to avoid inadvertent concatenation.
          const ur = [(+x + 1) * this.#size, y * this.#size]; // upper right
          const bbox = [...this.ll(ll, zoom), ...this.ll(ur, zoom)];
          // If web mercator requested reproject to 900913.
          if (srs === SPHERICAL_MERCATOR_SRS)
              return this.convert(bbox, SPHERICAL_MERCATOR_SRS);
          return bbox;
      }
      xyz(bbox, zoom, tmsStyle, srs) {
          // If web mercator provided reproject to WGS84.
          const box = srs === SPHERICAL_MERCATOR_SRS ? this.convert(bbox, WGS84) : bbox;
          const ll = [box[0], box[1]]; // lower left
          const ur = [box[2], box[3]]; // upper right
          const px_ll = this.px(ll, zoom);
          const px_ur = this.px(ur, zoom);
          // Y = 0 for XYZ is the top hence minY uses px_ur[1].
          const x = [
              Math.floor(px_ll[0] / this.#size),
              Math.floor((px_ur[0] - 1) / this.#size),
          ];
          const y = [
              Math.floor(px_ur[1] / this.#size),
              Math.floor((px_ll[1] - 1) / this.#size),
          ];
          const bounds = {
              minX: Math.min.apply(Math, x) < 0 ? 0 : Math.min.apply(Math, x),
              minY: Math.min.apply(Math, y) < 0 ? 0 : Math.min.apply(Math, y),
              maxX: Math.max.apply(Math, x),
              maxY: Math.max.apply(Math, y),
          };
          if (tmsStyle) {
              const tms = {
                  minY: Math.pow(2, zoom) - 1 - bounds.maxY,
                  maxY: Math.pow(2, zoom) - 1 - bounds.minY,
              };
              bounds.minY = tms.minY;
              bounds.maxY = tms.maxY;
          }
          return bounds;
      }
  }

  const FirstRes = 1.40625, mFirstRes = 156543.03392804097;
  const TILESIZE = 256;
  const ORIGIN = [-180, 90];
  const MORIGIN = [-20037508.342787, 20037508.342787];
  const SUPPORTPROJECTION = ['EPSG:4326', 'EPSG:3857'];
  const TILE_SIZE = 256;
  const merc = new SphericalMercator({
      size: TILE_SIZE,
      // antimeridian: true
  });
  function get4326Res(zoom) {
      return FirstRes / Math.pow(2, zoom);
  }
  function get3857Res(zoom) {
      return mFirstRes / Math.pow(2, zoom);
  }
  function tile4326BBOX(x, y, z) {
      const [orginX, orginY] = ORIGIN;
      const res = get4326Res(z) * TILESIZE;
      let mincol = x;
      let maxcol = x;
      let minrow = y;
      let maxrow = y;
      mincol = Math.floor(mincol);
      maxcol = Math.floor(maxcol);
      minrow = Math.floor(minrow);
      maxrow = Math.floor(maxrow);
      const xmin = orginX + (mincol) * res;
      const xmax = orginX + (maxcol + 1) * res;
      const ymin = (maxrow) * res - orginY;
      const ymax = (minrow + 1) * res - orginY;
      return [xmin, ymin, xmax, ymax];
  }
  function cal4326Tiles(x, y, z, zoomOffset = 0) {
      zoomOffset = zoomOffset || 0;
      const [orginX, orginY] = ORIGIN;
      const res = get4326Res(z) * TILESIZE;
      const tileBBOX = merc.bbox(x, y, z);
      const [minx, miny, maxx, maxy] = tileBBOX;
      let mincol = (minx - orginX) / res, maxcol = (maxx - orginX) / res;
      let minrow = (orginY - maxy) / res, maxrow = (orginY - miny) / res;
      mincol = Math.floor(mincol);
      maxcol = Math.floor(maxcol);
      minrow = Math.floor(minrow);
      maxrow = Math.floor(maxrow);
      if (maxcol < mincol || maxrow < minrow) {
          return;
      }
      const tiles = [];
      for (let row = minrow; row <= maxrow; row++) {
          for (let col = mincol; col <= maxcol; col++) {
              tiles.push([col - 1, row, z + zoomOffset]);
          }
      }
      const xmin = orginX + (mincol - 1) * res;
      const xmax = orginX + (maxcol) * res;
      const ymin = (maxrow - 1) * res - orginY;
      const ymax = (minrow) * res - orginY;
      const coordinates = toPoints(tileBBOX).map(c => {
          return lnglat2Mercator(c);
      });
      return {
          tiles,
          tilesbbox: [xmin, ymin, xmax, ymax],
          bbox: tileBBOX,
          mbbox: toBBOX(coordinates),
          x,
          y,
          z
      };
  }
  function cal3857Tiles(x, y, z, zoomOffset = 0) {
      zoomOffset = zoomOffset || 0;
      const [orginX, orginY] = MORIGIN;
      const res = get3857Res(z) * TILESIZE;
      const tileBBOX = tile4326BBOX(x, y, z);
      const mbbox = toBBOX(toPoints(tileBBOX).map(c => {
          const result = merc.forward(c);
          return result;
      }));
      const [minx, miny, maxx, maxy] = mbbox;
      let mincol = (minx - orginX) / res, maxcol = (maxx - orginX) / res;
      let minrow = (orginY - maxy) / res, maxrow = (orginY - miny) / res;
      mincol = Math.floor(mincol);
      maxcol = Math.floor(maxcol);
      minrow = Math.floor(minrow);
      maxrow = Math.floor(maxrow);
      if (maxcol < mincol || maxrow < minrow) {
          return;
      }
      const tiles = [];
      for (let row = minrow; row <= maxrow; row++) {
          for (let col = mincol; col <= maxcol; col++) {
              tiles.push([col, row, z + zoomOffset]);
          }
      }
      const bboxList = tiles.map(tile => {
          const [x, y, z] = tile;
          return merc.bbox(x, y, z, false, '900913');
      });
      const [xmin, ymin, xmax, ymax] = bboxOfBBOXList(bboxList);
      return {
          tiles,
          tilesbbox: [xmin, ymin, xmax, ymax],
          bbox: tileBBOX,
          mbbox,
          x,
          y,
          z
      };
  }
  function tilesImageData(image, tilesbbox, tilebbox, projection, bbox) {
      const { width, height } = image;
      const [minx, miny, maxx, maxy] = tilesbbox;
      const ax = (maxx - minx) / width, ay = (maxy - miny) / height;
      let [tminx, tminy, tmaxx, tmaxy] = tilebbox;
      // console.log(tilesbbox, tilebbox);
      //buffer one pixel
      tminx -= ax;
      tmaxx += ax;
      tminy -= ay;
      tmaxy += ay;
      let x1 = (tminx - minx) / ax;
      let y1 = (maxy - tmaxy) / ay;
      let x2 = (tmaxx - minx) / ax;
      let y2 = (maxy - tminy) / ay;
      x1 = Math.floor(x1);
      y1 = Math.floor(y1);
      x2 = Math.ceil(x2);
      y2 = Math.ceil(y2);
      // console.log(x1, x2, y1, y2);
      const w = x2 - x1, h = y2 - y1;
      const tileCanvas = getCanvas();
      tileCanvas.width = w;
      tileCanvas.height = h;
      const ctx = getCanvasContext(tileCanvas);
      clearCanvas(ctx);
      ctx.drawImage(image, x1, y1, w, h, 0, 0, w, h);
      const imageData = ctx.getImageData(0, 0, w, h).data;
      const pixels = [];
      let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
      let index = -1;
      const method = projection === 'EPSG:4326' ? merc.forward : merc.inverse;
      for (let row = 1; row <= h; row++) {
          const y = tmaxy - (row - 1) * ay;
          const y1 = y - ay;
          for (let col = 1; col <= w; col++) {
              const idx = (row - 1) * w * 4 + (col - 1) * 4;
              const r = imageData[idx], g = imageData[idx + 1], b = imageData[idx + 2], a = imageData[idx + 3];
              const x = tminx + (col - 1) * ax;
              const coordinates = [x, y];
              const point = method(coordinates);
              xmin = Math.min(xmin, point[0]);
              xmax = Math.max(xmax, point[0]);
              ymin = Math.min(ymin, point[1]);
              ymax = Math.max(ymax, point[1]);
              const coordinates1 = [x, y1];
              pixels[++index] = {
                  point,
                  point1: method(coordinates1),
                  r,
                  g,
                  b,
                  a
              };
          }
      }
      return {
          pixels,
          bbox: [xmin, ymin, xmax, ymax],
          width: w,
          height: h,
          // image: tileCanvas.transferToImageBitmap()
          // canvas: tileCanvas
      };
  }
  function transformTiles(pixelsresult, mbbox, result) {
      const [xmin, ymin, xmax, ymax] = mbbox;
      const ax = (xmax - xmin) / TILESIZE, ay = (ymax - ymin) / TILESIZE;
      const { pixels, bbox } = pixelsresult;
      const [minx, miny, maxx, maxy] = bbox;
      let width = (maxx - minx) / ax, height = (maxy - miny) / ay;
      width = Math.round(width);
      height = Math.round(height);
      if (isNaN(width) || isNaN(height) || Math.min(width, height) === 0 || Math.abs(width) === Infinity || Math.abs(height) === Infinity) {
          // console.log(width, height, result);
          return;
      }
      const canvas = getCanvas();
      canvas.width = width;
      canvas.height = height;
      const ctx = getCanvasContext(canvas);
      clearCanvas(ctx);
      function transformPixel(x, y) {
          let col = Math.round((x - minx) / ax + 1);
          col = Math.min(col, width);
          let row = Math.round((maxy - y) / ay + 1);
          row = Math.min(row, height);
          return [col, row];
      }
      const imageData = ctx.createImageData(width, height);
      const data = imageData.data;
      for (let i = 0, len = pixels.length; i < len; i++) {
          const { point, point1, r, g, b, a } = pixels[i];
          const [x1, y1] = point;
          const [x2, y2] = point1;
          const [col1, row1] = transformPixel(x1, y1);
          // eslint-disable-next-line no-unused-vars
          const [col2, row2] = transformPixel(x2, y2);
          for (let j = row1; j <= row2; j++) {
              const idx = (j - 1) * width * 4 + (col1 - 1) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
              data[idx + 3] = a;
          }
      }
      ctx.putImageData(imageData, 0, 0);
      const image = canvas.transferToImageBitmap();
      const px = Math.round((xmin - minx) / ax);
      const py = Math.round((maxy - ymax) / ay);
      const canvas1 = getCanvas();
      canvas.width = TILESIZE;
      canvas.height = TILESIZE;
      const ctx1 = getCanvasContext(canvas);
      clearCanvas(ctx1);
      ctx1.drawImage(image, px - 1, py, TILESIZE, TILESIZE, 0, 0, TILESIZE, TILESIZE);
      // ctx1.textAlign = 'center';
      // ctx1.textBaseline = 'middle';
      // ctx1.fillStyle = 'red';
      // ctx1.fillText('design by deyihu', TILESIZE / 2, TILESIZE / 2);
      return canvas1.transferToImageBitmap();
  }
  function tileTransform(options) {
      return new Promise((resolve, reject) => {
          const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, projection, zoomOffset, tileBBOX } = options;
          const maxZoomEnable = maxAvailableZoom && isNumber(maxAvailableZoom) && maxAvailableZoom >= 1;
          if (!projection) {
              reject(new Error('not find projection'));
              return;
          }
          if (SUPPORTPROJECTION.indexOf(projection) === -1) {
              reject(new Error('not support projection:' + projection + '.the support:' + SUPPORTPROJECTION.join(',').toString()));
              return;
          }
          if (!maxZoomEnable) {
              reject(new Error('maxAvailableZoom is error'));
              return;
          }
          if (!urlTemplate) {
              reject(new Error('urlTemplate is error'));
              return;
          }
          if (!isNumber(x) || !isNumber(y) || !isNumber(z)) {
              reject(new Error('x/y/z is error'));
              return;
          }
          // if (x < 0 || y < 0) {
          //     resolve(getBlankTile());
          //     return;
          // }
          const loadTiles = () => {
              let result;
              if (projection === 'EPSG:4326') {
                  result = cal4326Tiles(x, y, z, zoomOffset || 0);
              }
              else if (projection === 'EPSG:3857') {
                  result = cal3857Tiles(x, y, z, zoomOffset || 0);
              }
              // console.log(result);
              const { tiles } = result || {};
              if (!tiles || tiles.length === 0) {
                  resolve(getBlankTile());
                  return;
              }
              result.loadCount = 0;
              const loadTile = () => {
                  if (result.loadCount >= tiles.length) {
                      const image = mergeTiles(tiles);
                      let image1;
                      if (projection === 'EPSG:4326') {
                          const imageData = tilesImageData(image, result.tilesbbox, result.bbox, projection, result.bbox);
                          image1 = transformTiles(imageData, result.mbbox);
                      }
                      else {
                          const imageData = tilesImageData(image, result.tilesbbox, result.mbbox, projection, result.bbox);
                          image1 = transformTiles(imageData, result.bbox);
                      }
                      resolve(image1 || getBlankTile());
                  }
                  else {
                      const tile = tiles[result.loadCount];
                      const [x, y, z] = tile;
                      getTileWithMaxZoom(Object.assign({}, options, { x, y, z })).then(image => {
                          tile.tileImage = image;
                          result.loadCount++;
                          loadTile();
                      }).catch(error => {
                          tile.tileImage = getBlankTile();
                          result.loadCount++;
                          loadTile();
                      });
                  }
              };
              loadTile();
          };
          loadTiles();
      });
  }

  const initialize = function () {
  };
  const onmessage = function (message, postResponse) {
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
      if (type === 'transformTile') {
          tileTransform(data).then(image => {
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

  exports.initialize = initialize;
  exports.onmessage = onmessage;

  Object.defineProperty(exports, '__esModule', { value: true });

})`
