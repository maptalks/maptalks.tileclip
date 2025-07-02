export default ` (function (exports) { 'use strict';

    class CustomError extends Error {
      constructor(message, code) {
        super(message);
        this.code = code;
      }
    }
    var HEADERS = {
      'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
    };
    function isNumber$1(value) {
      return typeof value === 'number';
    }
    function createError(message, code) {
      return new CustomError(message, code);
    }
    createError('not find canvas.The current environment does not support OffscreenCanvas', -4);
    var FetchCancelError = createError('fetch tile data cancel', 499);
    var FetchTimeoutError = createError('fetch tile data timeout', 408);
    function createNetWorkError(url) {
      return createError("fetch NetWork error, the url is " + url, -5);
    }
    function createParamsValidateError(message) {
      return createError(message, -1);
    }
    function createDataError(message) {
      return createError(message, -2);
    }
    function createInnerError(message) {
      return createError(message, -3);
    }
    function checkTileUrl(url) {
      if (Array.isArray(url)) {
        return url;
      }
      return [url];
    }
    function lnglat2Mercator(coordinates) {
      var [lng, lat] = coordinates;
      var earthRad = 6378137.0;
      var x = lng * Math.PI / 180 * earthRad;
      var a = lat * Math.PI / 180;
      var y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
      return [x, y];
    }
    function isPolygon(feature) {
      if (!feature) {
        return false;
      }
      var geometry = feature.geometry || {
        type: null
      };
      var type = geometry.type;
      return type === 'Polygon' || type === 'MultiPolygon';
    }
    function isEPSG3857(projection) {
      return projection === 'EPSG:3857';
    }
    var globalId = 0;
    function uuid() {
      globalId++;
      return globalId;
    }
    function isImageBitmap(image) {
      return image && image instanceof ImageBitmap;
    }
    function disposeImage(images) {
      if (!Array.isArray(images)) {
        images = [images];
      }
      images.forEach(function (image) {
        if (image && image.close) {
          image.close();
        }
      });
    }
    function encodeMapBox(height, out) {
      var value = Math.floor((height + 10000) * 10);
      var r = value >> 16;
      var g = value >> 8 & 0x0000FF;
      var b = value & 0x0000FF;
      if (out) {
        out[0] = r;
        out[1] = g;
        out[2] = b;
        return out;
      } else {
        return [r, g, b];
      }
    }
    function rgb2Height(R, G, B) {
      return -10000 + (R * 256 * 256 + G * 256 + B) * 0.1;
    }
    function replaceAll(template, key, value) {
      while (template.indexOf(key) > -1) {
        template = template.replace(key, value);
      }
      return template;
    }
    function checkBuffers(image) {
      var images = checkTileUrl(image);
      var buffers = [];
      images.forEach(function (item) {
        if (isImageBitmap(item)) {
          buffers.push(item);
        }
      });
      return buffers;
    }
    function formatTileUrlBySubdomains(url, subdomains) {
      if (!subdomains || !subdomains.length) {
        return url;
      }
      var len = subdomains.length;
      var index = Math.floor(Math.random() * len);
      index = Math.min(index, len - 1);
      return replaceAll(url, '{s}', subdomains[index]);
    }
    function getTileUrl(urlTemplate, x, y, z, subdomains) {
      var key = '{x}';
      var url = replaceAll(urlTemplate, key, x);
      key = '{y}';
      url = replaceAll(url, key, y);
      key = '{z}';
      url = replaceAll(url, key, z);
      return formatTileUrlBySubdomains(url, subdomains);
    }
    function validateSubdomains(urlTemplate, subdomains) {
      if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
        if (!subdomains || subdomains.length === 0) {
          return false;
        }
      }
      return true;
    }

    var a0, a1, a2, a3, b1, b2, left_corner, right_corner;
    function gaussCoef(sigma) {
      if (sigma < 0.5) {
        sigma = 0.5;
      }
      var a = Math.exp(0.726 * 0.726) / sigma,
        g1 = Math.exp(-a),
        g2 = Math.exp(-2 * a),
        k = (1 - g1) * (1 - g1) / (1 + 2 * a * g1 - g2);
      a0 = k;
      a1 = k * (a - 1) * g1;
      a2 = k * (a + 1) * g1;
      a3 = -k * g2;
      b1 = 2 * g1;
      b2 = -g2;
      left_corner = (a0 + a1) / (1 - b1 - b2);
      right_corner = (a2 + a3) / (1 - b1 - b2);
      return new Float32Array([a0, a1, a2, a3, b1, b2, left_corner, right_corner]);
    }
    function convolveRGBA(src, out, line, coeff, width, height) {
      var rgba;
      var prev_src_r, prev_src_g, prev_src_b, prev_src_a;
      var curr_src_r, curr_src_g, curr_src_b, curr_src_a;
      var curr_out_r, curr_out_g, curr_out_b, curr_out_a;
      var prev_out_r, prev_out_g, prev_out_b, prev_out_a;
      var prev_prev_out_r, prev_prev_out_g, prev_prev_out_b, prev_prev_out_a;
      var src_index, out_index, line_index;
      var i, j;
      var coeff_a0, coeff_a1, coeff_b1, coeff_b2;
      for (i = 0; i < height; i++) {
        src_index = i * width;
        out_index = i;
        line_index = 0;
        rgba = src[src_index];
        prev_src_r = rgba & 0xff;
        prev_src_g = rgba >> 8 & 0xff;
        prev_src_b = rgba >> 16 & 0xff;
        prev_src_a = rgba >> 24 & 0xff;
        prev_prev_out_r = prev_src_r * coeff[6];
        prev_prev_out_g = prev_src_g * coeff[6];
        prev_prev_out_b = prev_src_b * coeff[6];
        prev_prev_out_a = prev_src_a * coeff[6];
        prev_out_r = prev_prev_out_r;
        prev_out_g = prev_prev_out_g;
        prev_out_b = prev_prev_out_b;
        prev_out_a = prev_prev_out_a;
        coeff_a0 = coeff[0];
        coeff_a1 = coeff[1];
        coeff_b1 = coeff[4];
        coeff_b2 = coeff[5];
        for (j = 0; j < width; j++) {
          rgba = src[src_index];
          curr_src_r = rgba & 0xff;
          curr_src_g = rgba >> 8 & 0xff;
          curr_src_b = rgba >> 16 & 0xff;
          curr_src_a = rgba >> 24 & 0xff;
          curr_out_r = curr_src_r * coeff_a0 + prev_src_r * coeff_a1 + prev_out_r * coeff_b1 + prev_prev_out_r * coeff_b2;
          curr_out_g = curr_src_g * coeff_a0 + prev_src_g * coeff_a1 + prev_out_g * coeff_b1 + prev_prev_out_g * coeff_b2;
          curr_out_b = curr_src_b * coeff_a0 + prev_src_b * coeff_a1 + prev_out_b * coeff_b1 + prev_prev_out_b * coeff_b2;
          curr_out_a = curr_src_a * coeff_a0 + prev_src_a * coeff_a1 + prev_out_a * coeff_b1 + prev_prev_out_a * coeff_b2;
          prev_prev_out_r = prev_out_r;
          prev_prev_out_g = prev_out_g;
          prev_prev_out_b = prev_out_b;
          prev_prev_out_a = prev_out_a;
          prev_out_r = curr_out_r;
          prev_out_g = curr_out_g;
          prev_out_b = curr_out_b;
          prev_out_a = curr_out_a;
          prev_src_r = curr_src_r;
          prev_src_g = curr_src_g;
          prev_src_b = curr_src_b;
          prev_src_a = curr_src_a;
          line[line_index] = prev_out_r;
          line[line_index + 1] = prev_out_g;
          line[line_index + 2] = prev_out_b;
          line[line_index + 3] = prev_out_a;
          line_index += 4;
          src_index++;
        }
        src_index--;
        line_index -= 4;
        out_index += height * (width - 1);
        rgba = src[src_index];
        prev_src_r = rgba & 0xff;
        prev_src_g = rgba >> 8 & 0xff;
        prev_src_b = rgba >> 16 & 0xff;
        prev_src_a = rgba >> 24 & 0xff;
        prev_prev_out_r = prev_src_r * coeff[7];
        prev_prev_out_g = prev_src_g * coeff[7];
        prev_prev_out_b = prev_src_b * coeff[7];
        prev_prev_out_a = prev_src_a * coeff[7];
        prev_out_r = prev_prev_out_r;
        prev_out_g = prev_prev_out_g;
        prev_out_b = prev_prev_out_b;
        prev_out_a = prev_prev_out_a;
        curr_src_r = prev_src_r;
        curr_src_g = prev_src_g;
        curr_src_b = prev_src_b;
        curr_src_a = prev_src_a;
        coeff_a0 = coeff[2];
        coeff_a1 = coeff[3];
        for (j = width - 1; j >= 0; j--) {
          curr_out_r = curr_src_r * coeff_a0 + prev_src_r * coeff_a1 + prev_out_r * coeff_b1 + prev_prev_out_r * coeff_b2;
          curr_out_g = curr_src_g * coeff_a0 + prev_src_g * coeff_a1 + prev_out_g * coeff_b1 + prev_prev_out_g * coeff_b2;
          curr_out_b = curr_src_b * coeff_a0 + prev_src_b * coeff_a1 + prev_out_b * coeff_b1 + prev_prev_out_b * coeff_b2;
          curr_out_a = curr_src_a * coeff_a0 + prev_src_a * coeff_a1 + prev_out_a * coeff_b1 + prev_prev_out_a * coeff_b2;
          prev_prev_out_r = prev_out_r;
          prev_prev_out_g = prev_out_g;
          prev_prev_out_b = prev_out_b;
          prev_prev_out_a = prev_out_a;
          prev_out_r = curr_out_r;
          prev_out_g = curr_out_g;
          prev_out_b = curr_out_b;
          prev_out_a = curr_out_a;
          prev_src_r = curr_src_r;
          prev_src_g = curr_src_g;
          prev_src_b = curr_src_b;
          prev_src_a = curr_src_a;
          rgba = src[src_index];
          curr_src_r = rgba & 0xff;
          curr_src_g = rgba >> 8 & 0xff;
          curr_src_b = rgba >> 16 & 0xff;
          curr_src_a = rgba >> 24 & 0xff;
          rgba = (line[line_index] + prev_out_r << 0) + (line[line_index + 1] + prev_out_g << 8) + (line[line_index + 2] + prev_out_b << 16) + (line[line_index + 3] + prev_out_a << 24);
          out[out_index] = rgba;
          src_index--;
          line_index -= 4;
          out_index -= height;
        }
      }
    }
    function blurRGBA(src, width, height, radius) {
      if (!radius) {
        return;
      }
      var src32 = new Uint32Array(src.buffer);
      var out = new Uint32Array(src32.length),
        tmp_line = new Float32Array(Math.max(width, height) * 4);
      var coeff = gaussCoef(radius);
      convolveRGBA(src32, out, tmp_line, coeff, width, height);
      convolveRGBA(out, src32, tmp_line, coeff, height, width);
    }
    var glur = blurRGBA;

    var globalCanvas;
    function getCanvas$1(tileSize = 256) {
      if (!globalCanvas && OffscreenCanvas) {
        globalCanvas = new OffscreenCanvas(1, 1);
      }
      if (globalCanvas) {
        resizeCanvas(globalCanvas, tileSize, tileSize);
      }
      return globalCanvas;
    }
    function resizeCanvas(canvas, width, height) {
      if (canvas) {
        canvas.width = width;
        canvas.height = height;
      }
    }
    function clearCanvas(ctx) {
      var canvas = ctx.canvas;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function getCanvasContext(canvas) {
      var ctx = canvas.getContext('2d', {
        willReadFrequently: true
      });
      clearCanvas(ctx);
      return ctx;
    }
    function getBlankTile(tileSize) {
      var canvas = getCanvas$1(tileSize);
      getCanvasContext(canvas);
      return canvas.transferToImageBitmap();
    }
    function mergeTiles(images, globalCompositeOperation) {
      if (images.length === 1) {
        return images[0];
      }
      if (images.length === 0) {
        return createDataError('merge tiles error,not find imagebitmaps');
      }
      for (var i = 0, len = images.length; i < len; i++) {
        var image = images[i];
        if (!isImageBitmap(image)) {
          return createDataError('merge tiles error,images not imagebitmap');
        }
      }
      var tileSize = images[0].width;
      var canvas = getCanvas$1(tileSize);
      var ctx = getCanvasContext(canvas);
      if (globalCompositeOperation) {
        ctx.save();
        ctx.globalCompositeOperation = globalCompositeOperation;
      }
      images.forEach(function (image) {
        ctx.drawImage(image, 0, 0, tileSize, tileSize);
      });
      if (globalCompositeOperation) {
        ctx.restore();
      }
      disposeImage(images);
      return canvas.transferToImageBitmap();
    }
    function imageClip(canvas, polygons, image, reverse) {
      var ctx = getCanvasContext(canvas);
      ctx.save();
      var drawPolygon = function drawPolygon(rings) {
        for (var i = 0, len = rings.length; i < len; i++) {
          var ring = rings[i];
          var first = ring[0],
            last = ring[ring.length - 1];
          var [x1, y1] = first;
          var [x2, y2] = last;
          if (x1 !== x2 || y1 !== y2) {
            ring.push(first);
          }
          for (var j = 0, len1 = ring.length; j < len1; j++) {
            var [x, y] = ring[j];
            if (j === 0) {
              ctx.moveTo(x, y);
            } else {
              ctx.lineTo(x, y);
            }
          }
        }
      };
      ctx.beginPath();
      if (reverse) {
        ctx.rect(0, 0, canvas.width, canvas.height);
      }
      polygons.forEach(function (polygon) {
        drawPolygon(polygon);
      });
      ctx.clip('evenodd');
      ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
      var bitImage = canvas.transferToImageBitmap();
      ctx.restore();
      disposeImage(image);
      return bitImage;
    }
    function toBlobURL(imagebitmap) {
      var canvas = getCanvas$1();
      resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
      var ctx = getCanvasContext(canvas);
      ctx.drawImage(imagebitmap, 0, 0);
      disposeImage(imagebitmap);
      return canvas.convertToBlob();
    }
    function imageFilter(canvas, imagebitmap, filter) {
      if (!filter) {
        return imagebitmap;
      }
      resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
      var ctx = getCanvasContext(canvas);
      ctx.save();
      ctx.filter = filter;
      ctx.drawImage(imagebitmap, 0, 0);
      ctx.restore();
      var bitImage = canvas.transferToImageBitmap();
      disposeImage(imagebitmap);
      return bitImage;
    }
    function imageGaussianBlur(canvas, imagebitmap, radius) {
      if (!isNumber$1(radius) || radius <= 0) {
        return imagebitmap;
      }
      resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
      var ctx = getCanvasContext(canvas);
      ctx.drawImage(imagebitmap, 0, 0);
      var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      glur(imageData.data, canvas.width, canvas.height, radius);
      ctx.putImageData(imageData, 0, 0);
      var bitImage = canvas.transferToImageBitmap();
      disposeImage(imagebitmap);
      return bitImage;
    }
    function imageTileScale(canvas, imagebitmap, dx, dy, w, h) {
      resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
      var ctx = getCanvasContext(canvas);
      ctx.save();
      ctx.drawImage(imagebitmap, dx, dy, w, h, 0, 0, canvas.width, canvas.height);
      ctx.restore();
      var bitImage = canvas.transferToImageBitmap();
      disposeImage(imagebitmap);
      return bitImage;
    }
    function imageOpacity(image, opacity = 1) {
      if (!isNumber$1(opacity) || opacity === 1 || opacity < 0 || opacity > 1) {
        return image;
      }
      var canvas = getCanvas$1();
      resizeCanvas(canvas, image.width, image.height);
      var ctx = getCanvasContext(canvas);
      ctx.globalAlpha = opacity;
      ctx.drawImage(image, 0, 0);
      var bitImage = canvas.transferToImageBitmap();
      ctx.globalAlpha = 1;
      disposeImage(image);
      return bitImage;
    }
    function layoutTiles(tiles, debug) {
      var minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      var tileSize = 256;
      tiles.forEach(function (tile) {
        var [x, y] = tile;
        minx = Math.min(x, minx);
        miny = Math.min(y, miny);
        maxx = Math.max(x, maxx);
        maxy = Math.max(y, maxy);
        tileSize = tile.tileImage.width;
      });
      var width = (maxx - minx + 1) * tileSize;
      var height = (maxy - miny + 1) * tileSize;
      var canvas = getCanvas$1();
      resizeCanvas(canvas, width, height);
      var ctx = getCanvasContext(canvas);
      if (debug) {
        ctx.font = "bold 28px serif";
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'red';
        ctx.strokeStyle = 'red';
      }
      tiles.forEach(function (tile) {
        var [x, y, z] = tile;
        var dx = (x - minx) * tileSize;
        var dy = (y - miny) * tileSize;
        var tileImage = tile.tileImage;
        ctx.drawImage(tileImage, dx, dy, tileSize, tileSize);
        if (debug) {
          ctx.rect(dx, dy, tileSize, tileSize);
          ctx.stroke();
          ctx.fillText([x, y, z].join('_').toString(), dx + 100, dy + 100);
        }
      });
      disposeImage(tiles.map(function (tile) {
        return tile.tileImage;
      }));
      return canvas.transferToImageBitmap();
    }
    function postProcessingImage(image, options) {
      var canvas = getCanvas$1();
      var filterImage = imageFilter(canvas, image, options.filter);
      var blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);
      var opImage = imageOpacity(blurImage, options.opacity);
      return opImage;
    }
    function createImageBlobURL(image, returnBlobURL) {
      return new Promise(function (resolve, reject) {
        if (!returnBlobURL) {
          resolve(image);
        } else {
          toBlobURL(image).then(function (blob) {
            var url = URL.createObjectURL(blob);
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        }
      });
    }

    var nullOnRemove = function nullOnRemove() {};
    class LRUCache {
      constructor(max, onRemove) {
        this.max = max;
        this.onRemove = onRemove || nullOnRemove;
        this.reset();
      }
      reset() {
        if (this.data) {
          var values = this.data.values();
          for (var p of values) {
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
          this.data["delete"](key);
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
        var keys = new Array(this.data.size);
        var i = 0;
        var iterator = this.data.keys();
        for (var k of iterator) {
          keys[i++] = k;
        }
        return keys;
      }
      shrink() {
        var iterator = this.data.keys();
        var item = iterator.next();
        while (this.data.size > this.max) {
          var removedData = this.getAndRemove(item.value);
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
        if (!this.has(key)) {
          return null;
        }
        var data = this.data.get(key);
        this.data["delete"](key);
        return data;
      }
      get(key) {
        if (!this.has(key)) {
          return null;
        }
        var data = this.data.get(key);
        return data;
      }
      remove(key) {
        if (!this.has(key)) {
          return this;
        }
        var data = this.data.get(key);
        this.data["delete"](key);
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

    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */(function () {

      function m(d) {
        throw d;
      }
      var w = void 0,
        z = !0,
        aa = this;
      function A(d, a) {
        var c = d.split("."),
          e = aa;
        !(c[0] in e) && e.execScript && e.execScript("var " + c[0]);
        for (var b; c.length && (b = c.shift());) !c.length && a !== w ? e[b] = a : e = e[b] ? e[b] : e[b] = {};
      }
      var G = "undefined" !== typeof Uint8Array && "undefined" !== typeof Uint16Array && "undefined" !== typeof Uint32Array && "undefined" !== typeof DataView;
      function I(d, a) {
        this.index = "number" === typeof a ? a : 0;
        this.i = 0;
        this.buffer = d instanceof (G ? Uint8Array : Array) ? d : new (G ? Uint8Array : Array)(32768);
        2 * this.buffer.length <= this.index && m(Error("invalid index"));
        this.buffer.length <= this.index && this.f();
      }
      I.prototype.f = function () {
        var d = this.buffer,
          a,
          c = d.length,
          e = new (G ? Uint8Array : Array)(c << 1);
        if (G) e.set(d);else for (a = 0; a < c; ++a) e[a] = d[a];
        return this.buffer = e;
      };
      I.prototype.d = function (d, a, c) {
        var e = this.buffer,
          b = this.index,
          f = this.i,
          g = e[b],
          h;
        c && 1 < a && (d = 8 < a ? (Q[d & 255] << 24 | Q[d >>> 8 & 255] << 16 | Q[d >>> 16 & 255] << 8 | Q[d >>> 24 & 255]) >> 32 - a : Q[d] >> 8 - a);
        if (8 > a + f) g = g << a | d, f += a;else for (h = 0; h < a; ++h) g = g << 1 | d >> a - h - 1 & 1, 8 === ++f && (f = 0, e[b++] = Q[g], g = 0, b === e.length && (e = this.f()));
        e[b] = g;
        this.buffer = e;
        this.i = f;
        this.index = b;
      };
      I.prototype.finish = function () {
        var d = this.buffer,
          a = this.index,
          c;
        0 < this.i && (d[a] <<= 8 - this.i, d[a] = Q[d[a]], a++);
        G ? c = d.subarray(0, a) : (d.length = a, c = d);
        return c;
      };
      var ba = new (G ? Uint8Array : Array)(256),
        ca;
      for (ca = 0; 256 > ca; ++ca) {
        for (var R = ca, ha = R, ia = 7, R = R >>> 1; R; R >>>= 1) ha <<= 1, ha |= R & 1, --ia;
        ba[ca] = (ha << ia & 255) >>> 0;
      }
      var Q = ba;
      function ja(d) {
        this.buffer = new (G ? Uint16Array : Array)(2 * d);
        this.length = 0;
      }
      ja.prototype.getParent = function (d) {
        return 2 * ((d - 2) / 4 | 0);
      };
      ja.prototype.push = function (d, a) {
        var c,
          e,
          b = this.buffer,
          f;
        c = this.length;
        b[this.length++] = a;
        for (b[this.length++] = d; 0 < c;) if (e = this.getParent(c), b[c] > b[e]) f = b[c], b[c] = b[e], b[e] = f, f = b[c + 1], b[c + 1] = b[e + 1], b[e + 1] = f, c = e;else break;
        return this.length;
      };
      ja.prototype.pop = function () {
        var d,
          a,
          c = this.buffer,
          e,
          b,
          f;
        a = c[0];
        d = c[1];
        this.length -= 2;
        c[0] = c[this.length];
        c[1] = c[this.length + 1];
        for (f = 0;;) {
          b = 2 * f + 2;
          if (b >= this.length) break;
          b + 2 < this.length && c[b + 2] > c[b] && (b += 2);
          if (c[b] > c[f]) e = c[f], c[f] = c[b], c[b] = e, e = c[f + 1], c[f + 1] = c[b + 1], c[b + 1] = e;else break;
          f = b;
        }
        return {
          index: d,
          value: a,
          length: this.length
        };
      };
      function S(d) {
        var a = d.length,
          c = 0,
          e = Number.POSITIVE_INFINITY,
          b,
          f,
          g,
          h,
          k,
          p,
          q,
          r,
          n,
          l;
        for (r = 0; r < a; ++r) d[r] > c && (c = d[r]), d[r] < e && (e = d[r]);
        b = 1 << c;
        f = new (G ? Uint32Array : Array)(b);
        g = 1;
        h = 0;
        for (k = 2; g <= c;) {
          for (r = 0; r < a; ++r) if (d[r] === g) {
            p = 0;
            q = h;
            for (n = 0; n < g; ++n) p = p << 1 | q & 1, q >>= 1;
            l = g << 16 | r;
            for (n = p; n < b; n += k) f[n] = l;
            ++h;
          }
          ++g;
          h <<= 1;
          k <<= 1;
        }
        return [f, c, e];
      }
      function ka(d, a) {
        this.h = na;
        this.w = 0;
        this.input = G && d instanceof Array ? new Uint8Array(d) : d;
        this.b = 0;
        a && (a.lazy && (this.w = a.lazy), "number" === typeof a.compressionType && (this.h = a.compressionType), a.outputBuffer && (this.a = G && a.outputBuffer instanceof Array ? new Uint8Array(a.outputBuffer) : a.outputBuffer), "number" === typeof a.outputIndex && (this.b = a.outputIndex));
        this.a || (this.a = new (G ? Uint8Array : Array)(32768));
      }
      var na = 2,
        oa = {
          NONE: 0,
          r: 1,
          k: na,
          N: 3
        },
        pa = [],
        T;
      for (T = 0; 288 > T; T++) switch (z) {
        case 143 >= T:
          pa.push([T + 48, 8]);
          break;
        case 255 >= T:
          pa.push([T - 144 + 400, 9]);
          break;
        case 279 >= T:
          pa.push([T - 256 + 0, 7]);
          break;
        case 287 >= T:
          pa.push([T - 280 + 192, 8]);
          break;
        default:
          m("invalid literal: " + T);
      }
      ka.prototype.j = function () {
        var d,
          a,
          c,
          e,
          b = this.input;
        switch (this.h) {
          case 0:
            c = 0;
            for (e = b.length; c < e;) {
              a = G ? b.subarray(c, c + 65535) : b.slice(c, c + 65535);
              c += a.length;
              var f = a,
                g = c === e,
                h = w,
                k = w,
                p = w,
                q = w,
                r = w,
                n = this.a,
                l = this.b;
              if (G) {
                for (n = new Uint8Array(this.a.buffer); n.length <= l + f.length + 5;) n = new Uint8Array(n.length << 1);
                n.set(this.a);
              }
              h = g ? 1 : 0;
              n[l++] = h | 0;
              k = f.length;
              p = ~k + 65536 & 65535;
              n[l++] = k & 255;
              n[l++] = k >>> 8 & 255;
              n[l++] = p & 255;
              n[l++] = p >>> 8 & 255;
              if (G) n.set(f, l), l += f.length, n = n.subarray(0, l);else {
                q = 0;
                for (r = f.length; q < r; ++q) n[l++] = f[q];
                n.length = l;
              }
              this.b = l;
              this.a = n;
            }
            break;
          case 1:
            var s = new I(G ? new Uint8Array(this.a.buffer) : this.a, this.b);
            s.d(1, 1, z);
            s.d(1, 2, z);
            var t = qa(this, b),
              x,
              E,
              B;
            x = 0;
            for (E = t.length; x < E; x++) if (B = t[x], I.prototype.d.apply(s, pa[B]), 256 < B) s.d(t[++x], t[++x], z), s.d(t[++x], 5), s.d(t[++x], t[++x], z);else if (256 === B) break;
            this.a = s.finish();
            this.b = this.a.length;
            break;
          case na:
            var C = new I(G ? new Uint8Array(this.a.buffer) : this.a, this.b),
              L,
              v,
              M,
              Y,
              Z,
              gb = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
              da,
              Fa,
              ea,
              Ga,
              la,
              sa = Array(19),
              Ha,
              $,
              ma,
              D,
              Ia;
            L = na;
            C.d(1, 1, z);
            C.d(L, 2, z);
            v = qa(this, b);
            da = ra(this.L, 15);
            Fa = ta(da);
            ea = ra(this.K, 7);
            Ga = ta(ea);
            for (M = 286; 257 < M && 0 === da[M - 1]; M--);
            for (Y = 30; 1 < Y && 0 === ea[Y - 1]; Y--);
            var Ja = M,
              Ka = Y,
              K = new (G ? Uint32Array : Array)(Ja + Ka),
              u,
              N,
              y,
              fa,
              J = new (G ? Uint32Array : Array)(316),
              H,
              F,
              O = new (G ? Uint8Array : Array)(19);
            for (u = N = 0; u < Ja; u++) K[N++] = da[u];
            for (u = 0; u < Ka; u++) K[N++] = ea[u];
            if (!G) {
              u = 0;
              for (fa = O.length; u < fa; ++u) O[u] = 0;
            }
            u = H = 0;
            for (fa = K.length; u < fa; u += N) {
              for (N = 1; u + N < fa && K[u + N] === K[u]; ++N);
              y = N;
              if (0 === K[u]) {
                if (3 > y) for (; 0 < y--;) J[H++] = 0, O[0]++;else for (; 0 < y;) F = 138 > y ? y : 138, F > y - 3 && F < y && (F = y - 3), 10 >= F ? (J[H++] = 17, J[H++] = F - 3, O[17]++) : (J[H++] = 18, J[H++] = F - 11, O[18]++), y -= F;
              } else if (J[H++] = K[u], O[K[u]]++, y--, 3 > y) for (; 0 < y--;) J[H++] = K[u], O[K[u]]++;else for (; 0 < y;) F = 6 > y ? y : 6, F > y - 3 && F < y && (F = y - 3), J[H++] = 16, J[H++] = F - 3, O[16]++, y -= F;
            }
            d = G ? J.subarray(0, H) : J.slice(0, H);
            la = ra(O, 7);
            for (D = 0; 19 > D; D++) sa[D] = la[gb[D]];
            for (Z = 19; 4 < Z && 0 === sa[Z - 1]; Z--);
            Ha = ta(la);
            C.d(M - 257, 5, z);
            C.d(Y - 1, 5, z);
            C.d(Z - 4, 4, z);
            for (D = 0; D < Z; D++) C.d(sa[D], 3, z);
            D = 0;
            for (Ia = d.length; D < Ia; D++) if ($ = d[D], C.d(Ha[$], la[$], z), 16 <= $) {
              D++;
              switch ($) {
                case 16:
                  ma = 2;
                  break;
                case 17:
                  ma = 3;
                  break;
                case 18:
                  ma = 7;
                  break;
                default:
                  m("invalid code: " + $);
              }
              C.d(d[D], ma, z);
            }
            var La = [Fa, da],
              Ma = [Ga, ea],
              P,
              Na,
              ga,
              va,
              Oa,
              Pa,
              Qa,
              Ra;
            Oa = La[0];
            Pa = La[1];
            Qa = Ma[0];
            Ra = Ma[1];
            P = 0;
            for (Na = v.length; P < Na; ++P) if (ga = v[P], C.d(Oa[ga], Pa[ga], z), 256 < ga) C.d(v[++P], v[++P], z), va = v[++P], C.d(Qa[va], Ra[va], z), C.d(v[++P], v[++P], z);else if (256 === ga) break;
            this.a = C.finish();
            this.b = this.a.length;
            break;
          default:
            m("invalid compression type");
        }
        return this.a;
      };
      function ua(d, a) {
        this.length = d;
        this.G = a;
      }
      var wa = function () {
          function d(b) {
            switch (z) {
              case 3 === b:
                return [257, b - 3, 0];
              case 4 === b:
                return [258, b - 4, 0];
              case 5 === b:
                return [259, b - 5, 0];
              case 6 === b:
                return [260, b - 6, 0];
              case 7 === b:
                return [261, b - 7, 0];
              case 8 === b:
                return [262, b - 8, 0];
              case 9 === b:
                return [263, b - 9, 0];
              case 10 === b:
                return [264, b - 10, 0];
              case 12 >= b:
                return [265, b - 11, 1];
              case 14 >= b:
                return [266, b - 13, 1];
              case 16 >= b:
                return [267, b - 15, 1];
              case 18 >= b:
                return [268, b - 17, 1];
              case 22 >= b:
                return [269, b - 19, 2];
              case 26 >= b:
                return [270, b - 23, 2];
              case 30 >= b:
                return [271, b - 27, 2];
              case 34 >= b:
                return [272, b - 31, 2];
              case 42 >= b:
                return [273, b - 35, 3];
              case 50 >= b:
                return [274, b - 43, 3];
              case 58 >= b:
                return [275, b - 51, 3];
              case 66 >= b:
                return [276, b - 59, 3];
              case 82 >= b:
                return [277, b - 67, 4];
              case 98 >= b:
                return [278, b - 83, 4];
              case 114 >= b:
                return [279, b - 99, 4];
              case 130 >= b:
                return [280, b - 115, 4];
              case 162 >= b:
                return [281, b - 131, 5];
              case 194 >= b:
                return [282, b - 163, 5];
              case 226 >= b:
                return [283, b - 195, 5];
              case 257 >= b:
                return [284, b - 227, 5];
              case 258 === b:
                return [285, b - 258, 0];
              default:
                m("invalid length: " + b);
            }
          }
          var a = [],
            c,
            e;
          for (c = 3; 258 >= c; c++) e = d(c), a[c] = e[2] << 24 | e[1] << 16 | e[0];
          return a;
        }(),
        xa = G ? new Uint32Array(wa) : wa;
      function qa(d, a) {
        function c(b, c) {
          var a = b.G,
            d = [],
            e = 0,
            f;
          f = xa[b.length];
          d[e++] = f & 65535;
          d[e++] = f >> 16 & 255;
          d[e++] = f >> 24;
          var g;
          switch (z) {
            case 1 === a:
              g = [0, a - 1, 0];
              break;
            case 2 === a:
              g = [1, a - 2, 0];
              break;
            case 3 === a:
              g = [2, a - 3, 0];
              break;
            case 4 === a:
              g = [3, a - 4, 0];
              break;
            case 6 >= a:
              g = [4, a - 5, 1];
              break;
            case 8 >= a:
              g = [5, a - 7, 1];
              break;
            case 12 >= a:
              g = [6, a - 9, 2];
              break;
            case 16 >= a:
              g = [7, a - 13, 2];
              break;
            case 24 >= a:
              g = [8, a - 17, 3];
              break;
            case 32 >= a:
              g = [9, a - 25, 3];
              break;
            case 48 >= a:
              g = [10, a - 33, 4];
              break;
            case 64 >= a:
              g = [11, a - 49, 4];
              break;
            case 96 >= a:
              g = [12, a - 65, 5];
              break;
            case 128 >= a:
              g = [13, a - 97, 5];
              break;
            case 192 >= a:
              g = [14, a - 129, 6];
              break;
            case 256 >= a:
              g = [15, a - 193, 6];
              break;
            case 384 >= a:
              g = [16, a - 257, 7];
              break;
            case 512 >= a:
              g = [17, a - 385, 7];
              break;
            case 768 >= a:
              g = [18, a - 513, 8];
              break;
            case 1024 >= a:
              g = [19, a - 769, 8];
              break;
            case 1536 >= a:
              g = [20, a - 1025, 9];
              break;
            case 2048 >= a:
              g = [21, a - 1537, 9];
              break;
            case 3072 >= a:
              g = [22, a - 2049, 10];
              break;
            case 4096 >= a:
              g = [23, a - 3073, 10];
              break;
            case 6144 >= a:
              g = [24, a - 4097, 11];
              break;
            case 8192 >= a:
              g = [25, a - 6145, 11];
              break;
            case 12288 >= a:
              g = [26, a - 8193, 12];
              break;
            case 16384 >= a:
              g = [27, a - 12289, 12];
              break;
            case 24576 >= a:
              g = [28, a - 16385, 13];
              break;
            case 32768 >= a:
              g = [29, a - 24577, 13];
              break;
            default:
              m("invalid distance");
          }
          f = g;
          d[e++] = f[0];
          d[e++] = f[1];
          d[e++] = f[2];
          var h, k;
          h = 0;
          for (k = d.length; h < k; ++h) n[l++] = d[h];
          t[d[0]]++;
          x[d[3]]++;
          s = b.length + c - 1;
          r = null;
        }
        var e,
          b,
          f,
          g,
          h,
          k = {},
          p,
          q,
          r,
          n = G ? new Uint16Array(2 * a.length) : [],
          l = 0,
          s = 0,
          t = new (G ? Uint32Array : Array)(286),
          x = new (G ? Uint32Array : Array)(30),
          E = d.w,
          B;
        if (!G) {
          for (f = 0; 285 >= f;) t[f++] = 0;
          for (f = 0; 29 >= f;) x[f++] = 0;
        }
        t[256] = 1;
        e = 0;
        for (b = a.length; e < b; ++e) {
          f = h = 0;
          for (g = 3; f < g && e + f !== b; ++f) h = h << 8 | a[e + f];
          k[h] === w && (k[h] = []);
          p = k[h];
          if (!(0 < s--)) {
            for (; 0 < p.length && 32768 < e - p[0];) p.shift();
            if (e + 3 >= b) {
              r && c(r, -1);
              f = 0;
              for (g = b - e; f < g; ++f) B = a[e + f], n[l++] = B, ++t[B];
              break;
            }
            0 < p.length ? (q = ya(a, e, p), r ? r.length < q.length ? (B = a[e - 1], n[l++] = B, ++t[B], c(q, 0)) : c(r, -1) : q.length < E ? r = q : c(q, 0)) : r ? c(r, -1) : (B = a[e], n[l++] = B, ++t[B]);
          }
          p.push(e);
        }
        n[l++] = 256;
        t[256]++;
        d.L = t;
        d.K = x;
        return G ? n.subarray(0, l) : n;
      }
      function ya(d, a, c) {
        var e,
          b,
          f = 0,
          g,
          h,
          k,
          p,
          q = d.length;
        h = 0;
        p = c.length;
        a: for (; h < p; h++) {
          e = c[p - h - 1];
          g = 3;
          if (3 < f) {
            for (k = f; 3 < k; k--) if (d[e + k - 1] !== d[a + k - 1]) continue a;
            g = f;
          }
          for (; 258 > g && a + g < q && d[e + g] === d[a + g];) ++g;
          g > f && (b = e, f = g);
          if (258 === g) break;
        }
        return new ua(f, a - b);
      }
      function ra(d, a) {
        var c = d.length,
          e = new ja(572),
          b = new (G ? Uint8Array : Array)(c),
          f,
          g,
          h,
          k,
          p;
        if (!G) for (k = 0; k < c; k++) b[k] = 0;
        for (k = 0; k < c; ++k) 0 < d[k] && e.push(k, d[k]);
        f = Array(e.length / 2);
        g = new (G ? Uint32Array : Array)(e.length / 2);
        if (1 === f.length) return b[e.pop().index] = 1, b;
        k = 0;
        for (p = e.length / 2; k < p; ++k) f[k] = e.pop(), g[k] = f[k].value;
        h = za(g, g.length, a);
        k = 0;
        for (p = f.length; k < p; ++k) b[f[k].index] = h[k];
        return b;
      }
      function za(d, a, c) {
        function e(b) {
          var c = k[b][p[b]];
          c === a ? (e(b + 1), e(b + 1)) : --g[c];
          ++p[b];
        }
        var b = new (G ? Uint16Array : Array)(c),
          f = new (G ? Uint8Array : Array)(c),
          g = new (G ? Uint8Array : Array)(a),
          h = Array(c),
          k = Array(c),
          p = Array(c),
          q = (1 << c) - a,
          r = 1 << c - 1,
          n,
          l,
          s,
          t,
          x;
        b[c - 1] = a;
        for (l = 0; l < c; ++l) q < r ? f[l] = 0 : (f[l] = 1, q -= r), q <<= 1, b[c - 2 - l] = (b[c - 1 - l] / 2 | 0) + a;
        b[0] = f[0];
        h[0] = Array(b[0]);
        k[0] = Array(b[0]);
        for (l = 1; l < c; ++l) b[l] > 2 * b[l - 1] + f[l] && (b[l] = 2 * b[l - 1] + f[l]), h[l] = Array(b[l]), k[l] = Array(b[l]);
        for (n = 0; n < a; ++n) g[n] = c;
        for (s = 0; s < b[c - 1]; ++s) h[c - 1][s] = d[s], k[c - 1][s] = s;
        for (n = 0; n < c; ++n) p[n] = 0;
        1 === f[c - 1] && (--g[0], ++p[c - 1]);
        for (l = c - 2; 0 <= l; --l) {
          t = n = 0;
          x = p[l + 1];
          for (s = 0; s < b[l]; s++) t = h[l + 1][x] + h[l + 1][x + 1], t > d[n] ? (h[l][s] = t, k[l][s] = a, x += 2) : (h[l][s] = d[n], k[l][s] = n, ++n);
          p[l] = 0;
          1 === f[l] && e(l);
        }
        return g;
      }
      function ta(d) {
        var a = new (G ? Uint16Array : Array)(d.length),
          c = [],
          e = [],
          b = 0,
          f,
          g,
          h,
          k;
        f = 0;
        for (g = d.length; f < g; f++) c[d[f]] = (c[d[f]] | 0) + 1;
        f = 1;
        for (g = 16; f <= g; f++) e[f] = b, b += c[f] | 0, b <<= 1;
        f = 0;
        for (g = d.length; f < g; f++) {
          b = e[d[f]];
          e[d[f]] += 1;
          h = a[f] = 0;
          for (k = d[f]; h < k; h++) a[f] = a[f] << 1 | b & 1, b >>>= 1;
        }
        return a;
      }
      function U(d, a) {
        this.l = [];
        this.m = 32768;
        this.e = this.g = this.c = this.q = 0;
        this.input = G ? new Uint8Array(d) : d;
        this.s = !1;
        this.n = Aa;
        this.B = !1;
        if (a || !(a = {})) a.index && (this.c = a.index), a.bufferSize && (this.m = a.bufferSize), a.bufferType && (this.n = a.bufferType), a.resize && (this.B = a.resize);
        switch (this.n) {
          case Ba:
            this.b = 32768;
            this.a = new (G ? Uint8Array : Array)(32768 + this.m + 258);
            break;
          case Aa:
            this.b = 0;
            this.a = new (G ? Uint8Array : Array)(this.m);
            this.f = this.J;
            this.t = this.H;
            this.o = this.I;
            break;
          default:
            m(Error("invalid inflate mode"));
        }
      }
      var Ba = 0,
        Aa = 1,
        Ca = {
          D: Ba,
          C: Aa
        };
      U.prototype.p = function () {
        for (; !this.s;) {
          var d = V(this, 3);
          d & 1 && (this.s = z);
          d >>>= 1;
          switch (d) {
            case 0:
              var a = this.input,
                c = this.c,
                e = this.a,
                b = this.b,
                f = a.length,
                g = w,
                h = w,
                k = e.length,
                p = w;
              this.e = this.g = 0;
              c + 1 >= f && m(Error("invalid uncompressed block header: LEN"));
              g = a[c++] | a[c++] << 8;
              c + 1 >= f && m(Error("invalid uncompressed block header: NLEN"));
              h = a[c++] | a[c++] << 8;
              g === ~h && m(Error("invalid uncompressed block header: length verify"));
              c + g > a.length && m(Error("input buffer is broken"));
              switch (this.n) {
                case Ba:
                  for (; b + g > e.length;) {
                    p = k - b;
                    g -= p;
                    if (G) e.set(a.subarray(c, c + p), b), b += p, c += p;else for (; p--;) e[b++] = a[c++];
                    this.b = b;
                    e = this.f();
                    b = this.b;
                  }
                  break;
                case Aa:
                  for (; b + g > e.length;) e = this.f({
                    v: 2
                  });
                  break;
                default:
                  m(Error("invalid inflate mode"));
              }
              if (G) e.set(a.subarray(c, c + g), b), b += g, c += g;else for (; g--;) e[b++] = a[c++];
              this.c = c;
              this.b = b;
              this.a = e;
              break;
            case 1:
              this.o(Da, Ea);
              break;
            case 2:
              for (var q = V(this, 5) + 257, r = V(this, 5) + 1, n = V(this, 4) + 4, l = new (G ? Uint8Array : Array)(Sa.length), s = w, t = w, x = w, E = w, B = w, C = w, L = w, v = w, M = w, v = 0; v < n; ++v) l[Sa[v]] = V(this, 3);
              if (!G) {
                v = n;
                for (n = l.length; v < n; ++v) l[Sa[v]] = 0;
              }
              s = S(l);
              E = new (G ? Uint8Array : Array)(q + r);
              v = 0;
              for (M = q + r; v < M;) switch (B = Ta(this, s), B) {
                case 16:
                  for (L = 3 + V(this, 2); L--;) E[v++] = C;
                  break;
                case 17:
                  for (L = 3 + V(this, 3); L--;) E[v++] = 0;
                  C = 0;
                  break;
                case 18:
                  for (L = 11 + V(this, 7); L--;) E[v++] = 0;
                  C = 0;
                  break;
                default:
                  C = E[v++] = B;
              }
              t = G ? S(E.subarray(0, q)) : S(E.slice(0, q));
              x = G ? S(E.subarray(q)) : S(E.slice(q));
              this.o(t, x);
              break;
            default:
              m(Error("unknown BTYPE: " + d));
          }
        }
        return this.t();
      };
      var Ua = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15],
        Sa = G ? new Uint16Array(Ua) : Ua,
        Va = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258, 258, 258],
        Wa = G ? new Uint16Array(Va) : Va,
        Xa = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0],
        Ya = G ? new Uint8Array(Xa) : Xa,
        Za = [1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577],
        $a = G ? new Uint16Array(Za) : Za,
        ab = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13],
        bb = G ? new Uint8Array(ab) : ab,
        cb = new (G ? Uint8Array : Array)(288),
        W,
        db;
      W = 0;
      for (db = cb.length; W < db; ++W) cb[W] = 143 >= W ? 8 : 255 >= W ? 9 : 279 >= W ? 7 : 8;
      var Da = S(cb),
        eb = new (G ? Uint8Array : Array)(30),
        fb,
        hb;
      fb = 0;
      for (hb = eb.length; fb < hb; ++fb) eb[fb] = 5;
      var Ea = S(eb);
      function V(d, a) {
        for (var c = d.g, e = d.e, b = d.input, f = d.c, g = b.length, h; e < a;) f >= g && m(Error("input buffer is broken")), c |= b[f++] << e, e += 8;
        h = c & (1 << a) - 1;
        d.g = c >>> a;
        d.e = e - a;
        d.c = f;
        return h;
      }
      function Ta(d, a) {
        for (var c = d.g, e = d.e, b = d.input, f = d.c, g = b.length, h = a[0], k = a[1], p, q; e < k && !(f >= g);) c |= b[f++] << e, e += 8;
        p = h[c & (1 << k) - 1];
        q = p >>> 16;
        q > e && m(Error("invalid code length: " + q));
        d.g = c >> q;
        d.e = e - q;
        d.c = f;
        return p & 65535;
      }
      U.prototype.o = function (d, a) {
        var c = this.a,
          e = this.b;
        this.u = d;
        for (var b = c.length - 258, f, g, h, k; 256 !== (f = Ta(this, d));) if (256 > f) e >= b && (this.b = e, c = this.f(), e = this.b), c[e++] = f;else {
          g = f - 257;
          k = Wa[g];
          0 < Ya[g] && (k += V(this, Ya[g]));
          f = Ta(this, a);
          h = $a[f];
          0 < bb[f] && (h += V(this, bb[f]));
          e >= b && (this.b = e, c = this.f(), e = this.b);
          for (; k--;) c[e] = c[e++ - h];
        }
        for (; 8 <= this.e;) this.e -= 8, this.c--;
        this.b = e;
      };
      U.prototype.I = function (d, a) {
        var c = this.a,
          e = this.b;
        this.u = d;
        for (var b = c.length, f, g, h, k; 256 !== (f = Ta(this, d));) if (256 > f) e >= b && (c = this.f(), b = c.length), c[e++] = f;else {
          g = f - 257;
          k = Wa[g];
          0 < Ya[g] && (k += V(this, Ya[g]));
          f = Ta(this, a);
          h = $a[f];
          0 < bb[f] && (h += V(this, bb[f]));
          e + k > b && (c = this.f(), b = c.length);
          for (; k--;) c[e] = c[e++ - h];
        }
        for (; 8 <= this.e;) this.e -= 8, this.c--;
        this.b = e;
      };
      U.prototype.f = function () {
        var d = new (G ? Uint8Array : Array)(this.b - 32768),
          a = this.b - 32768,
          c,
          e,
          b = this.a;
        if (G) d.set(b.subarray(32768, d.length));else {
          c = 0;
          for (e = d.length; c < e; ++c) d[c] = b[c + 32768];
        }
        this.l.push(d);
        this.q += d.length;
        if (G) b.set(b.subarray(a, a + 32768));else for (c = 0; 32768 > c; ++c) b[c] = b[a + c];
        this.b = 32768;
        return b;
      };
      U.prototype.J = function (d) {
        var a,
          c = this.input.length / this.c + 1 | 0,
          e,
          b,
          f,
          g = this.input,
          h = this.a;
        d && ("number" === typeof d.v && (c = d.v), "number" === typeof d.F && (c += d.F));
        2 > c ? (e = (g.length - this.c) / this.u[2], f = 258 * (e / 2) | 0, b = f < h.length ? h.length + f : h.length << 1) : b = h.length * c;
        G ? (a = new Uint8Array(b), a.set(h)) : a = h;
        return this.a = a;
      };
      U.prototype.t = function () {
        var d = 0,
          a = this.a,
          c = this.l,
          e,
          b = new (G ? Uint8Array : Array)(this.q + (this.b - 32768)),
          f,
          g,
          h,
          k;
        if (0 === c.length) return G ? this.a.subarray(32768, this.b) : this.a.slice(32768, this.b);
        f = 0;
        for (g = c.length; f < g; ++f) {
          e = c[f];
          h = 0;
          for (k = e.length; h < k; ++h) b[d++] = e[h];
        }
        f = 32768;
        for (g = this.b; f < g; ++f) b[d++] = a[f];
        this.l = [];
        return this.buffer = b;
      };
      U.prototype.H = function () {
        var d,
          a = this.b;
        G ? this.B ? (d = new Uint8Array(a), d.set(this.a.subarray(0, a))) : d = this.a.subarray(0, a) : (this.a.length > a && (this.a.length = a), d = this.a);
        return this.buffer = d;
      };
      function ib(d) {
        if ("string" === typeof d) {
          var a = d.split(""),
            c,
            e;
          c = 0;
          for (e = a.length; c < e; c++) a[c] = (a[c].charCodeAt(0) & 255) >>> 0;
          d = a;
        }
        for (var b = 1, f = 0, g = d.length, h, k = 0; 0 < g;) {
          h = 1024 < g ? 1024 : g;
          g -= h;
          do b += d[k++], f += b; while (--h);
          b %= 65521;
          f %= 65521;
        }
        return (f << 16 | b) >>> 0;
      }
      function jb(d, a) {
        var c, e;
        this.input = d;
        this.c = 0;
        if (a || !(a = {})) a.index && (this.c = a.index), a.verify && (this.M = a.verify);
        c = d[this.c++];
        e = d[this.c++];
        switch (c & 15) {
          case kb:
            this.method = kb;
            break;
          default:
            m(Error("unsupported compression method"));
        }
        0 !== ((c << 8) + e) % 31 && m(Error("invalid fcheck flag:" + ((c << 8) + e) % 31));
        e & 32 && m(Error("fdict flag is not supported"));
        this.A = new U(d, {
          index: this.c,
          bufferSize: a.bufferSize,
          bufferType: a.bufferType,
          resize: a.resize
        });
      }
      jb.prototype.p = function () {
        var d = this.input,
          a,
          c;
        a = this.A.p();
        this.c = this.A.c;
        this.M && (c = (d[this.c++] << 24 | d[this.c++] << 16 | d[this.c++] << 8 | d[this.c++]) >>> 0, c !== ib(a) && m(Error("invalid adler-32 checksum")));
        return a;
      };
      var kb = 8;
      function lb(d, a) {
        this.input = d;
        this.a = new (G ? Uint8Array : Array)(32768);
        this.h = X.k;
        var c = {},
          e;
        if ((a || !(a = {})) && "number" === typeof a.compressionType) this.h = a.compressionType;
        for (e in a) c[e] = a[e];
        c.outputBuffer = this.a;
        this.z = new ka(this.input, c);
      }
      var X = oa;
      lb.prototype.j = function () {
        var d,
          a,
          c,
          e,
          b,
          f,
          g,
          h = 0;
        g = this.a;
        d = kb;
        switch (d) {
          case kb:
            a = Math.LOG2E * Math.log(32768) - 8;
            break;
          default:
            m(Error("invalid compression method"));
        }
        c = a << 4 | d;
        g[h++] = c;
        switch (d) {
          case kb:
            switch (this.h) {
              case X.NONE:
                b = 0;
                break;
              case X.r:
                b = 1;
                break;
              case X.k:
                b = 2;
                break;
              default:
                m(Error("unsupported compression type"));
            }
            break;
          default:
            m(Error("invalid compression method"));
        }
        e = b << 6 | 0;
        g[h++] = e | 31 - (256 * c + e) % 31;
        f = ib(this.input);
        this.z.b = h;
        g = this.z.j();
        h = g.length;
        G && (g = new Uint8Array(g.buffer), g.length <= h + 4 && (this.a = new Uint8Array(g.length + 4), this.a.set(g), g = this.a), g = g.subarray(0, h + 4));
        g[h++] = f >> 24 & 255;
        g[h++] = f >> 16 & 255;
        g[h++] = f >> 8 & 255;
        g[h++] = f & 255;
        return g;
      };
      function mb(d, a) {
        var c, e, b, f;
        if (Object.keys) c = Object.keys(a);else for (e in c = [], b = 0, a) c[b++] = e;
        b = 0;
        for (f = c.length; b < f; ++b) e = c[b], A(d + "." + e, a[e]);
      }
      A("Zlib.Inflate", jb);
      A("Zlib.Inflate.prototype.decompress", jb.prototype.p);
      mb("Zlib.Inflate.BufferType", {
        ADAPTIVE: Ca.C,
        BLOCK: Ca.D
      });
      A("Zlib.Deflate", lb);
      A("Zlib.Deflate.compress", function (d, a) {
        return new lb(d, a).j();
      });
      A("Zlib.Deflate.prototype.compress", lb.prototype.j);
      mb("Zlib.Deflate.CompressionType", {
        NONE: X.NONE,
        FIXED: X.r,
        DYNAMIC: X.k
      });
    }).call(self);

    var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
    if (!Math.hypot) Math.hypot = function () {
      var y = 0,
        i = arguments.length;
      while (i--) {
        y += arguments[i] * arguments[i];
      }
      return Math.sqrt(y);
    };

    function create$1() {
      var out = new ARRAY_TYPE(3);
      if (ARRAY_TYPE != Float32Array) {
        out[0] = 0;
        out[1] = 0;
        out[2] = 0;
      }
      return out;
    }
    function subtract(out, a, b) {
      out[0] = a[0] - b[0];
      out[1] = a[1] - b[1];
      out[2] = a[2] - b[2];
      return out;
    }
    function normalize(out, a) {
      var x = a[0];
      var y = a[1];
      var z = a[2];
      var len = x * x + y * y + z * z;
      if (len > 0) {
        len = 1 / Math.sqrt(len);
      }
      out[0] = a[0] * len;
      out[1] = a[1] * len;
      out[2] = a[2] * len;
      return out;
    }
    function cross(out, a, b) {
      var ax = a[0],
        ay = a[1],
        az = a[2];
      var bx = b[0],
        by = b[1],
        bz = b[2];
      out[0] = ay * bz - az * by;
      out[1] = az * bx - ax * bz;
      out[2] = ax * by - ay * bx;
      return out;
    }
    var sub = subtract;
    (function () {
      var vec = create$1();
      return function (a, stride, offset, count, fn, arg) {
        var i, l;
        if (!stride) {
          stride = 3;
        }
        if (!offset) {
          offset = 0;
        }
        if (count) {
          l = Math.min(count * stride + offset, a.length);
        } else {
          l = a.length;
        }
        for (i = offset; i < l; i += stride) {
          vec[0] = a[i];
          vec[1] = a[i + 1];
          vec[2] = a[i + 2];
          fn(vec, vec, arg);
          a[i] = vec[0];
          a[i + 1] = vec[1];
          a[i + 2] = vec[2];
        }
        return a;
      };
    })();

    function create() {
      var out = new ARRAY_TYPE(2);
      if (ARRAY_TYPE != Float32Array) {
        out[0] = 0;
        out[1] = 0;
      }
      return out;
    }
    function set(out, x, y) {
      out[0] = x;
      out[1] = y;
      return out;
    }
    (function () {
      var vec = create();
      return function (a, stride, offset, count, fn, arg) {
        var i, l;
        if (!stride) {
          stride = 2;
        }
        if (!offset) {
          offset = 0;
        }
        if (count) {
          l = Math.min(count * stride + offset, a.length);
        } else {
          l = a.length;
        }
        for (i = offset; i < l; i += stride) {
          vec[0] = a[i];
          vec[1] = a[i + 1];
          fn(vec, vec, arg);
          a[i] = vec[0];
          a[i + 1] = vec[1];
        }
        return a;
      };
    })();

    var P0P1 = [];
    var P1P2 = [];
    var A$2 = [];
    var B = [];
    var C = [];
    var POSITIONS = [];
    var maxShort = 32767;
    var terrainStructure = {
      width: 64,
      height: 64,
      elementsPerHeight: 3,
      heightOffset: -1000,
      exaggeration: 1.0,
      heightScale: 0.001,
      elementMultiplier: 256,
      stride: 4,
      skirtHeight: 0.002,
      skirtOffset: 0.01
    };
    function lerp(p, q, time) {
      return (1.0 - time) * p + time * q;
    }
    var textDecoder = new TextDecoder('utf-8');
    function uint8ArrayToString(fileData) {
      return textDecoder.decode(fileData);
    }
    function decZlibBuffer(zBuffer) {
      if (zBuffer.length < 1000) {
        return null;
      }
      var inflate = new self.Zlib.Inflate(zBuffer);
      if (inflate) {
        return inflate.decompress();
      }
      return null;
    }
    function transformBuffer(zlibData) {
      var DataSize = 2;
      var dZlib = zlibData;
      var myW = terrainStructure.width;
      var myH = terrainStructure.height;
      var myBuffer = new Uint8Array(myW * myH * terrainStructure.stride);
      var i_height;
      var NN, NN_R;
      var jj_n, ii_n;
      for (var jj = 0; jj < myH; jj++) {
        for (var ii = 0; ii < myW; ii++) {
          jj_n = parseInt(149 * jj / (myH - 1));
          ii_n = parseInt(149 * ii / (myW - 1));
          {
            NN = DataSize * (jj_n * 150 + ii_n);
            i_height = dZlib[NN] + dZlib[NN + 1] * 256;
          }
          if (i_height > 10000 || i_height < -2000) {
            i_height = 0;
          }
          NN_R = (jj * myW + ii) * 4;
          var i_height_new = (i_height + 1000) / terrainStructure.heightScale;
          var elementMultiplier = terrainStructure.elementMultiplier;
          myBuffer[NN_R] = i_height_new / (elementMultiplier * elementMultiplier);
          myBuffer[NN_R + 1] = (i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier) / elementMultiplier;
          myBuffer[NN_R + 2] = i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier - myBuffer[NN_R + 1] * elementMultiplier;
          myBuffer[NN_R + 3] = 255;
        }
      }
      return myBuffer;
    }
    function zigZagDecode(value) {
      return value >> 1 ^ -(value & 1);
    }
    function zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer) {
      var count = uBuffer.length;
      var u = 0;
      var v = 0;
      var height = 0;
      for (var i = 0; i < count; ++i) {
        u += zigZagDecode(uBuffer[i]);
        v += zigZagDecode(vBuffer[i]);
        uBuffer[i] = u;
        vBuffer[i] = v;
        if (heightBuffer) {
          height += zigZagDecode(heightBuffer[i]);
          heightBuffer[i] = height;
        }
      }
    }
    function createHeightMap(heightmap, terrainWidth) {
      var width = terrainWidth,
        height = terrainWidth;
      var endRow = width + 1,
        endColum = height + 1;
      var elementsPerHeight = terrainStructure.elementsPerHeight;
      var heightOffset = terrainStructure.heightOffset;
      var exaggeration = 1;
      var heightScale = terrainStructure.heightScale;
      var elementMultiplier = terrainStructure.elementMultiplier;
      var stride = 4;
      var skirtHeight = terrainStructure.skirtHeight;
      var heights = new Float32Array(endRow * endColum);
      var index = 0;
      var min = Infinity;
      var max = -Infinity;
      for (var i = 0; i < endRow; i++) {
        var row = i >= height ? height - 1 : i;
        for (var j = 0; j < endColum; j++) {
          var colum = j >= width ? width - 1 : j;
          var heightSample = 0;
          var terrainOffset = row * (width * stride) + colum * stride;
          for (var elementOffset = 0; elementOffset < elementsPerHeight; elementOffset++) {
            heightSample = heightSample * elementMultiplier + heightmap[terrainOffset + elementOffset];
          }
          heightSample = (heightSample * heightScale + heightOffset) * exaggeration;
          heightSample -= skirtHeight;
          heights[index] = heightSample;
          if (heightSample < min) {
            min = heightSample;
          }
          if (heightSample > max) {
            max = heightSample;
          }
          index++;
        }
      }
      return {
        data: heights,
        min: min,
        max: max,
        width: 0,
        height: 0,
        tileSize: 0,
        image: null
      };
    }
    function generateTiandituTerrain(buffer, terrainWidth, tileSize) {
      var zBuffer = new Uint8Array(buffer);
      var dZlib = decZlibBuffer(zBuffer);
      if (!dZlib) {
        throw new Error(uint8ArrayToString(new Uint8Array(buffer)));
      }
      var heightBuffer = transformBuffer(dZlib);
      var result = createHeightMap(heightBuffer, terrainWidth - 1);
      result.width = result.height = terrainWidth;
      result.tileSize = tileSize;
      createTerrainImage(result);
      return result;
    }
    class Triangle {
      constructor(positions, a, b, c, radius) {
        this.p0 = [];
        this.p1 = [];
        this.p2 = [];
        this.normal = [];
        this.min = [];
        this.max = [];
        this.set(positions, a, b, c, radius);
      }
      set(positions, a, b, c, radius) {
        this.radius = radius;
        var x = a * 3;
        var y = a * 3 + 1;
        var z = a * 3 + 2;
        this.p0[0] = positions[x] * radius;
        this.p0[1] = positions[y] * radius;
        this.p0[2] = positions[z];
        x = b * 3;
        y = b * 3 + 1;
        z = b * 3 + 2;
        this.p1[0] = positions[x] * radius;
        this.p1[1] = positions[y] * radius;
        this.p1[2] = positions[z];
        x = c * 3;
        y = c * 3 + 1;
        z = c * 3 + 2;
        this.p2[0] = positions[x] * radius;
        this.p2[1] = positions[y] * radius;
        this.p2[2] = positions[z];
        this.min[0] = Math.min(this.p0[0], this.p1[0], this.p2[0]);
        this.min[1] = Math.min(this.p0[1], this.p1[1], this.p2[1]);
        this.max[0] = Math.max(this.p0[0], this.p1[0], this.p2[0]);
        this.max[1] = Math.max(this.p0[1], this.p1[1], this.p2[1]);
        var p0p1 = sub(P0P1, this.p1, this.p0);
        var p1p2 = sub(P1P2, this.p2, this.p1);
        this.normal = normalize(this.normal, cross(this.normal, p0p1, p1p2));
      }
      contains(x, y) {
        if (x < this.min[0] || x > this.max[0] || y < this.min[1] || y > this.max[1]) {
          return false;
        }
        set(A$2, this.p0[0], this.p0[1]);
        set(B, this.p1[0], this.p1[1]);
        set(C, this.p2[0], this.p2[1]);
        var SABC = calTriangleArae(A$2[0], A$2[1], B[0], B[1], C[0], C[1]);
        var SPAC = calTriangleArae(x, y, A$2[0], A$2[1], C[0], C[1]);
        var SPAB = calTriangleArae(x, y, A$2[0], A$2[1], B[0], B[1]);
        var SPBC = calTriangleArae(x, y, B[0], B[1], C[0], C[1]);
        return SPAC + SPAB + SPBC - SABC <= 0.0001;
      }
      getHeight(x, y) {
        var N = this.normal;
        return this.p0[2] - ((x - this.p0[0]) * N[0] + (y - this.p0[1]) * N[1]) / N[2];
      }
    }
    function calTriangleArae(x1, y1, x2, y2, x3, y3) {
      return Math.abs(x1 * y2 + x2 * y3 + x3 * y1 - x1 * y3 - x2 * y1 - x3 * y2) * 0.5;
    }
    var preTriangle = null;
    function findInTriangle(triangles, x, y) {
      if (preTriangle && preTriangle.contains(x, y)) {
        return preTriangle.getHeight(x, y);
      }
      for (var i = 0; i < triangles.length; i++) {
        if (triangles[i].contains(x, y)) {
          preTriangle = triangles[i];
          return triangles[i].getHeight(x, y);
        }
      }
      return 0;
    }
    var TRIANGLES = [];
    function cesiumTerrainToHeights(buffer, terrainWidth, tileSize) {
      var terrainData = generateCesiumTerrain(buffer);
      var {
        positions: positions,
        min: min,
        max: max,
        indices: indices,
        radius: radius
      } = terrainData;
      var triangles = [];
      var index = 0;
      for (var i = 0; i < indices.length; i += 3) {
        var triangle = TRIANGLES[index];
        if (triangle) {
          triangle.set(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
        } else {
          triangle = TRIANGLES[index] = new Triangle(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
        }
        index++;
        triangles.push(triangle);
      }
      var heights = new Float32Array(terrainWidth * terrainWidth);
      index = 0;
      for (var _i = 0; _i < terrainWidth; _i++) {
        for (var j = 0; j < terrainWidth; j++) {
          heights[index++] = findInTriangle(triangles, j / terrainWidth * radius * 2, _i / terrainWidth * radius * 2);
        }
      }
      var result = {
        data: heights,
        min: min,
        max: max,
        width: terrainWidth,
        height: terrainWidth,
        tileSize: tileSize
      };
      createTerrainImage(result);
      return result;
    }
    function generateCesiumTerrain(buffer) {
      var pos = 0;
      var cartesian3Elements = 3;
      var cartesian3Length = Float64Array.BYTES_PER_ELEMENT * cartesian3Elements;
      var encodedVertexElements = 3;
      var encodedVertexLength = Uint16Array.BYTES_PER_ELEMENT * encodedVertexElements;
      var triangleElements = 3;
      var bytesPerIndex = Uint16Array.BYTES_PER_ELEMENT;
      var view = new DataView(buffer);
      pos += cartesian3Length;
      var minimumHeight = view.getFloat32(pos, true);
      pos += Float32Array.BYTES_PER_ELEMENT;
      var maximumHeight = view.getFloat32(pos, true);
      pos += Float32Array.BYTES_PER_ELEMENT;
      pos += cartesian3Length;
      var radius = view.getFloat64(pos, true);
      pos += Float64Array.BYTES_PER_ELEMENT;
      pos += cartesian3Length;
      var vertexCount = view.getUint32(pos, true);
      pos += Uint32Array.BYTES_PER_ELEMENT;
      var encodedVertexBuffer = new Uint16Array(buffer, pos, vertexCount * 3);
      pos += vertexCount * encodedVertexLength;
      if (vertexCount > 64 * 1024) {
        bytesPerIndex = Uint32Array.BYTES_PER_ELEMENT;
      }
      var uBuffer = encodedVertexBuffer.subarray(0, vertexCount);
      var vBuffer = encodedVertexBuffer.subarray(vertexCount, 2 * vertexCount);
      var heightBuffer = encodedVertexBuffer.subarray(vertexCount * 2, 3 * vertexCount);
      zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer);
      if (pos % bytesPerIndex !== 0) {
        pos += bytesPerIndex - pos % bytesPerIndex;
      }
      var triangleCount = view.getUint32(pos, true);
      pos += Uint32Array.BYTES_PER_ELEMENT;
      var indices = vertexCount > 65536 ? new Uint32Array(buffer, pos, triangleCount * triangleElements) : new Uint16Array(buffer, pos, triangleCount * triangleElements);
      var highest = 0;
      var length = indices.length;
      for (var i = 0; i < length; ++i) {
        var code = indices[i];
        indices[i] = highest - code;
        if (code === 0) {
          ++highest;
        }
      }
      var terrain = {
        minimumHeight: minimumHeight,
        maximumHeight: maximumHeight,
        quantizedVertices: encodedVertexBuffer,
        indices: indices
      };
      var quantizedVertices = terrain.quantizedVertices;
      var quantizedVertexCount = quantizedVertices.length / 3;
      var uBuffer_1 = quantizedVertices.subarray(0, quantizedVertexCount);
      var vBuffer_1 = quantizedVertices.subarray(quantizedVertexCount, 2 * quantizedVertexCount);
      var heightBuffer_1 = quantizedVertices.subarray(quantizedVertexCount * 2, 3 * quantizedVertexCount);
      var positions = POSITIONS;
      for (var _i2 = 0; _i2 < quantizedVertexCount; ++_i2) {
        var rawU = uBuffer_1[_i2];
        var rawV = vBuffer_1[_i2];
        var u = rawU / maxShort;
        var v = rawV / maxShort;
        var height = lerp(minimumHeight, maximumHeight, heightBuffer_1[_i2] / maxShort);
        positions[_i2 * 3] = u;
        positions[_i2 * 3 + 1] = 1 - v;
        positions[_i2 * 3 + 2] = height;
      }
      return {
        positions: positions,
        radius: radius,
        min: minimumHeight,
        max: maximumHeight,
        indices: indices
      };
    }
    function createTerrainImage(terrainData) {
      var canvas = getCanvas$1();
      var {
        width: width,
        height: height,
        data: data,
        tileSize: tileSize
      } = terrainData;
      if (!width || !height || !data) {
        return;
      }
      try {
        resizeCanvas(canvas, width, height);
        var ctx = getCanvasContext(canvas);
        var imageData = ctx.createImageData(width, height);
        var out = [0, 0, 0];
        for (var i = 0, len = data.length; i < len; i++) {
          var _height = data[i];
          var [r, g, b] = encodeMapBox(_height, out);
          var idx = 4 * i;
          imageData.data[idx] = r;
          imageData.data[idx + 1] = g;
          imageData.data[idx + 2] = b;
          imageData.data[idx + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        var image = canvas.transferToImageBitmap();
        resizeCanvas(canvas, tileSize, tileSize);
        ctx = getCanvasContext(canvas);
        ctx.drawImage(image, 0, 0, width, height, 0, 0, tileSize, tileSize);
        terrainData.image = canvas.transferToImageBitmap();
      } catch (error) {
        console.log(error);
      }
    }
    function transformMapZen(imageData) {
      var data = imageData.data;
      var out = [0, 0, 0];
      for (var i = 0, len = data.length; i < len; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        var a = data[i + 3];
        if (a === 0) {
          continue;
        }
        var height = r * 256 + g + b / 256 - 32768;
        var [r1, g1, b1] = encodeMapBox(height, out);
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
      }
      return imageData;
    }
    function transformArcgis(result) {
      var {
        width: width,
        height: height,
        pixels: pixels
      } = result;
      var canvas = getCanvas$1();
      resizeCanvas(canvas, width, height);
      var ctx = getCanvasContext(canvas);
      if (!pixels || pixels.length === 0) {
        return null;
      }
      var heights = pixels[0];
      var imageData = ctx.createImageData(width, height);
      for (var i = 0, len = imageData.data.length; i < len; i += 4) {
        var _height2 = heights[i / 4];
        var [r, g, b] = encodeMapBox(_height2);
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = 255;
      }
      ctx.putImageData(imageData, 0, 0);
      return canvas.transferToImageBitmap();
    }
    var RGBTOTAL = 255 + 1 + 255 * 256 + 255 * 256 * 256;
    function transformQGisGray(imageData, minHeight, maxHeight) {
      var data = imageData.data;
      var ah = (maxHeight - minHeight) / RGBTOTAL;
      for (var i = 0, len = data.length; i < len; i += 4) {
        var r = data[i];
        var g = data[i + 1];
        var b = data[i + 2];
        var a = data[i + 3];
        if (a === 0) {
          continue;
        }
        var height = b * ah + g * 256 * ah + r * 256 * 256 * ah + minHeight;
        var [r1, g1, b1] = encodeMapBox(height);
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
      }
      return imageData;
    }

    var lerc = {exports: {}};

    (function (module) {
      /* Copyright 2015 Esri. Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License. You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0 @preserve */
      (function () {
        var LercDecode = function () {
          var CntZImage = {};
          CntZImage.defaultNoDataValue = -3.4027999387901484e+38;
          CntZImage.decode = function (input, options) {
            options = options || {};
            var skipMask = options.encodedMaskData || options.encodedMaskData === null;
            var parsedData = parse(input, options.inputOffset || 0, skipMask);
            var noDataValue = options.noDataValue !== null ? options.noDataValue : CntZImage.defaultNoDataValue;
            var uncompressedData = uncompressPixelValues(parsedData, options.pixelType || Float32Array, options.encodedMaskData, noDataValue, options.returnMask);
            var result = {
              width: parsedData.width,
              height: parsedData.height,
              pixelData: uncompressedData.resultPixels,
              minValue: uncompressedData.minValue,
              maxValue: parsedData.pixels.maxValue,
              noDataValue: noDataValue
            };
            if (uncompressedData.resultMask) {
              result.maskData = uncompressedData.resultMask;
            }
            if (options.returnEncodedMask && parsedData.mask) {
              result.encodedMaskData = parsedData.mask.bitset ? parsedData.mask.bitset : null;
            }
            if (options.returnFileInfo) {
              result.fileInfo = formatFileInfo(parsedData);
              if (options.computeUsedBitDepths) {
                result.fileInfo.bitDepths = computeUsedBitDepths(parsedData);
              }
            }
            return result;
          };
          var uncompressPixelValues = function uncompressPixelValues(data, TypedArrayClass, maskBitset, noDataValue, storeDecodedMask) {
            var blockIdx = 0;
            var numX = data.pixels.numBlocksX;
            var numY = data.pixels.numBlocksY;
            var blockWidth = Math.floor(data.width / numX);
            var blockHeight = Math.floor(data.height / numY);
            var scale = 2 * data.maxZError;
            var minValue = Number.MAX_VALUE,
              currentValue;
            maskBitset = maskBitset || (data.mask ? data.mask.bitset : null);
            var resultPixels, resultMask;
            resultPixels = new TypedArrayClass(data.width * data.height);
            if (storeDecodedMask && maskBitset) {
              resultMask = new Uint8Array(data.width * data.height);
            }
            var blockDataBuffer = new Float32Array(blockWidth * blockHeight);
            var xx, yy;
            for (var y = 0; y <= numY; y++) {
              var thisBlockHeight = y !== numY ? blockHeight : data.height % numY;
              if (thisBlockHeight === 0) {
                continue;
              }
              for (var x = 0; x <= numX; x++) {
                var thisBlockWidth = x !== numX ? blockWidth : data.width % numX;
                if (thisBlockWidth === 0) {
                  continue;
                }
                var outPtr = y * data.width * blockHeight + x * blockWidth;
                var outStride = data.width - thisBlockWidth;
                var block = data.pixels.blocks[blockIdx];
                var blockData, blockPtr, constValue;
                if (block.encoding < 2) {
                  if (block.encoding === 0) {
                    blockData = block.rawData;
                  } else {
                    unstuff(block.stuffedData, block.bitsPerPixel, block.numValidPixels, block.offset, scale, blockDataBuffer, data.pixels.maxValue);
                    blockData = blockDataBuffer;
                  }
                  blockPtr = 0;
                } else if (block.encoding === 2) {
                  constValue = 0;
                } else {
                  constValue = block.offset;
                }
                var maskByte;
                if (maskBitset) {
                  for (yy = 0; yy < thisBlockHeight; yy++) {
                    if (outPtr & 7) {
                      maskByte = maskBitset[outPtr >> 3];
                      maskByte <<= outPtr & 7;
                    }
                    for (xx = 0; xx < thisBlockWidth; xx++) {
                      if (!(outPtr & 7)) {
                        maskByte = maskBitset[outPtr >> 3];
                      }
                      if (maskByte & 128) {
                        if (resultMask) {
                          resultMask[outPtr] = 1;
                        }
                        currentValue = block.encoding < 2 ? blockData[blockPtr++] : constValue;
                        minValue = minValue > currentValue ? currentValue : minValue;
                        resultPixels[outPtr++] = currentValue;
                      } else {
                        if (resultMask) {
                          resultMask[outPtr] = 0;
                        }
                        resultPixels[outPtr++] = noDataValue;
                      }
                      maskByte <<= 1;
                    }
                    outPtr += outStride;
                  }
                } else {
                  if (block.encoding < 2) {
                    for (yy = 0; yy < thisBlockHeight; yy++) {
                      for (xx = 0; xx < thisBlockWidth; xx++) {
                        currentValue = blockData[blockPtr++];
                        minValue = minValue > currentValue ? currentValue : minValue;
                        resultPixels[outPtr++] = currentValue;
                      }
                      outPtr += outStride;
                    }
                  } else {
                    minValue = minValue > constValue ? constValue : minValue;
                    for (yy = 0; yy < thisBlockHeight; yy++) {
                      for (xx = 0; xx < thisBlockWidth; xx++) {
                        resultPixels[outPtr++] = constValue;
                      }
                      outPtr += outStride;
                    }
                  }
                }
                if (block.encoding === 1 && blockPtr !== block.numValidPixels) {
                  throw "Block and Mask do not match";
                }
                blockIdx++;
              }
            }
            return {
              resultPixels: resultPixels,
              resultMask: resultMask,
              minValue: minValue
            };
          };
          var formatFileInfo = function formatFileInfo(data) {
            return {
              "fileIdentifierString": data.fileIdentifierString,
              "fileVersion": data.fileVersion,
              "imageType": data.imageType,
              "height": data.height,
              "width": data.width,
              "maxZError": data.maxZError,
              "eofOffset": data.eofOffset,
              "mask": data.mask ? {
                "numBlocksX": data.mask.numBlocksX,
                "numBlocksY": data.mask.numBlocksY,
                "numBytes": data.mask.numBytes,
                "maxValue": data.mask.maxValue
              } : null,
              "pixels": {
                "numBlocksX": data.pixels.numBlocksX,
                "numBlocksY": data.pixels.numBlocksY,
                "numBytes": data.pixels.numBytes,
                "maxValue": data.pixels.maxValue,
                "noDataValue": data.noDataValue
              }
            };
          };
          var computeUsedBitDepths = function computeUsedBitDepths(data) {
            var numBlocks = data.pixels.numBlocksX * data.pixels.numBlocksY;
            var bitDepths = {};
            for (var i = 0; i < numBlocks; i++) {
              var block = data.pixels.blocks[i];
              if (block.encoding === 0) {
                bitDepths.float32 = true;
              } else if (block.encoding === 1) {
                bitDepths[block.bitsPerPixel] = true;
              } else {
                bitDepths[0] = true;
              }
            }
            return Object.keys(bitDepths);
          };
          var parse = function parse(input, fp, skipMask) {
            var data = {};
            var fileIdView = new Uint8Array(input, fp, 10);
            data.fileIdentifierString = String.fromCharCode.apply(null, fileIdView);
            if (data.fileIdentifierString.trim() !== "CntZImage") {
              throw "Unexpected file identifier string: " + data.fileIdentifierString;
            }
            fp += 10;
            var view = new DataView(input, fp, 24);
            data.fileVersion = view.getInt32(0, true);
            data.imageType = view.getInt32(4, true);
            data.height = view.getUint32(8, true);
            data.width = view.getUint32(12, true);
            data.maxZError = view.getFloat64(16, true);
            fp += 24;
            if (!skipMask) {
              view = new DataView(input, fp, 16);
              data.mask = {};
              data.mask.numBlocksY = view.getUint32(0, true);
              data.mask.numBlocksX = view.getUint32(4, true);
              data.mask.numBytes = view.getUint32(8, true);
              data.mask.maxValue = view.getFloat32(12, true);
              fp += 16;
              if (data.mask.numBytes > 0) {
                var bitset = new Uint8Array(Math.ceil(data.width * data.height / 8));
                view = new DataView(input, fp, data.mask.numBytes);
                var cnt = view.getInt16(0, true);
                var ip = 2,
                  op = 0;
                do {
                  if (cnt > 0) {
                    while (cnt--) {
                      bitset[op++] = view.getUint8(ip++);
                    }
                  } else {
                    var val = view.getUint8(ip++);
                    cnt = -cnt;
                    while (cnt--) {
                      bitset[op++] = val;
                    }
                  }
                  cnt = view.getInt16(ip, true);
                  ip += 2;
                } while (ip < data.mask.numBytes);
                if (cnt !== -32768 || op < bitset.length) {
                  throw "Unexpected end of mask RLE encoding";
                }
                data.mask.bitset = bitset;
                fp += data.mask.numBytes;
              } else if ((data.mask.numBytes | data.mask.numBlocksY | data.mask.maxValue) === 0) {
                data.mask.bitset = new Uint8Array(Math.ceil(data.width * data.height / 8));
              }
            }
            view = new DataView(input, fp, 16);
            data.pixels = {};
            data.pixels.numBlocksY = view.getUint32(0, true);
            data.pixels.numBlocksX = view.getUint32(4, true);
            data.pixels.numBytes = view.getUint32(8, true);
            data.pixels.maxValue = view.getFloat32(12, true);
            fp += 16;
            var numBlocksX = data.pixels.numBlocksX;
            var numBlocksY = data.pixels.numBlocksY;
            var actualNumBlocksX = numBlocksX + (data.width % numBlocksX > 0 ? 1 : 0);
            var actualNumBlocksY = numBlocksY + (data.height % numBlocksY > 0 ? 1 : 0);
            data.pixels.blocks = new Array(actualNumBlocksX * actualNumBlocksY);
            var blockI = 0;
            for (var blockY = 0; blockY < actualNumBlocksY; blockY++) {
              for (var blockX = 0; blockX < actualNumBlocksX; blockX++) {
                var size = 0;
                var bytesLeft = input.byteLength - fp;
                view = new DataView(input, fp, Math.min(10, bytesLeft));
                var block = {};
                data.pixels.blocks[blockI++] = block;
                var headerByte = view.getUint8(0);
                size++;
                block.encoding = headerByte & 63;
                if (block.encoding > 3) {
                  throw "Invalid block encoding (" + block.encoding + ")";
                }
                if (block.encoding === 2) {
                  fp++;
                  continue;
                }
                if (headerByte !== 0 && headerByte !== 2) {
                  headerByte >>= 6;
                  block.offsetType = headerByte;
                  if (headerByte === 2) {
                    block.offset = view.getInt8(1);
                    size++;
                  } else if (headerByte === 1) {
                    block.offset = view.getInt16(1, true);
                    size += 2;
                  } else if (headerByte === 0) {
                    block.offset = view.getFloat32(1, true);
                    size += 4;
                  } else {
                    throw "Invalid block offset type";
                  }
                  if (block.encoding === 1) {
                    headerByte = view.getUint8(size);
                    size++;
                    block.bitsPerPixel = headerByte & 63;
                    headerByte >>= 6;
                    block.numValidPixelsType = headerByte;
                    if (headerByte === 2) {
                      block.numValidPixels = view.getUint8(size);
                      size++;
                    } else if (headerByte === 1) {
                      block.numValidPixels = view.getUint16(size, true);
                      size += 2;
                    } else if (headerByte === 0) {
                      block.numValidPixels = view.getUint32(size, true);
                      size += 4;
                    } else {
                      throw "Invalid valid pixel count type";
                    }
                  }
                }
                fp += size;
                if (block.encoding === 3) {
                  continue;
                }
                var arrayBuf, store8;
                if (block.encoding === 0) {
                  var numPixels = (data.pixels.numBytes - 1) / 4;
                  if (numPixels !== Math.floor(numPixels)) {
                    throw "uncompressed block has invalid length";
                  }
                  arrayBuf = new ArrayBuffer(numPixels * 4);
                  store8 = new Uint8Array(arrayBuf);
                  store8.set(new Uint8Array(input, fp, numPixels * 4));
                  var rawData = new Float32Array(arrayBuf);
                  block.rawData = rawData;
                  fp += numPixels * 4;
                } else if (block.encoding === 1) {
                  var dataBytes = Math.ceil(block.numValidPixels * block.bitsPerPixel / 8);
                  var dataWords = Math.ceil(dataBytes / 4);
                  arrayBuf = new ArrayBuffer(dataWords * 4);
                  store8 = new Uint8Array(arrayBuf);
                  store8.set(new Uint8Array(input, fp, dataBytes));
                  block.stuffedData = new Uint32Array(arrayBuf);
                  fp += dataBytes;
                }
              }
            }
            data.eofOffset = fp;
            return data;
          };
          var unstuff = function unstuff(src, bitsPerPixel, numPixels, offset, scale, dest, maxValue) {
            var bitMask = (1 << bitsPerPixel) - 1;
            var i = 0,
              o;
            var bitsLeft = 0;
            var n, buffer;
            var nmax = Math.ceil((maxValue - offset) / scale);
            var numInvalidTailBytes = src.length * 4 - Math.ceil(bitsPerPixel * numPixels / 8);
            src[src.length - 1] <<= 8 * numInvalidTailBytes;
            for (o = 0; o < numPixels; o++) {
              if (bitsLeft === 0) {
                buffer = src[i++];
                bitsLeft = 32;
              }
              if (bitsLeft >= bitsPerPixel) {
                n = buffer >>> bitsLeft - bitsPerPixel & bitMask;
                bitsLeft -= bitsPerPixel;
              } else {
                var missingBits = bitsPerPixel - bitsLeft;
                n = (buffer & bitMask) << missingBits & bitMask;
                buffer = src[i++];
                bitsLeft = 32 - missingBits;
                n += buffer >>> bitsLeft;
              }
              dest[o] = n < nmax ? offset + n * scale : maxValue;
            }
            return dest;
          };
          return CntZImage;
        }();
        var Lerc2Decode = function () {
          var BitStuffer = {
            unstuff: function unstuff(src, dest, bitsPerPixel, numPixels, lutArr, offset, scale, maxValue) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o;
              var bitsLeft = 0;
              var n, buffer, missingBits, nmax;
              var numInvalidTailBytes = src.length * 4 - Math.ceil(bitsPerPixel * numPixels / 8);
              src[src.length - 1] <<= 8 * numInvalidTailBytes;
              if (lutArr) {
                for (o = 0; o < numPixels; o++) {
                  if (bitsLeft === 0) {
                    buffer = src[i++];
                    bitsLeft = 32;
                  }
                  if (bitsLeft >= bitsPerPixel) {
                    n = buffer >>> bitsLeft - bitsPerPixel & bitMask;
                    bitsLeft -= bitsPerPixel;
                  } else {
                    missingBits = bitsPerPixel - bitsLeft;
                    n = (buffer & bitMask) << missingBits & bitMask;
                    buffer = src[i++];
                    bitsLeft = 32 - missingBits;
                    n += buffer >>> bitsLeft;
                  }
                  dest[o] = lutArr[n];
                }
              } else {
                nmax = Math.ceil((maxValue - offset) / scale);
                for (o = 0; o < numPixels; o++) {
                  if (bitsLeft === 0) {
                    buffer = src[i++];
                    bitsLeft = 32;
                  }
                  if (bitsLeft >= bitsPerPixel) {
                    n = buffer >>> bitsLeft - bitsPerPixel & bitMask;
                    bitsLeft -= bitsPerPixel;
                  } else {
                    missingBits = bitsPerPixel - bitsLeft;
                    n = (buffer & bitMask) << missingBits & bitMask;
                    buffer = src[i++];
                    bitsLeft = 32 - missingBits;
                    n += buffer >>> bitsLeft;
                  }
                  dest[o] = n < nmax ? offset + n * scale : maxValue;
                }
              }
            },
            unstuffLUT: function unstuffLUT(src, bitsPerPixel, numPixels, offset, scale, maxValue) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o = 0,
                missingBits = 0,
                bitsLeft = 0,
                n = 0;
              var buffer;
              var dest = [];
              var numInvalidTailBytes = src.length * 4 - Math.ceil(bitsPerPixel * numPixels / 8);
              src[src.length - 1] <<= 8 * numInvalidTailBytes;
              var nmax = Math.ceil((maxValue - offset) / scale);
              for (o = 0; o < numPixels; o++) {
                if (bitsLeft === 0) {
                  buffer = src[i++];
                  bitsLeft = 32;
                }
                if (bitsLeft >= bitsPerPixel) {
                  n = buffer >>> bitsLeft - bitsPerPixel & bitMask;
                  bitsLeft -= bitsPerPixel;
                } else {
                  missingBits = bitsPerPixel - bitsLeft;
                  n = (buffer & bitMask) << missingBits & bitMask;
                  buffer = src[i++];
                  bitsLeft = 32 - missingBits;
                  n += buffer >>> bitsLeft;
                }
                dest[o] = n < nmax ? offset + n * scale : maxValue;
              }
              dest.unshift(offset);
              return dest;
            },
            unstuff2: function unstuff2(src, dest, bitsPerPixel, numPixels, lutArr, offset, scale, maxValue) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o;
              var bitsLeft = 0,
                bitPos = 0;
              var n, buffer, missingBits;
              if (lutArr) {
                for (o = 0; o < numPixels; o++) {
                  if (bitsLeft === 0) {
                    buffer = src[i++];
                    bitsLeft = 32;
                    bitPos = 0;
                  }
                  if (bitsLeft >= bitsPerPixel) {
                    n = buffer >>> bitPos & bitMask;
                    bitsLeft -= bitsPerPixel;
                    bitPos += bitsPerPixel;
                  } else {
                    missingBits = bitsPerPixel - bitsLeft;
                    n = buffer >>> bitPos & bitMask;
                    buffer = src[i++];
                    bitsLeft = 32 - missingBits;
                    n |= (buffer & (1 << missingBits) - 1) << bitsPerPixel - missingBits;
                    bitPos = missingBits;
                  }
                  dest[o] = lutArr[n];
                }
              } else {
                var nmax = Math.ceil((maxValue - offset) / scale);
                for (o = 0; o < numPixels; o++) {
                  if (bitsLeft === 0) {
                    buffer = src[i++];
                    bitsLeft = 32;
                    bitPos = 0;
                  }
                  if (bitsLeft >= bitsPerPixel) {
                    n = buffer >>> bitPos & bitMask;
                    bitsLeft -= bitsPerPixel;
                    bitPos += bitsPerPixel;
                  } else {
                    missingBits = bitsPerPixel - bitsLeft;
                    n = buffer >>> bitPos & bitMask;
                    buffer = src[i++];
                    bitsLeft = 32 - missingBits;
                    n |= (buffer & (1 << missingBits) - 1) << bitsPerPixel - missingBits;
                    bitPos = missingBits;
                  }
                  dest[o] = n < nmax ? offset + n * scale : maxValue;
                }
              }
              return dest;
            },
            unstuffLUT2: function unstuffLUT2(src, bitsPerPixel, numPixels, offset, scale, maxValue) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o = 0,
                missingBits = 0,
                bitsLeft = 0,
                n = 0,
                bitPos = 0;
              var buffer;
              var dest = [];
              var nmax = Math.ceil((maxValue - offset) / scale);
              for (o = 0; o < numPixels; o++) {
                if (bitsLeft === 0) {
                  buffer = src[i++];
                  bitsLeft = 32;
                  bitPos = 0;
                }
                if (bitsLeft >= bitsPerPixel) {
                  n = buffer >>> bitPos & bitMask;
                  bitsLeft -= bitsPerPixel;
                  bitPos += bitsPerPixel;
                } else {
                  missingBits = bitsPerPixel - bitsLeft;
                  n = buffer >>> bitPos & bitMask;
                  buffer = src[i++];
                  bitsLeft = 32 - missingBits;
                  n |= (buffer & (1 << missingBits) - 1) << bitsPerPixel - missingBits;
                  bitPos = missingBits;
                }
                dest[o] = n < nmax ? offset + n * scale : maxValue;
              }
              dest.unshift(offset);
              return dest;
            },
            originalUnstuff: function originalUnstuff(src, dest, bitsPerPixel, numPixels) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o;
              var bitsLeft = 0;
              var n, buffer, missingBits;
              var numInvalidTailBytes = src.length * 4 - Math.ceil(bitsPerPixel * numPixels / 8);
              src[src.length - 1] <<= 8 * numInvalidTailBytes;
              for (o = 0; o < numPixels; o++) {
                if (bitsLeft === 0) {
                  buffer = src[i++];
                  bitsLeft = 32;
                }
                if (bitsLeft >= bitsPerPixel) {
                  n = buffer >>> bitsLeft - bitsPerPixel & bitMask;
                  bitsLeft -= bitsPerPixel;
                } else {
                  missingBits = bitsPerPixel - bitsLeft;
                  n = (buffer & bitMask) << missingBits & bitMask;
                  buffer = src[i++];
                  bitsLeft = 32 - missingBits;
                  n += buffer >>> bitsLeft;
                }
                dest[o] = n;
              }
              return dest;
            },
            originalUnstuff2: function originalUnstuff2(src, dest, bitsPerPixel, numPixels) {
              var bitMask = (1 << bitsPerPixel) - 1;
              var i = 0,
                o;
              var bitsLeft = 0,
                bitPos = 0;
              var n, buffer, missingBits;
              for (o = 0; o < numPixels; o++) {
                if (bitsLeft === 0) {
                  buffer = src[i++];
                  bitsLeft = 32;
                  bitPos = 0;
                }
                if (bitsLeft >= bitsPerPixel) {
                  n = buffer >>> bitPos & bitMask;
                  bitsLeft -= bitsPerPixel;
                  bitPos += bitsPerPixel;
                } else {
                  missingBits = bitsPerPixel - bitsLeft;
                  n = buffer >>> bitPos & bitMask;
                  buffer = src[i++];
                  bitsLeft = 32 - missingBits;
                  n |= (buffer & (1 << missingBits) - 1) << bitsPerPixel - missingBits;
                  bitPos = missingBits;
                }
                dest[o] = n;
              }
              return dest;
            }
          };
          var Lerc2Helpers = {
            HUFFMAN_LUT_BITS_MAX: 12,
            computeChecksumFletcher32: function computeChecksumFletcher32(input) {
              var sum1 = 0xffff,
                sum2 = 0xffff;
              var len = input.length;
              var words = Math.floor(len / 2);
              var i = 0;
              while (words) {
                var tlen = words >= 359 ? 359 : words;
                words -= tlen;
                do {
                  sum1 += input[i++] << 8;
                  sum2 += sum1 += input[i++];
                } while (--tlen);
                sum1 = (sum1 & 0xffff) + (sum1 >>> 16);
                sum2 = (sum2 & 0xffff) + (sum2 >>> 16);
              }
              if (len & 1) {
                sum2 += sum1 += input[i] << 8;
              }
              sum1 = (sum1 & 0xffff) + (sum1 >>> 16);
              sum2 = (sum2 & 0xffff) + (sum2 >>> 16);
              return (sum2 << 16 | sum1) >>> 0;
            },
            readHeaderInfo: function readHeaderInfo(input, data) {
              var ptr = data.ptr;
              var fileIdView = new Uint8Array(input, ptr, 6);
              var headerInfo = {};
              headerInfo.fileIdentifierString = String.fromCharCode.apply(null, fileIdView);
              if (headerInfo.fileIdentifierString.lastIndexOf("Lerc2", 0) !== 0) {
                throw "Unexpected file identifier string (expect Lerc2 ): " + headerInfo.fileIdentifierString;
              }
              ptr += 6;
              var view = new DataView(input, ptr, 52);
              headerInfo.fileVersion = view.getInt32(0, true);
              ptr += 4;
              if (headerInfo.fileVersion >= 3) {
                headerInfo.checksum = view.getUint32(4, true);
                ptr += 4;
              }
              view = new DataView(input, ptr, 48);
              headerInfo.height = view.getUint32(0, true);
              headerInfo.width = view.getUint32(4, true);
              headerInfo.numValidPixel = view.getUint32(8, true);
              headerInfo.microBlockSize = view.getInt32(12, true);
              headerInfo.blobSize = view.getInt32(16, true);
              headerInfo.imageType = view.getInt32(20, true);
              headerInfo.maxZError = view.getFloat64(24, true);
              headerInfo.zMin = view.getFloat64(32, true);
              headerInfo.zMax = view.getFloat64(40, true);
              ptr += 48;
              data.headerInfo = headerInfo;
              data.ptr = ptr;
              var checksum;
              if (headerInfo.fileVersion >= 3) {
                checksum = this.computeChecksumFletcher32(new Uint8Array(input, ptr - 48, headerInfo.blobSize - 14));
                if (checksum !== headerInfo.checksum) {
                  throw "Checksum failed.";
                }
              }
              return true;
            },
            readMask: function readMask(input, data) {
              var ptr = data.ptr;
              var headerInfo = data.headerInfo;
              var numPixels = headerInfo.width * headerInfo.height;
              var numValidPixel = headerInfo.numValidPixel;
              var view = new DataView(input, ptr, 4);
              var mask = {};
              mask.numBytes = view.getUint32(0, true);
              ptr += 4;
              if ((0 === numValidPixel || numPixels === numValidPixel) && 0 !== mask.numBytes) {
                throw "invalid mask";
              }
              var bitset, resultMask;
              if (numValidPixel === 0) {
                bitset = new Uint8Array(Math.ceil(numPixels / 8));
                mask.bitset = bitset;
                resultMask = new Uint8Array(numPixels);
                data.pixels.resultMask = resultMask;
                ptr += mask.numBytes;
              } else if (mask.numBytes > 0) {
                bitset = new Uint8Array(Math.ceil(numPixels / 8));
                view = new DataView(input, ptr, mask.numBytes);
                var cnt = view.getInt16(0, true);
                var ip = 2,
                  op = 0,
                  val = 0;
                do {
                  if (cnt > 0) {
                    while (cnt--) {
                      bitset[op++] = view.getUint8(ip++);
                    }
                  } else {
                    val = view.getUint8(ip++);
                    cnt = -cnt;
                    while (cnt--) {
                      bitset[op++] = val;
                    }
                  }
                  cnt = view.getInt16(ip, true);
                  ip += 2;
                } while (ip < mask.numBytes);
                if (cnt !== -32768 || op < bitset.length) {
                  throw "Unexpected end of mask RLE encoding";
                }
                resultMask = new Uint8Array(numPixels);
                var mb = 0,
                  k = 0;
                for (k = 0; k < numPixels; k++) {
                  if (k & 7) {
                    mb = bitset[k >> 3];
                    mb <<= k & 7;
                  } else {
                    mb = bitset[k >> 3];
                  }
                  if (mb & 128) {
                    resultMask[k] = 1;
                  }
                }
                data.pixels.resultMask = resultMask;
                mask.bitset = bitset;
                ptr += mask.numBytes;
              }
              data.ptr = ptr;
              data.mask = mask;
              return true;
            },
            readDataOneSweep: function readDataOneSweep(input, data, OutPixelTypeArray) {
              var ptr = data.ptr;
              var headerInfo = data.headerInfo;
              var numPixels = headerInfo.width * headerInfo.height;
              var imageType = headerInfo.imageType;
              var numBytes = headerInfo.numValidPixel * Lerc2Helpers.getDateTypeSize(imageType);
              var rawData;
              if (OutPixelTypeArray === Uint8Array) {
                rawData = new Uint8Array(input, ptr, numBytes);
              } else {
                var arrayBuf = new ArrayBuffer(numBytes);
                var store8 = new Uint8Array(arrayBuf);
                store8.set(new Uint8Array(input, ptr, numBytes));
                rawData = new OutPixelTypeArray(arrayBuf);
              }
              if (rawData.length === numPixels) {
                data.pixels.resultPixels = rawData;
              } else {
                  data.pixels.resultPixels = new OutPixelTypeArray(numPixels);
                  var z = 0,
                    k = 0;
                  for (k = 0; k < numPixels; k++) {
                    if (data.pixels.resultMask[k]) {
                      data.pixels.resultPixels[k] = rawData[z++];
                    }
                  }
                }
              ptr += numBytes;
              data.ptr = ptr;
              return true;
            },
            readHuffman: function readHuffman(input, data, OutPixelTypeArray) {
              var headerInfo = data.headerInfo;
              var numPixels = headerInfo.width * headerInfo.height;
              var BITS_MAX = this.HUFFMAN_LUT_BITS_MAX;
              var view = new DataView(input, data.ptr, 16);
              data.ptr += 16;
              var version = view.getInt32(0, true);
              if (version < 2) {
                throw "unsupported Huffman version";
              }
              var size = view.getInt32(4, true);
              var i0 = view.getInt32(8, true);
              var i1 = view.getInt32(12, true);
              if (i0 >= i1) {
                return false;
              }
              var blockDataBuffer = new Uint32Array(i1 - i0);
              Lerc2Helpers.decodeBits(input, data, blockDataBuffer);
              var codeTable = [];
              var i, j, k, len;
              for (i = i0; i < i1; i++) {
                j = i - (i < size ? 0 : size);
                codeTable[j] = {
                  first: blockDataBuffer[i - i0],
                  second: null
                };
              }
              var dataBytes = input.byteLength - data.ptr;
              var dataWords = Math.ceil(dataBytes / 4);
              var arrayBuf = new ArrayBuffer(dataWords * 4);
              var store8 = new Uint8Array(arrayBuf);
              store8.set(new Uint8Array(input, data.ptr, dataBytes));
              var stuffedData = new Uint32Array(arrayBuf);
              var bitPos = 0,
                word,
                srcPtr = 0;
              word = stuffedData[0];
              for (i = i0; i < i1; i++) {
                j = i - (i < size ? 0 : size);
                len = codeTable[j].first;
                if (len > 0) {
                  codeTable[j].second = word << bitPos >>> 32 - len;
                  if (32 - bitPos >= len) {
                    bitPos += len;
                    if (bitPos === 32) {
                      bitPos = 0;
                      srcPtr++;
                      word = stuffedData[srcPtr];
                    }
                  } else {
                    bitPos += len - 32;
                    srcPtr++;
                    word = stuffedData[srcPtr];
                    codeTable[j].second |= word >>> 32 - bitPos;
                  }
                }
              }
              var offset = data.headerInfo.imageType === 0 ? 128 : 0;
              var height = data.headerInfo.height;
              var width = data.headerInfo.width;
              var numBitsLUT = 0,
                numBitsLUTQick = 0;
              var tree = new TreeNode();
              for (i = 0; i < codeTable.length; i++) {
                if (codeTable[i] !== undefined) {
                  numBitsLUT = Math.max(numBitsLUT, codeTable[i].first);
                }
              }
              if (numBitsLUT >= BITS_MAX) {
                numBitsLUTQick = BITS_MAX;
              } else {
                numBitsLUTQick = numBitsLUT;
              }
              if (numBitsLUT >= 30) {
                console.log("WARning, large NUM LUT BITS IS " + numBitsLUT);
              }
              var decodeLut = [],
                entry,
                code,
                numEntries,
                jj,
                currentBit,
                node;
              for (i = i0; i < i1; i++) {
                j = i - (i < size ? 0 : size);
                len = codeTable[j].first;
                if (len > 0) {
                  entry = [len, j];
                  if (len <= numBitsLUTQick) {
                    code = codeTable[j].second << numBitsLUTQick - len;
                    numEntries = 1 << numBitsLUTQick - len;
                    for (k = 0; k < numEntries; k++) {
                      decodeLut[code | k] = entry;
                    }
                  } else {
                    code = codeTable[j].second;
                    node = tree;
                    for (jj = len - 1; jj >= 0; jj--) {
                      currentBit = code >>> jj & 1;
                      if (currentBit) {
                        if (!node.right) {
                          node.right = new TreeNode();
                        }
                        node = node.right;
                      } else {
                        if (!node.left) {
                          node.left = new TreeNode();
                        }
                        node = node.left;
                      }
                      if (jj === 0 && !node.val) {
                        node.val = entry[1];
                      }
                    }
                  }
                }
              }
              var val,
                delta,
                mask = data.pixels.resultMask,
                valTmp,
                valTmpQuick,
                prevVal = 0,
                ii = 0;
              if (bitPos > 0) {
                srcPtr++;
                bitPos = 0;
              }
              word = stuffedData[srcPtr];
              var resultPixels = new OutPixelTypeArray(numPixels);
              if (data.headerInfo.numValidPixel === width * height) {
                for (k = 0, i = 0; i < height; i++) {
                  for (j = 0; j < width; j++, k++) {
                    val = 0;
                    valTmp = word << bitPos >>> 32 - numBitsLUTQick;
                    valTmpQuick = valTmp;
                    if (32 - bitPos < numBitsLUTQick) {
                      valTmp |= stuffedData[srcPtr + 1] >>> 64 - bitPos - numBitsLUTQick;
                      valTmpQuick = valTmp;
                    }
                    if (decodeLut[valTmpQuick]) {
                        val = decodeLut[valTmpQuick][1];
                        bitPos += decodeLut[valTmpQuick][0];
                      } else {
                      valTmp = word << bitPos >>> 32 - numBitsLUT;
                      valTmpQuick = valTmp;
                      if (32 - bitPos < numBitsLUT) {
                        valTmp |= stuffedData[srcPtr + 1] >>> 64 - bitPos - numBitsLUT;
                        valTmpQuick = valTmp;
                      }
                      node = tree;
                      for (ii = 0; ii < numBitsLUT; ii++) {
                        currentBit = valTmp >>> numBitsLUT - ii - 1 & 1;
                        node = currentBit ? node.right : node.left;
                        if (!(node.left || node.right)) {
                          val = node.val;
                          bitPos = bitPos + ii + 1;
                          break;
                        }
                      }
                    }
                    if (bitPos >= 32) {
                      bitPos -= 32;
                      srcPtr++;
                      word = stuffedData[srcPtr];
                    }
                    delta = val - offset;
                    if (j > 0) {
                      delta += prevVal;
                    } else if (i > 0) {
                      delta += resultPixels[k - width];
                    } else {
                      delta += prevVal;
                    }
                    delta &= 0xFF;
                    resultPixels[k] = delta;
                    prevVal = delta;
                  }
                }
              } else {
                for (k = 0, i = 0; i < height; i++) {
                  for (j = 0; j < width; j++, k++) {
                    if (mask[k]) {
                      val = 0;
                      valTmp = word << bitPos >>> 32 - numBitsLUTQick;
                      valTmpQuick = valTmp;
                      if (32 - bitPos < numBitsLUTQick) {
                        valTmp |= stuffedData[srcPtr + 1] >>> 64 - bitPos - numBitsLUTQick;
                        valTmpQuick = valTmp;
                      }
                      if (decodeLut[valTmpQuick]) {
                          val = decodeLut[valTmpQuick][1];
                          bitPos += decodeLut[valTmpQuick][0];
                        } else {
                        valTmp = word << bitPos >>> 32 - numBitsLUT;
                        valTmpQuick = valTmp;
                        if (32 - bitPos < numBitsLUT) {
                          valTmp |= stuffedData[srcPtr + 1] >>> 64 - bitPos - numBitsLUT;
                          valTmpQuick = valTmp;
                        }
                        node = tree;
                        for (ii = 0; ii < numBitsLUT; ii++) {
                          currentBit = valTmp >>> numBitsLUT - ii - 1 & 1;
                          node = currentBit ? node.right : node.left;
                          if (!(node.left || node.right)) {
                            val = node.val;
                            bitPos = bitPos + ii + 1;
                            break;
                          }
                        }
                      }
                      if (bitPos >= 32) {
                        bitPos -= 32;
                        srcPtr++;
                        word = stuffedData[srcPtr];
                      }
                      delta = val - offset;
                      if (j > 0 && mask[k - 1]) {
                        delta += prevVal;
                      } else if (i > 0 && mask[k - width]) {
                        delta += resultPixels[k - width];
                      } else {
                        delta += prevVal;
                      }
                      delta &= 0xFF;
                      resultPixels[k] = delta;
                      prevVal = delta;
                    }
                  }
                }
              }
              data.pixels.resultPixels = resultPixels;
              data.ptr = data.ptr + (srcPtr + 1) * 4 + (bitPos > 0 ? 4 : 0);
            },
            decodeBits: function decodeBits(input, data, blockDataBuffer, offset) {
              {
                var fileVersion = data.headerInfo.fileVersion;
                var blockPtr = 0;
                var view = new DataView(input, data.ptr, 5);
                var headerByte = view.getUint8(0);
                blockPtr++;
                var bits67 = headerByte >> 6;
                var n = bits67 === 0 ? 4 : 3 - bits67;
                var doLut = (headerByte & 32) > 0 ? true : false;
                var numBits = headerByte & 31;
                var numElements = 0;
                if (n === 1) {
                  numElements = view.getUint8(blockPtr);
                  blockPtr++;
                } else if (n === 2) {
                  numElements = view.getUint16(blockPtr, true);
                  blockPtr += 2;
                } else if (n === 4) {
                  numElements = view.getUint32(blockPtr, true);
                  blockPtr += 4;
                } else {
                  throw "Invalid valid pixel count type";
                }
                var scale = 2 * data.headerInfo.maxZError;
                var stuffedData, arrayBuf, store8, dataBytes, dataWords;
                var lutArr, lutData, lutBytes, bitsPerPixel;
                if (doLut) {
                  data.counter.lut++;
                  lutBytes = view.getUint8(blockPtr);
                  blockPtr++;
                  dataBytes = Math.ceil((lutBytes - 1) * numBits / 8);
                  dataWords = Math.ceil(dataBytes / 4);
                  arrayBuf = new ArrayBuffer(dataWords * 4);
                  store8 = new Uint8Array(arrayBuf);
                  data.ptr += blockPtr;
                  store8.set(new Uint8Array(input, data.ptr, dataBytes));
                  lutData = new Uint32Array(arrayBuf);
                  data.ptr += dataBytes;
                  bitsPerPixel = 0;
                  while (lutBytes - 1 >>> bitsPerPixel) {
                    bitsPerPixel++;
                  }
                  dataBytes = Math.ceil(numElements * bitsPerPixel / 8);
                  dataWords = Math.ceil(dataBytes / 4);
                  arrayBuf = new ArrayBuffer(dataWords * 4);
                  store8 = new Uint8Array(arrayBuf);
                  store8.set(new Uint8Array(input, data.ptr, dataBytes));
                  stuffedData = new Uint32Array(arrayBuf);
                  data.ptr += dataBytes;
                  if (fileVersion >= 3) {
                    lutArr = BitStuffer.unstuffLUT2(lutData, numBits, lutBytes - 1, offset, scale, data.headerInfo.zMax);
                  } else {
                    lutArr = BitStuffer.unstuffLUT(lutData, numBits, lutBytes - 1, offset, scale, data.headerInfo.zMax);
                  }
                  if (fileVersion >= 3) {
                    BitStuffer.unstuff2(stuffedData, blockDataBuffer, bitsPerPixel, numElements, lutArr);
                  } else {
                    BitStuffer.unstuff(stuffedData, blockDataBuffer, bitsPerPixel, numElements, lutArr);
                  }
                } else {
                  data.counter.bitstuffer++;
                  bitsPerPixel = numBits;
                  data.ptr += blockPtr;
                  if (bitsPerPixel > 0) {
                    dataBytes = Math.ceil(numElements * bitsPerPixel / 8);
                    dataWords = Math.ceil(dataBytes / 4);
                    arrayBuf = new ArrayBuffer(dataWords * 4);
                    store8 = new Uint8Array(arrayBuf);
                    store8.set(new Uint8Array(input, data.ptr, dataBytes));
                    stuffedData = new Uint32Array(arrayBuf);
                    data.ptr += dataBytes;
                    if (fileVersion >= 3) {
                      if (offset === undefined || offset === null) {
                        BitStuffer.originalUnstuff2(stuffedData, blockDataBuffer, bitsPerPixel, numElements);
                      } else {
                        BitStuffer.unstuff2(stuffedData, blockDataBuffer, bitsPerPixel, numElements, false, offset, scale, data.headerInfo.zMax);
                      }
                    } else {
                      if (offset === undefined || offset === null) {
                        BitStuffer.originalUnstuff(stuffedData, blockDataBuffer, bitsPerPixel, numElements);
                      } else {
                        BitStuffer.unstuff(stuffedData, blockDataBuffer, bitsPerPixel, numElements, false, offset, scale, data.headerInfo.zMax);
                      }
                    }
                  }
                }
              }
            },
            readTiles: function readTiles(input, data, OutPixelTypeArray) {
              var headerInfo = data.headerInfo;
              var width = headerInfo.width;
              var height = headerInfo.height;
              var microBlockSize = headerInfo.microBlockSize;
              var imageType = headerInfo.imageType;
              var numBlocksX = Math.ceil(width / microBlockSize);
              var numBlocksY = Math.ceil(height / microBlockSize);
              data.pixels.numBlocksY = numBlocksY;
              data.pixels.numBlocksX = numBlocksX;
              data.pixels.ptr = 0;
              var row = 0,
                col = 0,
                blockY = 0,
                blockX = 0,
                thisBlockHeight = 0,
                thisBlockWidth = 0,
                bytesLeft = 0,
                headerByte = 0,
                bits67 = 0,
                testCode = 0,
                outPtr = 0,
                outStride = 0,
                numBytes = 0,
                bytesleft = 0,
                z = 0,
                blockPtr = 0;
              var view, block, arrayBuf, store8, rawData;
              var blockEncoding;
              var blockDataBuffer = new OutPixelTypeArray(microBlockSize * microBlockSize);
              var lastBlockHeight = height % microBlockSize || microBlockSize;
              var lastBlockWidth = width % microBlockSize || microBlockSize;
              var offsetType, offset;
              for (blockY = 0; blockY < numBlocksY; blockY++) {
                thisBlockHeight = blockY !== numBlocksY - 1 ? microBlockSize : lastBlockHeight;
                for (blockX = 0; blockX < numBlocksX; blockX++) {
                  thisBlockWidth = blockX !== numBlocksX - 1 ? microBlockSize : lastBlockWidth;
                  outPtr = blockY * width * microBlockSize + blockX * microBlockSize;
                  outStride = width - thisBlockWidth;
                  bytesLeft = input.byteLength - data.ptr;
                  view = new DataView(input, data.ptr, Math.min(10, bytesLeft));
                  block = {};
                  blockPtr = 0;
                  headerByte = view.getUint8(0);
                  blockPtr++;
                  bits67 = headerByte >> 6 & 0xFF;
                  testCode = headerByte >> 2 & 15;
                  if (testCode !== (blockX * microBlockSize >> 3 & 15)) {
                    throw "integrity issue";
                  }
                  blockEncoding = headerByte & 3;
                  if (blockEncoding > 3) {
                    data.ptr += blockPtr;
                    throw "Invalid block encoding (" + blockEncoding + ")";
                  } else if (blockEncoding === 2) {
                    data.counter.constant++;
                    data.ptr += blockPtr;
                    continue;
                  } else if (blockEncoding === 0) {
                    data.counter.uncompressed++;
                    data.ptr += blockPtr;
                    numBytes = thisBlockHeight * thisBlockWidth * Lerc2Helpers.getDateTypeSize(imageType);
                    bytesleft = input.byteLength - data.ptr;
                    numBytes = numBytes < bytesleft ? numBytes : bytesleft;
                    arrayBuf = new ArrayBuffer(numBytes);
                    store8 = new Uint8Array(arrayBuf);
                    store8.set(new Uint8Array(input, data.ptr, numBytes));
                    rawData = new OutPixelTypeArray(arrayBuf);
                    z = 0;
                    if (data.pixels.resultMask) {
                      for (row = 0; row < thisBlockHeight; row++) {
                        for (col = 0; col < thisBlockWidth; col++) {
                          if (data.pixels.resultMask[outPtr]) {
                            data.pixels.resultPixels[outPtr] = rawData[z++];
                          }
                          outPtr++;
                        }
                        outPtr += outStride;
                      }
                    } else {
                      for (row = 0; row < thisBlockHeight; row++) {
                        for (col = 0; col < thisBlockWidth; col++) {
                          data.pixels.resultPixels[outPtr++] = rawData[z++];
                        }
                        outPtr += outStride;
                      }
                    }
                    data.ptr += z * Lerc2Helpers.getDateTypeSize(imageType);
                  } else {
                    offsetType = Lerc2Helpers.getDataTypeUsed(imageType, bits67);
                    offset = Lerc2Helpers.getOnePixel(block, blockPtr, offsetType, view);
                    blockPtr += Lerc2Helpers.getDateTypeSize(offsetType);
                    if (blockEncoding === 3) {
                        data.ptr += blockPtr;
                        data.counter.constantoffset++;
                        if (data.pixels.resultMask) {
                          for (row = 0; row < thisBlockHeight; row++) {
                            for (col = 0; col < thisBlockWidth; col++) {
                              if (data.pixels.resultMask[outPtr]) {
                                data.pixels.resultPixels[outPtr] = offset;
                              }
                              outPtr++;
                            }
                            outPtr += outStride;
                          }
                        } else {
                          for (row = 0; row < thisBlockHeight; row++) {
                            for (col = 0; col < thisBlockWidth; col++) {
                              data.pixels.resultPixels[outPtr++] = offset;
                            }
                            outPtr += outStride;
                          }
                        }
                      } else {
                      data.ptr += blockPtr;
                      Lerc2Helpers.decodeBits(input, data, blockDataBuffer, offset);
                      blockPtr = 0;
                      if (data.pixels.resultMask) {
                        for (row = 0; row < thisBlockHeight; row++) {
                          for (col = 0; col < thisBlockWidth; col++) {
                            if (data.pixels.resultMask[outPtr]) {
                              data.pixels.resultPixels[outPtr] = blockDataBuffer[blockPtr++];
                            }
                            outPtr++;
                          }
                          outPtr += outStride;
                        }
                      } else {
                        for (row = 0; row < thisBlockHeight; row++) {
                          for (col = 0; col < thisBlockWidth; col++) {
                            data.pixels.resultPixels[outPtr++] = blockDataBuffer[blockPtr++];
                          }
                          outPtr += outStride;
                        }
                      }
                    }
                  }
                }
              }
            },
            formatFileInfo: function formatFileInfo(data) {
              return {
                "fileIdentifierString": data.headerInfo.fileIdentifierString,
                "fileVersion": data.headerInfo.fileVersion,
                "imageType": data.headerInfo.imageType,
                "height": data.headerInfo.height,
                "width": data.headerInfo.width,
                "numValidPixel": data.headerInfo.numValidPixel,
                "microBlockSize": data.headerInfo.microBlockSize,
                "blobSize": data.headerInfo.blobSize,
                "maxZError": data.headerInfo.maxZError,
                "pixelType": Lerc2Helpers.getPixelType(data.headerInfo.imageType),
                "eofOffset": data.eofOffset,
                "mask": data.mask ? {
                  "numBytes": data.mask.numBytes
                } : null,
                "pixels": {
                  "numBlocksX": data.pixels.numBlocksX,
                  "numBlocksY": data.pixels.numBlocksY,
                  "maxValue": data.headerInfo.zMax,
                  "minValue": data.headerInfo.zMin,
                  "noDataValue": data.noDataValue
                }
              };
            },
            constructConstantSurface: function constructConstantSurface(data) {
              var val = data.headerInfo.zMax;
              var numPixels = data.headerInfo.height * data.headerInfo.width;
              var k = 0;
              if (data.pixels.resultMask) {
                for (k = 0; k < numPixels; k++) {
                  if (data.pixels.resultMask[k]) {
                    data.pixels.resultPixels[k] = val;
                  }
                }
              } else {
                for (k = 0; k < numPixels; k++) {
                  data.pixels.resultPixels[k] = val;
                }
              }
              return;
            },
            getDataTypeArray: function getDataTypeArray(t) {
              var tp;
              switch (t) {
                case 0:
                  tp = Int8Array;
                  break;
                case 1:
                  tp = Uint8Array;
                  break;
                case 2:
                  tp = Int16Array;
                  break;
                case 3:
                  tp = Uint16Array;
                  break;
                case 4:
                  tp = Int32Array;
                  break;
                case 5:
                  tp = Uint32Array;
                  break;
                case 6:
                  tp = Float32Array;
                  break;
                case 7:
                  tp = Float64Array;
                  break;
                default:
                  tp = Float32Array;
              }
              return tp;
            },
            getPixelType: function getPixelType(t) {
              var tp;
              switch (t) {
                case 0:
                  tp = "S8";
                  break;
                case 1:
                  tp = "U8";
                  break;
                case 2:
                  tp = "S16";
                  break;
                case 3:
                  tp = "U16";
                  break;
                case 4:
                  tp = "S32";
                  break;
                case 5:
                  tp = "U32";
                  break;
                case 6:
                  tp = "F32";
                  break;
                case 7:
                  tp = "F64";
                  break;
                default:
                  tp = "F32";
              }
              return tp;
            },
            isValidPixelValue: function isValidPixelValue(t, val) {
              if (val === null || val === undefined) {
                return false;
              }
              var isValid;
              switch (t) {
                case 0:
                  isValid = val >= -128 && val <= 127;
                  break;
                case 1:
                  isValid = val >= 0 && val <= 255;
                  break;
                case 2:
                  isValid = val >= -32768 && val <= 32767;
                  break;
                case 3:
                  isValid = val >= 0 && val <= 65536;
                  break;
                case 4:
                  isValid = val >= -2147483648 && val <= 2147483647;
                  break;
                case 5:
                  isValid = val >= 0 && val <= 4294967296;
                  break;
                case 6:
                  isValid = val >= -3.4027999387901484e+38 && val <= 3.4027999387901484e+38;
                  break;
                case 7:
                  isValid = val >= 5e-324 && val <= 1.7976931348623157e+308;
                  break;
                default:
                  isValid = false;
              }
              return isValid;
            },
            getDateTypeSize: function getDateTypeSize(t) {
              var s = 0;
              switch (t) {
                case 0:
                case 1:
                  s = 1;
                  break;
                case 2:
                case 3:
                  s = 2;
                  break;
                case 4:
                case 5:
                case 6:
                  s = 4;
                  break;
                case 7:
                  s = 8;
                  break;
                default:
                  s = t;
              }
              return s;
            },
            getDataTypeUsed: function getDataTypeUsed(dt, tc) {
              var t = dt;
              switch (dt) {
                case 2:
                case 4:
                  t = dt - tc;
                  break;
                case 3:
                case 5:
                  t = dt - 2 * tc;
                  break;
                case 6:
                  if (0 === tc) {
                    t = dt;
                  } else if (1 === tc) {
                    t = 2;
                  } else {
                    t = 1;
                  }
                  break;
                case 7:
                  if (0 === tc) {
                    t = dt;
                  } else {
                    t = dt - 2 * tc + 1;
                  }
                  break;
                default:
                  t = dt;
                  break;
              }
              return t;
            },
            getOnePixel: function getOnePixel(block, blockPtr, offsetType, view) {
              var temp = 0;
              switch (offsetType) {
                case 0:
                  temp = view.getInt8(blockPtr);
                  break;
                case 1:
                  temp = view.getUint8(blockPtr);
                  break;
                case 2:
                  temp = view.getInt16(blockPtr, true);
                  break;
                case 3:
                  temp = view.getUint16(blockPtr, true);
                  break;
                case 4:
                  temp = view.getInt32(blockPtr, true);
                  break;
                case 5:
                  temp = view.getUInt32(blockPtr, true);
                  break;
                case 6:
                  temp = view.getFloat32(blockPtr, true);
                  break;
                case 7:
                  temp = view.getFloat64(blockPtr, true);
                  break;
                default:
                  throw "the decoder does not understand this pixel type";
              }
              return temp;
            }
          };
          var TreeNode = function TreeNode(val, left, right) {
            this.val = val;
            this.left = left;
            this.right = right;
          };
          var Lerc2Decode = {
            decode: function decode(input, options) {
              options = options || {};
              var skipMask = options.maskData || options.maskData === null;
              var noDataValue = options.noDataValue;
              var i = 0,
                data = {};
              data.ptr = options.inputOffset || 0;
              data.pixels = {};
              if (!Lerc2Helpers.readHeaderInfo(input, data)) ;
              var headerInfo = data.headerInfo;
              var OutPixelTypeArray = Lerc2Helpers.getDataTypeArray(headerInfo.imageType);
              if (skipMask) {
                data.pixels.resultMask = options.maskData;
                data.ptr += 4;
              } else {
                if (!Lerc2Helpers.readMask(input, data)) ;
              }
              var numPixels = headerInfo.width * headerInfo.height;
              data.pixels.resultPixels = new OutPixelTypeArray(numPixels);
              data.counter = {
                onesweep: 0,
                uncompressed: 0,
                lut: 0,
                bitstuffer: 0,
                constant: 0,
                constantoffset: 0
              };
              if (headerInfo.numValidPixel !== 0) {
                if (headerInfo.zMax === headerInfo.zMin) {
                    Lerc2Helpers.constructConstantSurface(data);
                  } else {
                  var view = new DataView(input, data.ptr, 2);
                  var bReadDataOneSweep = view.getUint8(0, true);
                  data.ptr++;
                  if (bReadDataOneSweep) {
                    Lerc2Helpers.readDataOneSweep(input, data, OutPixelTypeArray);
                  } else {
                    if (headerInfo.fileVersion > 1 && headerInfo.imageType <= 1 && Math.abs(headerInfo.maxZError - 0.5) < 0.00001) {
                      var bReadHuffman = view.getUint8(1, true);
                      data.ptr++;
                      if (bReadHuffman) {
                        Lerc2Helpers.readHuffman(input, data, OutPixelTypeArray);
                      } else {
                        Lerc2Helpers.readTiles(input, data, OutPixelTypeArray);
                      }
                    } else {
                      Lerc2Helpers.readTiles(input, data, OutPixelTypeArray);
                    }
                  }
                }
              }
              data.eofOffset = data.ptr;
              var diff;
              if (options.inputOffset) {
                diff = data.headerInfo.blobSize + options.inputOffset - data.ptr;
                if (Math.abs(diff) >= 1) {
                  data.eofOffset = options.inputOffset + data.headerInfo.blobSize;
                }
              } else {
                diff = data.headerInfo.blobSize - data.ptr;
                if (Math.abs(diff) >= 1) {
                  data.eofOffset = data.headerInfo.blobSize;
                }
              }
              var result = {
                width: headerInfo.width,
                height: headerInfo.height,
                pixelData: data.pixels.resultPixels,
                minValue: headerInfo.zMin,
                maxValue: headerInfo.zMax,
                maskData: data.pixels.resultMask
              };
              if (data.pixels.resultMask && Lerc2Helpers.isValidPixelValue(headerInfo.imageType, noDataValue)) {
                var mask = data.pixels.resultMask;
                for (i = 0; i < numPixels; i++) {
                  if (!mask[i]) {
                    result.pixelData[i] = noDataValue;
                  }
                }
                result.noDataValue = noDataValue;
              }
              data.noDataValue = noDataValue;
              if (options.returnFileInfo) {
                result.fileInfo = Lerc2Helpers.formatFileInfo(data);
              }
              return result;
            },
            getBandCount: function getBandCount(input) {
              var count = 0;
              var i = 0;
              var temp = {};
              temp.ptr = 0;
              temp.pixels = {};
              while (i < input.byteLength - 58) {
                Lerc2Helpers.readHeaderInfo(input, temp);
                i += temp.headerInfo.blobSize;
                count++;
                temp.ptr = i;
              }
              return count;
            }
          };
          return Lerc2Decode;
        }();
        var Lerc = {
          decode: function decode(encodedData, options) {
            options = options || {};
            var inputOffset = options.inputOffset || 0;
            var fileIdView = new Uint8Array(encodedData, inputOffset, 10);
            var fileIdentifierString = String.fromCharCode.apply(null, fileIdView);
            var lerc;
            if (fileIdentifierString.trim() === "CntZImage") {
              lerc = LercDecode;
            } else if (fileIdentifierString.substring(0, 5) === "Lerc2") {
              lerc = Lerc2Decode;
            } else {
              throw "Unexpected file identifier string: " + fileIdentifierString;
            }
            var iPlane = 0,
              eof = encodedData.byteLength - 10,
              encodedMaskData,
              maskData;
            var decodedPixelBlock = {
              width: 0,
              height: 0,
              pixels: [],
              pixelType: options.pixelType,
              mask: null,
              statistics: []
            };
            while (inputOffset < eof) {
              var result = lerc.decode(encodedData, {
                inputOffset: inputOffset,
                encodedMaskData: encodedMaskData,
                maskData: maskData,
                returnMask: iPlane === 0 ? true : false,
                returnEncodedMask: iPlane === 0 ? true : false,
                returnFileInfo: true,
                pixelType: options.pixelType || null,
                noDataValue: options.noDataValue || null
              });
              inputOffset = result.fileInfo.eofOffset;
              if (iPlane === 0) {
                encodedMaskData = result.encodedMaskData;
                maskData = result.maskData;
                decodedPixelBlock.width = result.width;
                decodedPixelBlock.height = result.height;
                decodedPixelBlock.pixelType = result.pixelType || result.fileInfo.pixelType;
                decodedPixelBlock.mask = result.maskData;
              }
              iPlane++;
              decodedPixelBlock.pixels.push(result.pixelData);
              decodedPixelBlock.statistics.push({
                minValue: result.minValue,
                maxValue: result.maxValue,
                noDataValue: result.noDataValue
              });
            }
            return decodedPixelBlock;
          }
        };
        if (module.exports) {
          module.exports = Lerc;
        } else {
          this.Lerc = Lerc;
        }
      })();
    })(lerc);

    var canvas;
    var OPTIONS = {
      width: 100,
      height: 10
    };
    var offscreenCanvas = false;
    try {
      var _canvas = new OffscreenCanvas(1, 1);
      var ctx = _canvas.getContext('2d');
      ctx.fillText('hello', 0, 0);
      offscreenCanvas = true;
    } catch (err) {
      offscreenCanvas = false;
    }
    function getCanvas() {
      if (!canvas) {
        var {
          width: width,
          height: height
        } = OPTIONS;
        if (offscreenCanvas) {
          canvas = new OffscreenCanvas(width, height);
        } else {
          canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
        }
      }
      return canvas;
    }
    class ColorIn {
      constructor(colors, options = {}) {
        if (!Array.isArray(colors)) {
          console.error('colors is not array');
          return;
        }
        if (colors.length < 2) {
          console.error('colors.length should >1');
          return;
        }
        this.colors = colors;
        var min = Infinity,
          max = -Infinity;
        for (var i = 0, len = colors.length; i < len; i++) {
          var value = colors[i][0];
          min = Math.min(value, min);
          max = Math.max(value, max);
        }
        this.min = min;
        this.max = max;
        this.valueOffset = this.max - this.min;
        this.options = Object.assign({}, OPTIONS, options);
        this._initImgData();
      }
      getImageData() {
        return this.imgData;
      }
      _initImgData() {
        var canvas = getCanvas();
        var {
          width: width,
          height: height
        } = this.options;
        canvas.width = width;
        canvas.height = height;
        var ctx = canvas.getContext('2d', {
          willReadFrequently: true
        });
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        var gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
        var {
          colors: colors,
          valueOffset: valueOffset
        } = this;
        for (var i = 0, len = colors.length; i < len; i++) {
          var [stop, color] = colors[i];
          var s = (stop - this.min) / valueOffset;
          gradient.addColorStop(s, color);
        }
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        this.imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      }
      getColor(stop) {
        stop = Math.max(this.min, stop);
        stop = Math.min(stop, this.max);
        var s = (stop - this.min) / this.valueOffset;
        var x = Math.round(s * this.imgData.width);
        x = Math.min(x, this.imgData.width - 1);
        var idx = x * 4;
        var r = this.imgData.data[idx];
        var g = this.imgData.data[idx + 1];
        var b = this.imgData.data[idx + 2];
        var a = this.imgData.data[idx + 3];
        return [r, g, b, a];
      }
    }

    var LRUCount = 200;
    var tileImageCache = new LRUCache(LRUCount, function (image) {
      disposeImage(image);
    });
    var tileBufferCache = new LRUCache(LRUCount, function (buffer) {});
    var CONTROLCACHE = {};
    function cacheFetch(taskId, control) {
      CONTROLCACHE[taskId] = CONTROLCACHE[taskId] || [];
      CONTROLCACHE[taskId].push(control);
    }
    function cancelFetch(taskId) {
      var controlList = CONTROLCACHE[taskId] || [];
      if (controlList.length) {
        controlList.forEach(function (control) {
          control.abort(FetchCancelError);
        });
      }
      delete CONTROLCACHE[taskId];
    }
    function finishFetch(control) {
      var deletekeys = [];
      for (var key in CONTROLCACHE) {
        var controlList = CONTROLCACHE[key] || [];
        if (controlList.length) {
          var index = controlList.indexOf(control);
          if (index > -1) {
            controlList.splice(index, 1);
          }
        }
        if (controlList.length === 0) {
          deletekeys.push(key);
        }
      }
      deletekeys.forEach(function (key) {
        delete CONTROLCACHE[key];
      });
    }
    function fetchTile(url, headers = {}, options) {
      return new Promise(function (resolve, reject) {
        var copyImageBitMap = function copyImageBitMap(image) {
          createImageBitmap(image).then(function (imagebit) {
            resolve(imagebit);
          })["catch"](function (error) {
            reject(error);
          });
        };
        if (isImageBitmap(url)) {
          copyImageBitMap(url);
          return;
        }
        var taskId = options.__taskId;
        if (!taskId) {
          reject(createInnerError('taskId is null'));
          return;
        }
        var image = tileImageCache.get(url);
        if (image) {
          copyImageBitMap(image);
        } else {
          var fetchOptions = options.fetchOptions || {
            headers: headers,
            referrer: options.referrer
          };
          var timeout = options.timeout || 0;
          var control = new AbortController();
          var signal = control.signal;
          if (timeout && isNumber$1(timeout) && timeout > 0) {
            setTimeout(function () {
              control.abort(FetchTimeoutError);
            }, timeout);
          }
          fetchOptions.signal = signal;
          delete fetchOptions.timeout;
          cacheFetch(taskId, control);
          fetch(url, fetchOptions).then(function (res) {
            if (!res.ok) {
              reject(createNetWorkError(url));
            }
            return res.blob();
          }).then(function (blob) {
            return createImageBitmap(blob);
          }).then(function (image) {
            if (options.disableCache !== true) {
              tileImageCache.add(url, image);
            }
            finishFetch(control);
            copyImageBitMap(image);
          })["catch"](function (error) {
            finishFetch(control);
            reject(error);
          });
        }
      });
    }
    function fetchTileBuffer(url, headers = {}, options) {
      return new Promise(function (resolve, reject) {
        var copyBuffer = function copyBuffer(buffer) {
          resolve(buffer);
        };
        var taskId = options.__taskId;
        if (!taskId) {
          reject(createInnerError('taskId is null'));
          return;
        }
        var buffer = tileBufferCache.get(url);
        if (buffer) {
          copyBuffer(buffer);
        } else {
          var fetchOptions = options.fetchOptions || {
            headers: headers,
            referrer: options.referrer
          };
          var timeout = options.timeout || 0;
          var control = new AbortController();
          var signal = control.signal;
          if (timeout && isNumber$1(timeout) && timeout > 0) {
            setTimeout(function () {
              control.abort(FetchTimeoutError);
            }, timeout);
          }
          fetchOptions.signal = signal;
          delete fetchOptions.timeout;
          cacheFetch(taskId, control);
          fetch(url, fetchOptions).then(function (res) {
            if (!res.ok) {
              reject(createNetWorkError(url));
            }
            return res.arrayBuffer();
          }).then(function (buffer) {
            if (options.disableCache !== true) {
              tileBufferCache.add(url, buffer);
            }
            finishFetch(control);
            copyBuffer(buffer);
          })["catch"](function (error) {
            finishFetch(control);
            reject(error);
          });
        }
      });
    }
    function getTile(url, options) {
      return new Promise(function (resolve, reject) {
        var urls = checkTileUrl(url);
        var headers = Object.assign({}, HEADERS, options.headers || {});
        var fetchTiles = urls.map(function (tileUrl) {
          return fetchTile(tileUrl, headers, options);
        });
        var {
          returnBlobURL: returnBlobURL,
          globalCompositeOperation: globalCompositeOperation
        } = options;
        Promise.all(fetchTiles).then(function (imagebits) {
          getCanvas$1();
          var image = mergeTiles(imagebits, globalCompositeOperation);
          if (image instanceof Error) {
            reject(image);
            return;
          }
          var postImage = postProcessingImage(image, options);
          createImageBlobURL(postImage, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        })["catch"](function (error) {
          reject(error);
        });
      });
    }
    function getTileWithMaxZoom(options) {
      var {
        urlTemplate: urlTemplate,
        x: x,
        y: y,
        z: z,
        maxAvailableZoom: maxAvailableZoom,
        subdomains: subdomains,
        returnBlobURL: returnBlobURL,
        globalCompositeOperation: globalCompositeOperation
      } = options;
      return new Promise(function (resolve, reject) {
        var urlTemplates = checkTileUrl(urlTemplate);
        for (var i = 0, len = urlTemplates.length; i < len; i++) {
          var _urlTemplate = urlTemplates[i];
          if (!validateSubdomains(_urlTemplate, subdomains)) {
            reject(createParamsValidateError('not find subdomains'));
            return;
          }
        }
        var dxScale, dyScale, wScale, hScale;
        var tileX = x,
          tileY = y,
          tileZ = z;
        var zoomOffset = z - maxAvailableZoom;
        if (zoomOffset > 0) {
          var px = x,
            py = y;
          var zoom = z;
          while (zoom > maxAvailableZoom) {
            px = Math.floor(px / 2);
            py = Math.floor(py / 2);
            zoom--;
          }
          var scale = Math.pow(2, zoomOffset);
          var startX = Math.floor(px * scale);
          var endX = startX + scale;
          var startY = Math.floor(py * scale);
          var endY = startY + scale;
          if (startX > x) {
            startX--;
            endX--;
          }
          if (startY > y) {
            startY--;
            endY--;
          }
          dxScale = (x - startX) / (endX - startX);
          dyScale = (y - startY) / (endY - startY);
          wScale = 1 / (endX - startX);
          hScale = 1 / (endY - startY);
          tileX = px;
          tileY = py;
          tileZ = maxAvailableZoom;
        }
        var urls = urlTemplates.map(function (urlTemplate) {
          return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
        });
        var headers = Object.assign({}, HEADERS, options.headers || {});
        var fetchTiles = urls.map(function (url) {
          return fetchTile(url, headers, options);
        });
        Promise.all(fetchTiles).then(function (imagebits) {
          var canvas = getCanvas$1();
          var image = mergeTiles(imagebits, globalCompositeOperation);
          if (image instanceof Error) {
            reject(image);
            return;
          }
          var postImage = postProcessingImage(image, options);
          var sliceImage;
          if (zoomOffset <= 0) {
            sliceImage = postImage;
          } else {
            var {
              width: width,
              height: height
            } = postImage;
            var dx = width * dxScale,
              dy = height * dyScale,
              w = width * wScale,
              h = height * hScale;
            sliceImage = imageTileScale(canvas, postImage, dx, dy, w, h);
          }
          createImageBlobURL(sliceImage, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        })["catch"](function (error) {
          reject(error);
        });
      });
    }
    function layout_Tiles(options) {
      var {
        urlTemplate: urlTemplate,
        tiles: tiles,
        subdomains: subdomains,
        returnBlobURL: returnBlobURL,
        debug: debug
      } = options;
      return new Promise(function (resolve, reject) {
        if (!validateSubdomains(urlTemplate, subdomains)) {
          reject(createParamsValidateError('not find subdomains'));
          return;
        }
        var urls = tiles.map(function (tile) {
          var [tileX, tileY, tileZ] = tile;
          return getTileUrl(urlTemplate, tileX, tileY, tileZ, subdomains);
        });
        var headers = Object.assign({}, HEADERS, options.headers || {});
        var fetchTiles = urls.map(function (url) {
          return fetchTile(url, headers, options);
        });
        Promise.all(fetchTiles).then(function (imagebits) {
          imagebits.forEach(function (image, index) {
            tiles[index].tileImage = image;
          });
          var bigImage = layoutTiles(tiles, debug);
          var postImage = postProcessingImage(bigImage, options);
          createImageBlobURL(postImage, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        })["catch"](function (error) {
          reject(error);
        });
      });
    }
    function encodeTerrainTile(url, options) {
      return new Promise(function (resolve, reject) {
        var urls = checkTileUrl(url);
        var headers = Object.assign({}, HEADERS, options.headers || {});
        var {
          returnBlobURL: returnBlobURL,
          terrainWidth: terrainWidth,
          tileSize: tileSize,
          terrainType: terrainType,
          minHeight: minHeight,
          maxHeight: maxHeight,
          terrainColors: terrainColors
        } = options;
        var returnImage = function returnImage(terrainImage) {
          createImageBlobURL(terrainImage, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        };
        var isMapZen = terrainType === 'mapzen',
          isGQIS = terrainType === 'qgis-gray',
          isTianditu = terrainType === 'tianditu',
          isCesium = terrainType === 'cesium',
          isArcgis = terrainType === 'arcgis';
        if (isMapZen || isGQIS) {
          var fetchTiles = urls.map(function (tileUrl) {
            return fetchTile(tileUrl, headers, options);
          });
          Promise.all(fetchTiles).then(function (imagebits) {
            var canvas = getCanvas$1();
            var image = mergeTiles(imagebits);
            if (image instanceof Error) {
              reject(image);
              return;
            }
            resizeCanvas(canvas, image.width, image.height);
            var ctx = getCanvasContext(canvas);
            ctx.drawImage(image, 0, 0);
            var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            if (isMapZen) {
              transformMapZen(imageData);
            } else {
              transformQGisGray(imageData, minHeight, maxHeight);
            }
            ctx.putImageData(imageData, 0, 0);
            var terrainImage = canvas.transferToImageBitmap();
            returnImage(colorsTerrainTile(terrainColors, terrainImage));
          })["catch"](function (error) {
            reject(error);
          });
        } else if (isTianditu || isCesium || isArcgis) {
          var _fetchTiles = urls.map(function (tileUrl) {
            return fetchTileBuffer(tileUrl, headers, options);
          });
          Promise.all(_fetchTiles).then(function (buffers) {
            if (!buffers || buffers.length === 0) {
              reject(createDataError('buffers is null'));
              return;
            }
            var buffer = buffers[0];
            if (buffer.byteLength === 0) {
              reject(createDataError('buffer is empty'));
              return;
            }
            var result;
            if (isTianditu) {
              result = generateTiandituTerrain(buffer, terrainWidth, tileSize);
            } else if (isCesium) {
              result = cesiumTerrainToHeights(buffer, terrainWidth, tileSize);
            } else if (isArcgis) {
              result = lerc.exports.decode(buffer);
              result.image = transformArcgis(result);
            }
            if (!result || !result.image) {
              reject(createInnerError('generate terrain data error,not find image data'));
              return;
            }
            returnImage(colorsTerrainTile(terrainColors, result.image));
          })["catch"](function (error) {
            reject(error);
          });
        } else {
          reject(createParamsValidateError('not support terrainType:' + terrainType));
        }
      });
    }
    var colorInCache = new Map();
    function colorsTerrainTile(colors, image) {
      if (!colors || !Array.isArray(colors) || colors.length < 2) {
        return image;
      }
      var key = JSON.stringify(colors);
      var ci = colorInCache.get(key);
      if (!ci) {
        ci = new ColorIn(colors);
        colorInCache.set(key, ci);
      }
      var {
        width: width,
        height: height
      } = image;
      var canvas = getCanvas$1();
      resizeCanvas(canvas, width, height);
      var ctx = getCanvasContext(canvas);
      ctx.drawImage(image, 0, 0);
      var imageData = ctx.getImageData(0, 0, width, height);
      var data = imageData.data;
      for (var i = 0; i < data.length; i += 4) {
        var R = data[i];
        var G = data[i + 1];
        var B = data[i + 2];
        var A = data[i + 3];
        if (A === 0) {
          data[i] = 0;
          data[i + 1] = 0;
          data[i + 2] = 0;
        } else {
          var _height = rgb2Height(R, G, B);
          var [r, g, b, a] = ci.getColor(_height);
          data[i] = r;
          data[i + 1] = g;
          data[i + 2] = b;
          data[i + 3] = a;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      disposeImage(image);
      return canvas.transferToImageBitmap();
    }

    var SIZE = 512;
    function imageSlicing(options) {
      options.disableCache = true;
      return new Promise(function (resolve, reject) {
        var url = options.url;
        var urls = checkTileUrl(url);
        var headers = Object.assign({}, HEADERS, options.headers || {});
        var fetchTiles = urls.map(function (tileUrl) {
          return fetchTile(tileUrl, headers, options);
        });
        Promise.all(fetchTiles).then(function (imagebits) {
          var canvas = getCanvas$1(SIZE);
          var image = mergeTiles(imagebits);
          if (image instanceof Error) {
            reject(image);
            return;
          }
          var {
            width: width,
            height: height
          } = image;
          var rows = Math.ceil(height / SIZE);
          var cols = Math.ceil(width / SIZE);
          var items = [];
          for (var row = 1; row <= rows; row++) {
            var y1 = (row - 1) * SIZE;
            var y2 = Math.min(height, row * SIZE);
            for (var col = 1; col <= cols; col++) {
              var x1 = (col - 1) * SIZE;
              var x2 = Math.min(width, col * SIZE);
              var w = x2 - x1,
                h = y2 - y1;
              resizeCanvas(canvas, w, h);
              var ctx = getCanvasContext(canvas);
              ctx.drawImage(image, x1, y1, w, h, 0, 0, canvas.width, canvas.height);
              var tempImage = canvas.transferToImageBitmap();
              var postImage = postProcessingImage(tempImage, options);
              items.push({
                id: uuid(),
                x: x1,
                y: y1,
                width: w,
                height: h,
                row: row,
                col: col,
                image: postImage
              });
            }
          }
          var result = {
            rows: rows,
            cols: cols,
            rowWidth: SIZE,
            colsHeight: SIZE,
            width: width,
            height: height,
            items: items
          };
          disposeImage(image);
          resolve(result);
        })["catch"](function (error) {
          reject(error);
        });
      });
    }
    function imageToBlobURL(options) {
      return new Promise(function (resolve, reject) {
        var debug = options.debug;
        var items = options.items;
        var workerId = options._workerId;
        var temp = [];
        var isEnd = function isEnd() {
          return temp.length === items.length;
        };
        items.forEach(function (item, index) {
          var canvas = new OffscreenCanvas(item.width, item.height);
          var ctx = getCanvasContext(canvas);
          ctx.drawImage(item.image, 0, 0);
          if (debug) {
            console.log('workerId:' + workerId + ',image to blob url :' + (index + 1) + '/' + items.length);
          }
          canvas.convertToBlob().then(function (blob) {
            var url = URL.createObjectURL(blob);
            item.url = url;
            temp.push(1);
            disposeImage(item.image);
            delete item.image;
            if (isEnd()) {
              resolve(items);
            }
          })["catch"](function (error) {
            console.error(error);
            reject(error);
          });
        });
      });
    }

    function bbox(geojson) {
      var b = [Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY];
      switch (geojson.type) {
        case 'FeatureCollection':
          var len = geojson.features.length;
          for (var i = 0; i < len; i++) {
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
          var len = g.geometries.length;
          for (var i = 0; i < len; i++) {
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
      for (var i = 0, len = l.length; i < len; i++) {
        point(l[i], b);
      }
    }
    function multiline(ml, b) {
      for (var i = 0, len = ml.length; i < len; i++) {
        line(ml[i], b);
      }
    }
    function polygon(p, b) {
      if (p.length) {
        line(p[0], b);
      }
    }
    function multipolygon(mp, b) {
      for (var i = 0, len = mp.length; i < len; i++) {
        polygon(mp[i], b);
      }
    }
    var bbox_cjs = bbox;

    var lineclip_1 = lineclip;
    lineclip.polyline = lineclip;
    lineclip.polygon = polygonclip;
    function lineclip(points, bbox, result) {
      var len = points.length,
        codeA = bitCode(points[0], bbox),
        part = [],
        i,
        a,
        b,
        codeB,
        lastCode;
      if (!result) result = [];
      for (i = 1; i < len; i++) {
        a = points[i - 1];
        b = points[i];
        codeB = lastCode = bitCode(b, bbox);
        while (true) {
          if (!(codeA | codeB)) {
            part.push(a);
            if (codeB !== lastCode) {
              part.push(b);
              if (i < len - 1) {
                result.push(part);
                part = [];
              }
            } else if (i === len - 1) {
              part.push(b);
            }
            break;
          } else if (codeA & codeB) {
            break;
          } else if (codeA) {
            a = intersect(a, b, codeA, bbox);
            codeA = bitCode(a, bbox);
          } else {
            b = intersect(a, b, codeB, bbox);
            codeB = bitCode(b, bbox);
          }
        }
        codeA = lastCode;
      }
      if (part.length) result.push(part);
      return result;
    }
    function polygonclip(points, bbox) {
      var result, edge, prev, prevInside, i, p, inside;
      for (edge = 1; edge <= 8; edge *= 2) {
        result = [];
        prev = points[points.length - 1];
        prevInside = !(bitCode(prev, bbox) & edge);
        for (i = 0; i < points.length; i++) {
          p = points[i];
          inside = !(bitCode(p, bbox) & edge);
          if (inside !== prevInside) result.push(intersect(prev, p, edge, bbox));
          if (inside) result.push(p);
          prev = p;
          prevInside = inside;
        }
        points = result;
        if (!points.length) break;
      }
      return result;
    }
    function intersect(a, b, edge, bbox) {
      return edge & 8 ? [a[0] + (b[0] - a[0]) * (bbox[3] - a[1]) / (b[1] - a[1]), bbox[3]] : edge & 4 ? [a[0] + (b[0] - a[0]) * (bbox[1] - a[1]) / (b[1] - a[1]), bbox[1]] : edge & 2 ? [bbox[2], a[1] + (b[1] - a[1]) * (bbox[2] - a[0]) / (b[0] - a[0])] : edge & 1 ? [bbox[0], a[1] + (b[1] - a[1]) * (bbox[0] - a[0]) / (b[0] - a[0])] : null;
    }
    function bitCode(p, bbox) {
      var code = 0;
      if (p[0] < bbox[0]) code |= 1;else if (p[0] > bbox[2]) code |= 2;
      if (p[1] < bbox[1]) code |= 4;else if (p[1] > bbox[3]) code |= 8;
      return code;
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
      var [x1, y1, x2, y2] = bbox1;
      return x1 >= bbox2[0] && x2 <= bbox2[2] && y1 >= bbox2[1] && y2 <= bbox2[3];
    }
    function bboxToPoints(bbox) {
      var [minx, miny, maxx, maxy] = bbox;
      return [[minx, miny], [maxx, miny], [maxx, maxy], [minx, maxy]];
    }
    function pointsToBBOX(points) {
      var xmin = Infinity,
        ymin = Infinity,
        xmax = -Infinity,
        ymax = -Infinity;
      points.forEach(function (point) {
        xmin = Math.min(xmin, point[0]);
        xmax = Math.max(xmax, point[0]);
        ymin = Math.min(ymin, point[1]);
        ymax = Math.max(ymax, point[1]);
      });
      return [xmin, ymin, xmax, ymax];
    }
    function bboxOfBBOXList(bboxList) {
      var xmin = Infinity,
        ymin = Infinity,
        xmax = -Infinity,
        ymax = -Infinity;
      bboxList.forEach(function (bbox) {
        var [minx, miny, maxx, maxy] = bbox;
        xmin = Math.min(xmin, minx);
        xmax = Math.max(xmax, maxx);
        ymin = Math.min(ymin, miny);
        ymax = Math.max(ymax, maxy);
      });
      return [xmin, ymin, xmax, ymax];
    }

    var GeoJSONCache = {};
    function injectMask(maskId, geojson) {
      if (!isPolygon(geojson)) {
        return createParamsValidateError('geojson.feature is not Polygon');
      }
      if (GeoJSONCache[maskId]) {
        return createParamsValidateError('the' + maskId + ' geojson Already exists');
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
      } else {
        var _transformRing = function transformRing(coord) {
          var result = [];
          for (var i = 0, len = coord.length; i < len; i++) {
            var c = coord[i];
            if (Array.isArray(c[0])) {
              result.push(_transformRing(c));
            } else {
              result[i] = lnglat2Mercator(c);
            }
          }
          return result;
        };
        return _transformRing(coordinates);
      }
    }
    function coordinate2Pixel(tileBBOX, tileSize, coordinate) {
      var [minx, miny, maxx, maxy] = tileBBOX;
      var dx = maxx - minx,
        dy = maxy - miny;
      var ax = dx / tileSize,
        ay = dy / tileSize;
      var [x, y] = coordinate;
      var px = (x - minx) / ax;
      var py = tileSize - (y - miny) / ay;
      return [px, py];
    }
    function transformPixels(projection, tileBBOX, tileSize, coordinates) {
      var [minx, miny, maxx, maxy] = tileBBOX;
      var _transformRing2 = function transformRing(coord, bbox) {
        var result = [];
        for (var i = 0, len = coord.length; i < len; i++) {
          var c = coord[i];
          if (Array.isArray(c[0])) {
            result.push(_transformRing2(c, bbox));
          } else {
            result[i] = coordinate2Pixel(bbox, tileSize, c);
          }
        }
        return result;
      };
      if (isEPSG3857(projection)) {
        var [mminx, mminy] = lnglat2Mercator([minx, miny]);
        var [mmaxx, mmaxy] = lnglat2Mercator([maxx, maxy]);
        var mTileBBOX = [mminx, mminy, mmaxx, mmaxy];
        return _transformRing2(coordinates, mTileBBOX);
      } else {
        return _transformRing2(coordinates, tileBBOX);
      }
    }
    function clip(options) {
      return new Promise(function (resolve, reject) {
        var {
          tile: tile,
          tileBBOX: tileBBOX,
          projection: projection,
          tileSize: tileSize,
          maskId: maskId,
          returnBlobURL: returnBlobURL,
          reverse: reverse
        } = options;
        var feature = GeoJSONCache[maskId];
        var canvas = getCanvas$1(tileSize);
        var returnImage = function returnImage(image) {
          createImageBlobURL(image, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        };
        var bbox = feature.bbox;
        if (!bbox) {
          returnImage(tile);
          return;
        }
        var {
          coordinates: coordinates,
          type: type
        } = feature.geometry;
        if (!coordinates.length) {
          returnImage(tile);
          return;
        }
        var judgeReverse = function judgeReverse() {
          if (!reverse) {
            returnImage(getBlankTile(tileSize));
          } else {
            returnImage(tile);
          }
        };
        if (!bboxIntersect(bbox, tileBBOX)) {
          judgeReverse();
          return;
        }
        var polygons = coordinates;
        if (type === 'Polygon') {
          polygons = [polygons];
        }
        var newCoordinates;
        if (bboxInBBOX(bbox, tileBBOX)) {
          newCoordinates = transformCoordinates(projection, polygons);
          var _pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
          var _image = imageClip(canvas, _pixels, tile, reverse);
          returnImage(_image);
          return;
        }
        var validateClipRing = function validateClipRing(result) {
          if (result.length > 0) {
            var minx = Infinity,
              maxx = -Infinity,
              miny = Infinity,
              maxy = -Infinity;
            for (var j = 0, len1 = result.length; j < len1; j++) {
              var [x, y] = result[j];
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
        var clipRings = [];
        for (var i = 0, len = polygons.length; i < len; i++) {
          var polygon = polygons[i];
          for (var j = 0, len1 = polygon.length; j < len1; j++) {
            var ring = polygon[j];
            var result = lineclip_1.polygon(ring, tileBBOX);
            if (validateClipRing(result)) {
              clipRings.push([result]);
            }
          }
        }
        if (clipRings.length === 0) {
          judgeReverse();
          return;
        }
        newCoordinates = transformCoordinates(projection, clipRings);
        var pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
        var image = imageClip(canvas, pixels, tile, reverse);
        returnImage(image);
      });
    }

    function _classPrivateFieldLooseBase(e, t) {
      if (!{}.hasOwnProperty.call(e, t)) throw new TypeError("attempted to use private field on non-instance");
      return e;
    }
    var id = 0;
    function _classPrivateFieldLooseKey(e) {
      return "__private_" + id++ + "_" + e;
    }

    var D2R$1 = Math.PI / 180;
    var R2D$1 = 180 / Math.PI;
    var A$1 = 6378137.0;
    var MAXEXTENT$1 = 20037508.342789244;
    var SPHERICAL_MERCATOR_SRS = '900913';
    var WGS84$1 = 'WGS84';

    var cache = {};
    function isFloat(n) {
      return Number(n) === n && n % 1 !== 0;
    }
    var _size = _classPrivateFieldLooseKey("size");
    var _expansion = _classPrivateFieldLooseKey("expansion");
    var _Bc = _classPrivateFieldLooseKey("Bc");
    var _Cc = _classPrivateFieldLooseKey("Cc");
    var _zc = _classPrivateFieldLooseKey("zc");
    var _Ac = _classPrivateFieldLooseKey("Ac");
    class SphericalMercator {
      constructor(options = {}) {
        Object.defineProperty(this, _size, {
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, _expansion, {
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, _Bc, {
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, _Cc, {
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, _zc, {
          writable: true,
          value: void 0
        });
        Object.defineProperty(this, _Ac, {
          writable: true,
          value: void 0
        });
        _classPrivateFieldLooseBase(this, _size)[_size] = options.size || 256;
        _classPrivateFieldLooseBase(this, _expansion)[_expansion] = options.antimeridian ? 2 : 1;
        if (!cache[_classPrivateFieldLooseBase(this, _size)[_size]]) {
          var size = _classPrivateFieldLooseBase(this, _size)[_size];
          var c = cache[_classPrivateFieldLooseBase(this, _size)[_size]] = {};
          c.Bc = [];
          c.Cc = [];
          c.zc = [];
          c.Ac = [];
          for (var d = 0; d < 30; d++) {
            c.Bc.push(size / 360);
            c.Cc.push(size / (2 * Math.PI));
            c.zc.push(size / 2);
            c.Ac.push(size);
            size *= 2;
          }
        }
        _classPrivateFieldLooseBase(this, _Bc)[_Bc] = cache[_classPrivateFieldLooseBase(this, _size)[_size]].Bc;
        _classPrivateFieldLooseBase(this, _Cc)[_Cc] = cache[_classPrivateFieldLooseBase(this, _size)[_size]].Cc;
        _classPrivateFieldLooseBase(this, _zc)[_zc] = cache[_classPrivateFieldLooseBase(this, _size)[_size]].zc;
        _classPrivateFieldLooseBase(this, _Ac)[_Ac] = cache[_classPrivateFieldLooseBase(this, _size)[_size]].Ac;
      }
      px(ll, zoom) {
        if (isFloat(zoom)) {
          var size = _classPrivateFieldLooseBase(this, _size)[_size] * Math.pow(2, zoom);
          var d = size / 2;
          var bc = size / 360;
          var cc = size / (2 * Math.PI);
          var ac = size;
          var f = Math.min(Math.max(Math.sin(D2R$1 * ll[1]), -0.9999), 0.9999);
          var x = d + ll[0] * bc;
          var y = d + 0.5 * Math.log((1 + f) / (1 - f)) * -cc;
          x > ac * _classPrivateFieldLooseBase(this, _expansion)[_expansion] && (x = ac * _classPrivateFieldLooseBase(this, _expansion)[_expansion]);
          y > ac && (y = ac);
          return [x, y];
        } else {
          var _d = _classPrivateFieldLooseBase(this, _zc)[_zc][zoom];
          var _f = Math.min(Math.max(Math.sin(D2R$1 * ll[1]), -0.9999), 0.9999);
          var _x = Math.round(_d + ll[0] * _classPrivateFieldLooseBase(this, _Bc)[_Bc][zoom]);
          var _y = Math.round(_d + 0.5 * Math.log((1 + _f) / (1 - _f)) * -_classPrivateFieldLooseBase(this, _Cc)[_Cc][zoom]);
          _x > _classPrivateFieldLooseBase(this, _Ac)[_Ac][zoom] * _classPrivateFieldLooseBase(this, _expansion)[_expansion] && (_x = _classPrivateFieldLooseBase(this, _Ac)[_Ac][zoom] * _classPrivateFieldLooseBase(this, _expansion)[_expansion]);
          _y > _classPrivateFieldLooseBase(this, _Ac)[_Ac][zoom] && (_y = _classPrivateFieldLooseBase(this, _Ac)[_Ac][zoom]);
          return [_x, _y];
        }
      }
      ll(px, zoom) {
        if (isFloat(zoom)) {
          var size = _classPrivateFieldLooseBase(this, _size)[_size] * Math.pow(2, zoom);
          var bc = size / 360;
          var cc = size / (2 * Math.PI);
          var zc = size / 2;
          var g = (px[1] - zc) / -cc;
          var lon = (px[0] - zc) / bc;
          var lat = R2D$1 * (2 * Math.atan(Math.exp(g)) - 0.5 * Math.PI);
          return [lon, lat];
        } else {
          var _g = (px[1] - _classPrivateFieldLooseBase(this, _zc)[_zc][zoom]) / -_classPrivateFieldLooseBase(this, _Cc)[_Cc][zoom];
          var _lon = (px[0] - _classPrivateFieldLooseBase(this, _zc)[_zc][zoom]) / _classPrivateFieldLooseBase(this, _Bc)[_Bc][zoom];
          var _lat = R2D$1 * (2 * Math.atan(Math.exp(_g)) - 0.5 * Math.PI);
          return [_lon, _lat];
        }
      }
      convert(bbox, to) {
        if (to === SPHERICAL_MERCATOR_SRS) {
          return [...this.forward(bbox.slice(0, 2)), ...this.forward(bbox.slice(2, 4))];
        } else {
          return [...this.inverse(bbox.slice(0, 2)), ...this.inverse(bbox.slice(2, 4))];
        }
      }
      inverse(xy) {
        return [xy[0] * R2D$1 / A$1, (Math.PI * 0.5 - 2.0 * Math.atan(Math.exp(-xy[1] / A$1))) * R2D$1];
      }
      forward(ll) {
        var xy = [A$1 * ll[0] * D2R$1, A$1 * Math.log(Math.tan(Math.PI * 0.25 + 0.5 * ll[1] * D2R$1))];
        xy[0] > MAXEXTENT$1 && (xy[0] = MAXEXTENT$1);
        xy[0] < -MAXEXTENT$1 && (xy[0] = -MAXEXTENT$1);
        xy[1] > MAXEXTENT$1 && (xy[1] = MAXEXTENT$1);
        xy[1] < -MAXEXTENT$1 && (xy[1] = -MAXEXTENT$1);
        return xy;
      }
      bbox(x, y, zoom, tmsStyle, srs) {
        if (tmsStyle) {
          y = Math.pow(2, zoom) - 1 - y;
        }
        var ll = [x * _classPrivateFieldLooseBase(this, _size)[_size], (+y + 1) * _classPrivateFieldLooseBase(this, _size)[_size]];
        var ur = [(+x + 1) * _classPrivateFieldLooseBase(this, _size)[_size], y * _classPrivateFieldLooseBase(this, _size)[_size]];
        var bbox = [...this.ll(ll, zoom), ...this.ll(ur, zoom)];
        if (srs === SPHERICAL_MERCATOR_SRS) return this.convert(bbox, SPHERICAL_MERCATOR_SRS);
        return bbox;
      }
      xyz(bbox, zoom, tmsStyle, srs) {
        var box = srs === SPHERICAL_MERCATOR_SRS ? this.convert(bbox, WGS84$1) : bbox;
        var ll = [box[0], box[1]];
        var ur = [box[2], box[3]];
        var px_ll = this.px(ll, zoom);
        var px_ur = this.px(ur, zoom);
        var x = [Math.floor(px_ll[0] / _classPrivateFieldLooseBase(this, _size)[_size]), Math.floor((px_ur[0] - 1) / _classPrivateFieldLooseBase(this, _size)[_size])];
        var y = [Math.floor(px_ur[1] / _classPrivateFieldLooseBase(this, _size)[_size]), Math.floor((px_ll[1] - 1) / _classPrivateFieldLooseBase(this, _size)[_size])];
        var bounds = {
          minX: Math.min.apply(Math, x) < 0 ? 0 : Math.min.apply(Math, x),
          minY: Math.min.apply(Math, y) < 0 ? 0 : Math.min.apply(Math, y),
          maxX: Math.max.apply(Math, x),
          maxY: Math.max.apply(Math, y)
        };
        if (tmsStyle) {
          var tms = {
            minY: Math.pow(2, zoom) - 1 - bounds.maxY,
            maxY: Math.pow(2, zoom) - 1 - bounds.minY
          };
          bounds.minY = tms.minY;
          bounds.maxY = tms.maxY;
        }
        return bounds;
      }
    }

    var _to, _to2, _to3, _to4, _to5;
    /**
     * @preserve
     * gcoord 1.0.7, geographic coordinate library
     * Copyright (c) 2025 Jiulong Hu <me@hujiulong.com>
     */
    var {
      sin: sin$1,
      cos: cos$1,
      sqrt: sqrt$1,
      abs: abs$1,
      PI: PI$1
    } = Math;
    var a = 6378245;
    var ee = 0.006693421622965823;
    function isInChinaBbox(lon, lat) {
      return lon >= 72.004 && lon <= 137.8347 && lat >= 0.8293 && lat <= 55.8271;
    }
    function transformLat(x, y) {
      var ret = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * sqrt$1(abs$1(x));
      ret += (20 * sin$1(6 * x * PI$1) + 20 * sin$1(2 * x * PI$1)) * 2 / 3;
      ret += (20 * sin$1(y * PI$1) + 40 * sin$1(y / 3 * PI$1)) * 2 / 3;
      ret += (160 * sin$1(y / 12 * PI$1) + 320 * sin$1(y * PI$1 / 30)) * 2 / 3;
      return ret;
    }
    function transformLon(x, y) {
      var ret = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * sqrt$1(abs$1(x));
      ret += (20 * sin$1(6 * x * PI$1) + 20 * sin$1(2 * x * PI$1)) * 2 / 3;
      ret += (20 * sin$1(x * PI$1) + 40 * sin$1(x / 3 * PI$1)) * 2 / 3;
      ret += (150 * sin$1(x / 12 * PI$1) + 300 * sin$1(x / 30 * PI$1)) * 2 / 3;
      return ret;
    }
    function delta(lon, lat) {
      var dLon = transformLon(lon - 105, lat - 35);
      var dLat = transformLat(lon - 105, lat - 35);
      var radLat = lat / 180 * PI$1;
      var magic = sin$1(radLat);
      magic = 1 - ee * magic * magic;
      var sqrtMagic = sqrt$1(magic);
      dLon = dLon * 180 / (a / sqrtMagic * cos$1(radLat) * PI$1);
      dLat = dLat * 180 / (a * (1 - ee) / (magic * sqrtMagic) * PI$1);
      return [dLon, dLat];
    }
    function WGS84ToGCJ02(coord) {
      var [lon, lat] = coord;
      if (!isInChinaBbox(lon, lat)) return [lon, lat];
      var d = delta(lon, lat);
      return [lon + d[0], lat + d[1]];
    }
    function GCJ02ToWGS84(coord) {
      var [lon, lat] = coord;
      if (!isInChinaBbox(lon, lat)) return [lon, lat];
      var [wgsLon, wgsLat] = [lon, lat];
      var tempPoint = WGS84ToGCJ02([wgsLon, wgsLat]);
      var dx = tempPoint[0] - lon;
      var dy = tempPoint[1] - lat;
      while (abs$1(dx) > 1e-6 || abs$1(dy) > 1e-6) {
        wgsLon -= dx;
        wgsLat -= dy;
        tempPoint = WGS84ToGCJ02([wgsLon, wgsLat]);
        dx = tempPoint[0] - lon;
        dy = tempPoint[1] - lat;
      }
      return [wgsLon, wgsLat];
    }
    var {
      sin: sin,
      cos: cos,
      atan2: atan2,
      sqrt: sqrt,
      PI: PI
    } = Math;
    var baiduFactor = PI * 3000.0 / 180.0;
    function BD09ToGCJ02(coord) {
      var [lon, lat] = coord;
      var x = lon - 0.0065;
      var y = lat - 0.006;
      var z = sqrt(x * x + y * y) - 0.00002 * sin(y * baiduFactor);
      var theta = atan2(y, x) - 0.000003 * cos(x * baiduFactor);
      var newLon = z * cos(theta);
      var newLat = z * sin(theta);
      return [newLon, newLat];
    }
    function GCJ02ToBD09(coord) {
      var [lon, lat] = coord;
      var x = lon;
      var y = lat;
      var z = sqrt(x * x + y * y) + 0.00002 * sin(y * baiduFactor);
      var theta = atan2(y, x) + 0.000003 * cos(x * baiduFactor);
      var newLon = z * cos(theta) + 0.0065;
      var newLat = z * sin(theta) + 0.006;
      return [newLon, newLat];
    }
    var R2D = 180 / Math.PI;
    var D2R = Math.PI / 180;
    var A = 6378137.0;
    var MAXEXTENT = 20037508.342789244;
    function EPSG3857ToWGS84(xy) {
      return [xy[0] * R2D / A, (Math.PI * 0.5 - 2.0 * Math.atan(Math.exp(-xy[1] / A))) * R2D];
    }
    function WGS84ToEPSG3857(lonLat) {
      var adjusted = Math.abs(lonLat[0]) <= 180 ? lonLat[0] : lonLat[0] - (lonLat[0] < 0 ? -1 : 1) * 360;
      var xy = [A * adjusted * D2R, A * Math.log(Math.tan(Math.PI * 0.25 + 0.5 * lonLat[1] * D2R))];
      if (xy[0] > MAXEXTENT) xy[0] = MAXEXTENT;
      if (xy[0] < -MAXEXTENT) xy[0] = -MAXEXTENT;
      if (xy[1] > MAXEXTENT) xy[1] = MAXEXTENT;
      if (xy[1] < -MAXEXTENT) xy[1] = -MAXEXTENT;
      return xy;
    }
    var {
      abs: abs
    } = Math;
    var MCBAND = [12890594.86, 8362377.87, 5591021, 3481989.83, 1678043.12, 0];
    var LLBAND = [75, 60, 45, 30, 15, 0];
    var MC2LL = [[1.410526172116255e-8, 0.00000898305509648872, -1.9939833816331, 200.9824383106796, -187.2403703815547, 91.6087516669843, -23.38765649603339, 2.57121317296198, -0.03801003308653, 17337981.2], [-7.435856389565537e-9, 0.000008983055097726239, -0.78625201886289, 96.32687599759846, -1.85204757529826, -59.36935905485877, 47.40033549296737, -16.50741931063887, 2.28786674699375, 10260144.86], [-3.030883460898826e-8, 0.00000898305509983578, 0.30071316287616, 59.74293618442277, 7.357984074871, -25.38371002664745, 13.45380521110908, -3.29883767235584, 0.32710905363475, 6856817.37], [-1.981981304930552e-8, 0.000008983055099779535, 0.03278182852591, 40.31678527705744, 0.65659298677277, -4.44255534477492, 0.85341911805263, 0.12923347998204, -0.04625736007561, 4482777.06], [3.09191371068437e-9, 0.000008983055096812155, 0.00006995724062, 23.10934304144901, -0.00023663490511, -0.6321817810242, -0.00663494467273, 0.03430082397953, -0.00466043876332, 2555164.4], [2.890871144776878e-9, 0.000008983055095805407, -3.068298e-8, 7.47137025468032, -0.00000353937994, -0.02145144861037, -0.00001234426596, 0.00010322952773, -0.00000323890364, 826088.5]];
    var LL2MC = [[-0.0015702102444, 111320.7020616939, 1704480524535203, -10338987376042340, 26112667856603880, -35149669176653700, 26595700718403920, -10725012454188240, 1800819912950474, 82.5], [0.0008277824516172526, 111320.7020463578, 647795574.6671607, -4082003173.641316, 10774905663.51142, -15171875531.51559, 12053065338.62167, -5124939663.577472, 913311935.9512032, 67.5], [0.00337398766765, 111320.7020202162, 4481351.045890365, -23393751.19931662, 79682215.47186455, -115964993.2797253, 97236711.15602145, -43661946.33752821, 8477230.501135234, 52.5], [0.00220636496208, 111320.7020209128, 51751.86112841131, 3796837.749470245, 992013.7397791013, -1221952.21711287, 1340652.697009075, -620943.6990984312, 144416.9293806241, 37.5], [-0.0003441963504368392, 111320.7020576856, 278.2353980772752, 2485758.690035394, 6070.750963243378, 54821.18345352118, 9540.606633304236, -2710.55326746645, 1405.483844121726, 22.5], [-0.0003218135878613132, 111320.7020701615, 0.00369383431289, 823725.6402795718, 0.46104986909093, 2351.343141331292, 1.58060784298199, 8.77738589078284, 0.37238884252424, 7.45]];
    function transform$1(x, y, factors) {
      var cc = abs(y) / factors[9];
      var xt = factors[0] + factors[1] * abs(x);
      var yt = factors[2] + factors[3] * cc + factors[4] * Math.pow(cc, 2) + factors[5] * Math.pow(cc, 3) + factors[6] * Math.pow(cc, 4) + factors[7] * Math.pow(cc, 5) + factors[8] * Math.pow(cc, 6);
      xt *= x < 0 ? -1 : 1;
      yt *= y < 0 ? -1 : 1;
      return [xt, yt];
    }
    function BD09toBD09MC(coord) {
      var [lng, lat] = coord;
      var factors = [];
      for (var i = 0; i < LLBAND.length; i++) {
        if (abs(lat) > LLBAND[i]) {
          factors = LL2MC[i];
          break;
        }
      }
      return transform$1(lng, lat, factors);
    }
    function BD09MCtoBD09(coord) {
      var [x, y] = coord;
      var factors = [];
      for (var i = 0; i < MCBAND.length; i++) {
        if (abs(y) >= MCBAND[i]) {
          factors = MC2LL[i];
          break;
        }
      }
      return transform$1(x, y, factors);
    }
    function assert(condition, msg) {
      if (!condition) throw new Error(msg);
    }
    function isArray(input) {
      return !!input && Object.prototype.toString.call(input) === '[object Array]';
    }
    function isNumber(input) {
      return !isNaN(Number(input)) && input !== null && !isArray(input);
    }
    function compose(...funcs) {
      var start = funcs.length - 1;
      return function (...args) {
        var i = start;
        var result = funcs[start].apply(null, args);
        while (i--) result = funcs[i].call(null, result);
        return result;
      };
    }
    function coordEach(geojson, callback, excludeWrapCoord = false) {
      if (geojson === null) return;
      var j;
      var k;
      var l;
      var geometry;
      var coords;
      var stopG;
      var wrapShrink = 0;
      var coordIndex = 0;
      var geometryMaybeCollection;
      var isGeometryCollection;
      var {
        type: type
      } = geojson;
      var isFeatureCollection = type === 'FeatureCollection';
      var isFeature = type === 'Feature';
      var stop = isFeatureCollection ? geojson.features.length : 1;
      for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
        geometryMaybeCollection = isFeatureCollection ? geojson.features[featureIndex].geometry : isFeature ? geojson.geometry : geojson;
        isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === 'GeometryCollection' : false;
        stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
        for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
          var multiFeatureIndex = 0;
          var geometryIndex = 0;
          geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
          if (geometry === null) continue;
          var geomType = geometry.type;
          wrapShrink = excludeWrapCoord && (geomType === 'Polygon' || geomType === 'MultiPolygon') ? 1 : 0;
          switch (geomType) {
            case null:
              break;
            case 'Point':
              coords = geometry.coordinates;
              if (callback(coords, coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
              coordIndex++;
              multiFeatureIndex++;
              break;
            case 'LineString':
            case 'MultiPoint':
              coords = geometry.coordinates;
              for (j = 0; j < coords.length; j++) {
                if (callback(coords[j], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                coordIndex++;
                if (geomType === 'MultiPoint') multiFeatureIndex++;
              }
              if (geomType === 'LineString') multiFeatureIndex++;
              break;
            case 'Polygon':
            case 'MultiLineString':
              coords = geometry.coordinates;
              for (j = 0; j < coords.length; j++) {
                for (k = 0; k < coords[j].length - wrapShrink; k++) {
                  if (callback(coords[j][k], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                  coordIndex++;
                }
                if (geomType === 'MultiLineString') multiFeatureIndex++;
                if (geomType === 'Polygon') geometryIndex++;
              }
              if (geomType === 'Polygon') multiFeatureIndex++;
              break;
            case 'MultiPolygon':
              coords = geometry.coordinates;
              for (j = 0; j < coords.length; j++) {
                geometryIndex = 0;
                for (k = 0; k < coords[j].length; k++) {
                  for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                    if (callback(coords[j][k][l], coordIndex, featureIndex, multiFeatureIndex, geometryIndex) === false) return false;
                    coordIndex++;
                  }
                  geometryIndex++;
                }
                multiFeatureIndex++;
              }
              break;
            case 'GeometryCollection':
              for (j = 0; j < geometry.geometries.length; j++) {
                if (coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false) return false;
              }
              break;
            default:
              throw new Error('Unknown Geometry Type');
          }
        }
      }
    }
    var CRSTypes;
    (function (CRSTypes) {
      CRSTypes["WGS84"] = "WGS84";
      CRSTypes["WGS1984"] = "WGS84";
      CRSTypes["EPSG4326"] = "WGS84";
      CRSTypes["GCJ02"] = "GCJ02";
      CRSTypes["AMap"] = "GCJ02";
      CRSTypes["BD09"] = "BD09";
      CRSTypes["BD09LL"] = "BD09";
      CRSTypes["Baidu"] = "BD09";
      CRSTypes["BMap"] = "BD09";
      CRSTypes["BD09MC"] = "BD09MC";
      CRSTypes["BD09Meter"] = "BD09MC";
      CRSTypes["EPSG3857"] = "EPSG3857";
      CRSTypes["EPSG900913"] = "EPSG3857";
      CRSTypes["EPSG102100"] = "EPSG3857";
      CRSTypes["WebMercator"] = "EPSG3857";
      CRSTypes["WM"] = "EPSG3857";
    })(CRSTypes || (CRSTypes = {}));
    var WGS84 = {
      to: (_to = {}, _to[CRSTypes.GCJ02] = WGS84ToGCJ02, _to[CRSTypes.BD09] = compose(GCJ02ToBD09, WGS84ToGCJ02), _to[CRSTypes.BD09MC] = compose(BD09toBD09MC, GCJ02ToBD09, WGS84ToGCJ02), _to[CRSTypes.EPSG3857] = WGS84ToEPSG3857, _to)
    };
    var GCJ02 = {
      to: (_to2 = {}, _to2[CRSTypes.WGS84] = GCJ02ToWGS84, _to2[CRSTypes.BD09] = GCJ02ToBD09, _to2[CRSTypes.BD09MC] = compose(BD09toBD09MC, GCJ02ToBD09), _to2[CRSTypes.EPSG3857] = compose(WGS84ToEPSG3857, GCJ02ToWGS84), _to2)
    };
    var BD09 = {
      to: (_to3 = {}, _to3[CRSTypes.WGS84] = compose(GCJ02ToWGS84, BD09ToGCJ02), _to3[CRSTypes.GCJ02] = BD09ToGCJ02, _to3[CRSTypes.EPSG3857] = compose(WGS84ToEPSG3857, GCJ02ToWGS84, BD09ToGCJ02), _to3[CRSTypes.BD09MC] = BD09toBD09MC, _to3)
    };
    var EPSG3857 = {
      to: (_to4 = {}, _to4[CRSTypes.WGS84] = EPSG3857ToWGS84, _to4[CRSTypes.GCJ02] = compose(WGS84ToGCJ02, EPSG3857ToWGS84), _to4[CRSTypes.BD09] = compose(GCJ02ToBD09, WGS84ToGCJ02, EPSG3857ToWGS84), _to4[CRSTypes.BD09MC] = compose(BD09toBD09MC, GCJ02ToBD09, WGS84ToGCJ02, EPSG3857ToWGS84), _to4)
    };
    var BD09MC = {
      to: (_to5 = {}, _to5[CRSTypes.WGS84] = compose(GCJ02ToWGS84, BD09ToGCJ02, BD09MCtoBD09), _to5[CRSTypes.GCJ02] = compose(BD09ToGCJ02, BD09MCtoBD09), _to5[CRSTypes.EPSG3857] = compose(WGS84ToEPSG3857, GCJ02ToWGS84, BD09ToGCJ02, BD09MCtoBD09), _to5[CRSTypes.BD09] = BD09MCtoBD09, _to5)
    };
    var crsMap = {
      WGS84: WGS84,
      GCJ02: GCJ02,
      BD09: BD09,
      EPSG3857: EPSG3857,
      BD09MC: BD09MC
    };
    var crsMap$1 = crsMap;
    function transform(input, crsFrom, crsTo) {
      assert(!!input, 'The args[0] input coordinate is required');
      assert(!!crsFrom, 'The args[1] original coordinate system is required');
      assert(!!crsTo, 'The args[2] target coordinate system is required');
      if (crsFrom === crsTo) return input;
      var from = crsMap$1[crsFrom];
      assert(!!from, "Invalid original coordinate system: " + crsFrom);
      var to = from.to[crsTo];
      assert(!!to, "Invalid target coordinate system: " + crsTo);
      var type = typeof input;
      assert(type === 'string' || type === 'object', "Invalid input coordinate type: " + type);
      if (type === 'string') {
        try {
          input = JSON.parse(input);
        } catch (e) {
          throw new Error("Invalid input coordinate: " + input);
        }
      }
      var isPosition = false;
      if (isArray(input)) {
        assert(input.length >= 2, "Invalid input coordinate: " + input);
        assert(isNumber(input[0]) && isNumber(input[1]), "Invalid input coordinate: " + input);
        input = input.map(Number);
        isPosition = true;
      }
      var convert = to;
      if (isPosition) return convert(input);
      coordEach(input, function (coord) {
        [coord[0], coord[1]] = convert(coord);
      });
      return input;
    }
    var exported = Object.assign(Object.assign({}, CRSTypes), {
      CRSTypes: CRSTypes,
      transform: transform
    });

    var FirstRes = 1.40625,
      mFirstRes = 156543.03392804097;
    var TILESIZE = 256;
    var ORIGIN = [-180, 90];
    var MORIGIN = [-20037508.342787, 20037508.342787];
    var merc = new SphericalMercator({
      size: TILESIZE
    });
    function get4326Res(zoom) {
      return FirstRes / Math.pow(2, zoom);
    }
    function get3857Res(zoom) {
      return mFirstRes / Math.pow(2, zoom);
    }
    function tile4326BBOX(x, y, z) {
      var [orginX, orginY] = ORIGIN;
      var res = get4326Res(z) * TILESIZE;
      var mincol = x;
      var minrow = y;
      mincol = Math.floor(mincol);
      minrow = Math.floor(minrow);
      var xmin = orginX + mincol * res;
      var xmax = orginX + (mincol + 1) * res;
      var ymin = -orginY + minrow * res;
      var ymax = -orginY + (minrow + 1) * res;
      return [xmin, ymin, xmax, ymax];
    }
    function offsetTileBBOX(bbox, projection, isGCJ02) {
      if (!isGCJ02) {
        return;
      }
      var points = bboxToPoints(bbox);
      var newPoints = points.map(function (p) {
        if (projection === 'EPSG:3857') {
          var c = exported.transform(p, exported.WebMercator, exported.WGS84);
          return c;
        } else {
          return p;
        }
      });
      var transformPoints = newPoints.map(function (p) {
        return exported.transform(p, exported.WGS84, exported.AMap);
      });
      var minx = Infinity,
        miny = Infinity,
        maxx = -Infinity,
        maxy = -Infinity;
      transformPoints.forEach(function (p) {
        var [x, y] = p;
        minx = Math.min(minx, x);
        miny = Math.min(miny, y);
        maxx = Math.max(maxx, x);
        maxy = Math.max(maxy, y);
      });
      if (projection === 'EPSG:4326') {
        bbox[0] = minx;
        bbox[1] = miny;
        bbox[2] = maxx;
        bbox[3] = maxy;
      } else {
        var _points = bboxToPoints([minx, miny, maxx, maxx]).map(function (p) {
          return lnglat2Mercator(p);
        });
        var x1 = Infinity,
          y1 = Infinity,
          x2 = -Infinity,
          y2 = -Infinity;
        _points.forEach(function (p) {
          var [x, y] = p;
          x1 = Math.min(x1, x);
          y1 = Math.min(y1, y);
          x2 = Math.max(x2, x);
          y2 = Math.max(y2, y);
        });
        bbox[0] = x1;
        bbox[1] = y1;
        bbox[2] = x2;
        bbox[3] = y2;
      }
    }
    function cal4326Tiles(x, y, z, zoomOffset = 0, isGCJ02) {
      zoomOffset = zoomOffset || 0;
      var [orginX, orginY] = ORIGIN;
      var res = get4326Res(z) * TILESIZE;
      var tileBBOX = merc.bbox(x, y, z);
      offsetTileBBOX(tileBBOX, 'EPSG:4326', isGCJ02);
      var [minx, miny, maxx, maxy] = tileBBOX;
      var mincol = (minx - orginX) / res,
        maxcol = (maxx - orginX) / res;
      var minrow = (orginY - maxy) / res,
        maxrow = (orginY - miny) / res;
      mincol = Math.floor(mincol);
      maxcol = Math.floor(maxcol);
      minrow = Math.floor(minrow);
      maxrow = Math.floor(maxrow);
      if (maxcol < mincol || maxrow < minrow) {
        return;
      }
      var tiles = [];
      for (var row = minrow; row <= maxrow; row++) {
        for (var col = mincol; col <= maxcol; col++) {
          tiles.push([col - 1, row, z + zoomOffset]);
        }
      }
      var xmin = orginX + (mincol - 1) * res;
      var xmax = orginX + maxcol * res;
      var ymin = orginY - (maxrow + 1) * res;
      var ymax = orginY - minrow * res;
      var coordinates = bboxToPoints(tileBBOX).map(function (c) {
        return lnglat2Mercator(c);
      });
      return {
        tiles: tiles,
        tilesbbox: [xmin, ymin, xmax, ymax],
        bbox: tileBBOX,
        mbbox: pointsToBBOX(coordinates),
        x: x,
        y: y,
        z: z
      };
    }
    function cal3857Tiles(x, y, z, zoomOffset = 0, isGCJ02) {
      zoomOffset = zoomOffset || 0;
      var [orginX, orginY] = MORIGIN;
      var res = get3857Res(z) * TILESIZE;
      var tileBBOX = tile4326BBOX(x, y, z);
      offsetTileBBOX(tileBBOX, 'EPSG:4326', isGCJ02);
      var mbbox = pointsToBBOX(bboxToPoints(tileBBOX).map(function (c) {
        var result = merc.forward(c);
        return result;
      }));
      var [minx, miny, maxx, maxy] = mbbox;
      var mincol = (minx - orginX) / res,
        maxcol = (maxx - orginX) / res;
      var minrow = (orginY - maxy) / res,
        maxrow = (orginY - miny) / res;
      mincol = Math.floor(mincol);
      maxcol = Math.floor(maxcol);
      minrow = Math.floor(minrow);
      maxrow = Math.floor(maxrow);
      if (maxcol < mincol || maxrow < minrow) {
        return;
      }
      var tiles = [];
      for (var row = minrow; row <= maxrow; row++) {
        for (var col = mincol; col <= maxcol; col++) {
          tiles.push([col, row, z + zoomOffset]);
        }
      }
      var bboxList = tiles.map(function (tile) {
        var [x, y, z] = tile;
        return merc.bbox(x, y, z, false, '900913');
      });
      var [xmin, ymin, xmax, ymax] = bboxOfBBOXList(bboxList);
      return {
        tiles: tiles,
        tilesbbox: [xmin, ymin, xmax, ymax],
        bbox: tileBBOX,
        mbbox: mbbox,
        x: x,
        y: y,
        z: z
      };
    }
    function tilesImageData(image, tilesbbox, tilebbox, projection) {
      var {
        width: width,
        height: height
      } = image;
      var [minx, miny, maxx, maxy] = tilesbbox;
      var ax = (maxx - minx) / width,
        ay = (maxy - miny) / height;
      var [tminx, tminy, tmaxx, tmaxy] = tilebbox;
      tminx -= ax;
      tmaxx += ax;
      tminy -= ay;
      tmaxy += ay;
      var x1 = (tminx - minx) / ax;
      var y1 = (maxy - tmaxy) / ay;
      var x2 = (tmaxx - minx) / ax;
      var y2 = (maxy - tminy) / ay;
      x1 = Math.floor(x1);
      y1 = Math.floor(y1);
      x2 = Math.ceil(x2);
      y2 = Math.ceil(y2);
      var w = x2 - x1,
        h = y2 - y1;
      var tileCanvas = getCanvas$1();
      resizeCanvas(tileCanvas, w, h);
      var ctx = getCanvasContext(tileCanvas);
      ctx.drawImage(image, x1, y1, w, h, 0, 0, w, h);
      disposeImage(image);
      var imageData = ctx.getImageData(0, 0, w, h).data;
      var pixels = [];
      var xmin = Infinity,
        ymin = Infinity,
        xmax = -Infinity,
        ymax = -Infinity;
      var index = -1;
      var method = projection === 'EPSG:4326' ? merc.forward : merc.inverse;
      for (var row = 1; row <= h; row++) {
        var y = tmaxy - (row - 1) * ay;
        var _y = y - ay;
        for (var col = 1; col <= w; col++) {
          var idx = (row - 1) * w * 4 + (col - 1) * 4;
          var r = imageData[idx],
            g = imageData[idx + 1],
            b = imageData[idx + 2],
            a = imageData[idx + 3];
          var x = tminx + (col - 1) * ax;
          var coordinates = [x, y];
          var point = method(coordinates);
          xmin = Math.min(xmin, point[0]);
          xmax = Math.max(xmax, point[0]);
          ymin = Math.min(ymin, point[1]);
          ymax = Math.max(ymax, point[1]);
          var coordinates1 = [x, _y];
          pixels[++index] = {
            point: point,
            point1: method(coordinates1),
            r: r,
            g: g,
            b: b,
            a: a
          };
        }
      }
      return {
        pixels: pixels,
        bbox: [xmin, ymin, xmax, ymax],
        width: w,
        height: h,
        image: tileCanvas.transferToImageBitmap()
      };
    }
    function transformTiles(pixelsresult, mbbox, debug) {
      var [xmin, ymin, xmax, ymax] = mbbox;
      var ax = (xmax - xmin) / TILESIZE,
        ay = (ymax - ymin) / TILESIZE;
      var {
        pixels: pixels,
        bbox: bbox
      } = pixelsresult;
      var [minx, miny, maxx, maxy] = bbox;
      var width = (maxx - minx) / ax,
        height = (maxy - miny) / ay;
      width = Math.round(width);
      height = Math.round(height);
      if (isNaN(width) || isNaN(height) || Math.min(width, height) === 0 || Math.abs(width) === Infinity || Math.abs(height) === Infinity) {
        return;
      }
      var canvas = getCanvas$1();
      resizeCanvas(canvas, width, height);
      var ctx = getCanvasContext(canvas);
      function transformPixel(x, y) {
        var col = Math.round((x - minx) / ax + 1);
        col = Math.min(col, width);
        var row = Math.round((maxy - y) / ay + 1);
        row = Math.min(row, height);
        return [col, row];
      }
      var imageData = ctx.createImageData(width, height);
      var data = imageData.data;
      for (var i = 0, len = pixels.length; i < len; i++) {
        var {
          point: point,
          point1: point1,
          r: r,
          g: g,
          b: b,
          a: a
        } = pixels[i];
        var [x1, y1] = point;
        var [x2, y2] = point1;
        var [col1, row1] = transformPixel(x1, y1);
        var [col2, row2] = transformPixel(x2, y2);
        for (var j = row1; j <= row2; j++) {
          var idx = (j - 1) * width * 4 + (col1 - 1) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
          data[idx + 3] = a;
        }
      }
      ctx.putImageData(imageData, 0, 0);
      var image = canvas.transferToImageBitmap();
      var px = Math.round((xmin - minx) / ax);
      var py = Math.round((maxy - ymax) / ay);
      var canvas1 = getCanvas$1();
      resizeCanvas(canvas1, TILESIZE, TILESIZE);
      var ctx1 = getCanvasContext(canvas);
      ctx1.drawImage(image, px - 1, py, TILESIZE, TILESIZE, 0, 0, TILESIZE, TILESIZE);
      checkBoundaryBlank(ctx1);
      if (debug) {
        ctx1.lineWidth = 0.4;
        ctx1.strokeStyle = 'red';
        ctx1.rect(0, 0, TILESIZE, TILESIZE);
        ctx1.stroke();
      }
      return canvas1.transferToImageBitmap();
    }
    function checkBoundaryBlank(ctx) {
      var canvas = ctx.canvas;
      var {
        width: width,
        height: height
      } = canvas;
      var imageData = ctx.getImageData(0, 0, width, height);
      var data = imageData.data;
      var leftIsBlank = function leftIsBlank() {
        for (var row = 1; row <= height; row++) {
          var idx = width * 4 * (row - 1) + 0;
          var a = data[idx + 3];
          if (a > 0) {
            return false;
          }
        }
        return true;
      };
      var colIsBlank = function colIsBlank(col) {
        for (var row = 1; row <= height; row++) {
          var idx = width * 4 * (row - 1) + (col - 1) * 4;
          var a = data[idx + 3];
          if (a > 0) {
            return false;
          }
        }
        return true;
      };
      var bottomIsBlank = function bottomIsBlank() {
        for (var col = 1; col <= width; col++) {
          var idx = (col - 1) * 4 + (height - 1) * width * 4;
          var a = data[idx + 3];
          if (a > 0) {
            return false;
          }
        }
        return true;
      };
      if (leftIsBlank()) {
        for (var row = 1; row <= height; row++) {
          var idx1 = width * 4 * (row - 1) + 0;
          var idx2 = idx1 + 4;
          var r = data[idx2];
          var g = data[idx2 + 1];
          var b = data[idx2 + 2];
          var a = data[idx2 + 3];
          data[idx1] = r;
          data[idx1 + 1] = g;
          data[idx1 + 2] = b;
          data[idx1 + 3] = a;
        }
      }
      if (bottomIsBlank()) {
        for (var col = 1; col <= width; col++) {
          var _idx = (col - 1) * 4 + (height - 1) * width * 4;
          var _idx2 = (col - 1) * 4 + (height - 2) * width * 4;
          var _r = data[_idx2];
          var _g = data[_idx2 + 1];
          var _b = data[_idx2 + 2];
          var _a = data[_idx2 + 3];
          data[_idx] = _r;
          data[_idx + 1] = _g;
          data[_idx + 2] = _b;
          data[_idx + 3] = _a;
        }
      }
      var colBlanks = [];
      for (var _col = 1, len = width; _col <= len; _col++) {
        colBlanks.push(colIsBlank(_col));
      }
      var hasColBlank = colBlanks.indexOf(true) > -1;
      if (hasColBlank) {
        var fixCol = function fixCol(col1, col2) {
          for (var _row = 1; _row <= height; _row++) {
            var _idx3 = width * 4 * (_row - 1) + (col1 - 1) * 4;
            var _idx4 = width * 4 * (_row - 1) + (col2 - 1) * 4;
            var _r2 = data[_idx4];
            var _g2 = data[_idx4 + 1];
            var _b2 = data[_idx4 + 2];
            var _a2 = data[_idx4 + 3];
            data[_idx3] = _r2;
            data[_idx3 + 1] = _g2;
            data[_idx3 + 2] = _b2;
            data[_idx3 + 3] = _a2;
          }
        };
        for (var _col2 = 1; _col2 <= width; _col2++) {
          var current = colBlanks[_col2 - 1];
          if (!current) {
            continue;
          }
          var next = colBlanks[_col2];
          var pre = colBlanks[_col2 - 1];
          if (!next) {
            fixCol(_col2, _col2 + 1);
          } else if (!pre) {
            fixCol(_col2, _col2 - 1);
          }
        }
      }
      ctx.putImageData(imageData, 0, 0);
    }
    function tileTransform(options) {
      return new Promise(function (resolve, reject) {
        var {
          x: x,
          y: y,
          z: z,
          projection: projection,
          zoomOffset: zoomOffset,
          errorLog: errorLog,
          debug: debug,
          returnBlobURL: returnBlobURL,
          isGCJ02: isGCJ02
        } = options;
        var returnImage = function returnImage(opImage) {
          createImageBlobURL(opImage, returnBlobURL).then(function (url) {
            resolve(url);
          })["catch"](function (error) {
            reject(error);
          });
        };
        var loadTiles = function loadTiles() {
          var result;
          if (projection === 'EPSG:4326') {
            result = cal4326Tiles(x, y, z, zoomOffset || 0, isGCJ02);
          } else if (projection === 'EPSG:3857') {
            result = cal3857Tiles(x, y, z, zoomOffset || 0, isGCJ02);
          }
          var {
            tiles: tiles
          } = result || {};
          if (!tiles || tiles.length === 0) {
            returnImage(getBlankTile());
            return;
          }
          result.loadCount = 0;
          var _loadTile = function loadTile() {
            if (result.loadCount >= tiles.length) {
              var image = layoutTiles(tiles, debug);
              var image1;
              if (projection === 'EPSG:4326') {
                var imageData = tilesImageData(image, result.tilesbbox, result.bbox, projection);
                image1 = transformTiles(imageData, result.mbbox, debug);
                returnImage(image1 || getBlankTile());
              } else {
                var _imageData = tilesImageData(image, result.tilesbbox, result.mbbox, projection);
                image1 = transformTiles(_imageData, result.bbox, debug);
                returnImage(image1 || getBlankTile());
              }
            } else {
              var tile = tiles[result.loadCount];
              var [_x, _y2, _z] = tile;
              getTileWithMaxZoom(Object.assign({}, options, {
                x: _x,
                y: _y2,
                z: _z,
                returnBlobURL: false
              })).then(function (image) {
                tile.tileImage = image;
                result.loadCount++;
                _loadTile();
              })["catch"](function (error) {
                if (errorLog) {
                  console.error(error);
                }
                tile.tileImage = getBlankTile();
                result.loadCount++;
                _loadTile();
              });
            }
          };
          _loadTile();
        };
        loadTiles();
      });
    }

    var initialize = function initialize() {};
    var onmessage = function onmessage(message, postResponse) {
      var data = message.data || {};
      var type = data._type;
      if (type === 'getTile') {
        var {
          url: url
        } = data;
        getTile(url, data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'layoutTiles') {
        layout_Tiles(data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'getTileWithMaxZoom') {
        getTileWithMaxZoom(data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'clipTile') {
        clip(data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'transformTile') {
        tileTransform(data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'injectMask') {
        var geojson = injectMask(data.maskId, data.geojsonFeature);
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
        var taskId = data.taskId || data.__taskId;
        if (!taskId) {
          postResponse(createInnerError('cancelFetch need taskId'));
          return;
        }
        cancelFetch(taskId);
        postResponse();
        return;
      }
      if (type === 'imageSlicing') {
        imageSlicing(data).then(function (result) {
          var buffers = [];
          var items = result.items || [];
          items.forEach(function (item) {
            if (isImageBitmap(item.image)) {
              buffers.push(item.image);
            }
          });
          postResponse(null, result, buffers);
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'imageToBlobURL') {
        imageToBlobURL(data).then(function (result) {
          postResponse(null, result, []);
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'encodeTerrainTile') {
        var {
          url: _url
        } = data;
        encodeTerrainTile(_url, data).then(function (image) {
          postResponse(null, image, checkBuffers(image));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      if (type === 'colorTerrainTile') {
        var {
          tile: tile,
          colors: colors,
          returnBlobURL: returnBlobURL
        } = data;
        var image = colorsTerrainTile(colors, tile);
        var postImage = postProcessingImage(image, data);
        createImageBlobURL(postImage, returnBlobURL).then(function (url) {
          postResponse(null, url, checkBuffers(url));
        })["catch"](function (error) {
          postResponse(error);
        });
        return;
      }
      var errorMessage = 'not support message type:' + type;
      console.error(errorMessage);
      postResponse(createInnerError(errorMessage));
    };

    exports.initialize = initialize;
    exports.onmessage = onmessage;

    Object.defineProperty(exports, '__esModule', { value: true });

})`
