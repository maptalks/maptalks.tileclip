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
      const ctx = canvas.getContext('2d');
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
  function mergeTiles(images) {
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
  function lnglat2Mercator(coordinates) {
      const [lng, lat] = coordinates;
      const earthRad = 6378137.0;
      const x = lng * Math.PI / 180 * earthRad;
      const a = lat * Math.PI / 180;
      const y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
      return [x, y];
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
              reject(new Error('not find canvas.The current environment does not support OffscreenCanvas'));
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

  const CANVAS_ERROR_MESSAGE = new Error('not find canvas.The current environment does not support OffscreenCanvas');
  const HEADERS = {
      'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
  };
  const tileCache = new LRUCache(200, (image) => {
      if (image && image.close) {
          image.close();
      }
  });
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
              const image = mergeTiles(imagebits);
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
      const { urlTemplate, x, y, z, maxAvailableZoom } = options;
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
              return urlTemplate;
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
              const mergeImage = mergeTiles(imagebits);
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
