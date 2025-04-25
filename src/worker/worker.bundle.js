export default ` (function (exports) { 'use strict';

    function isNumber(value) {
        return typeof value === 'number';
    }
    function createError(message) {
        return new Error(message);
    }
    function checkTileUrl(url) {
        if (Array.isArray(url)) {
            return url;
        }
        return [url];
    }
    function lnglat2Mercator(coordinates) {
        const [lng, lat] = coordinates;
        const earthRad = 6378137.0;
        const x = lng * Math.PI / 180 * earthRad;
        const a = lat * Math.PI / 180;
        const y = earthRad / 2 * Math.log((1.0 + Math.sin(a)) / (1.0 - Math.sin(a)));
        return [x, y];
    }
    const FetchCancelError = createError('fetch tile data cancel');
    const FetchTimeoutError = createError('fetch tile data timeout');
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
    const HEADERS = {
        'accept': 'image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36 Edg/107.0.1418.26'
    };
    let globalId = 0;
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
        images.forEach(image => {
            if (image && image.close) {
                image.close();
            }
        });
    }
    function encodeMapBox(height, out) {
        const value = Math.floor((height + 10000) * 10);
        const r = value >> 16;
        const g = value >> 8 & 0x0000FF;
        const b = value & 0x0000FF;
        if (out) {
            out[0] = r;
            out[1] = g;
            out[2] = b;
            return out;
        }
        else {
            return [r, g, b];
        }
    }
    function transformMapZen(imageData) {
        const data = imageData.data;
        const out = [0, 0, 0];
        for (let i = 0, len = data.length; i < len; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            const a = data[i + 3];
            if (a === 0) {
                continue;
            }
            const height = (r * 256 + g + b / 256) - 32768;
            const [r1, g1, b1] = encodeMapBox(height, out);
            data[i] = r1;
            data[i + 1] = g1;
            data[i + 2] = b1;
        }
        return imageData;
    }

    // Calculate Gaussian blur of an image using IIR filter
    // The method is taken from Intel's white paper and code example attached to it:
    // https://software.intel.com/en-us/articles/iir-gaussian-blur-filter
    // -implementation-using-intel-advanced-vector-extensions

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

      // Attempt to force type to FP32.
      return new Float32Array([ a0, a1, a2, a3, b1, b2, left_corner, right_corner ]);
    }

    function convolveRGBA(src, out, line, coeff, width, height) {
      // takes src image and writes the blurred and transposed result into out

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

        // left to right
        rgba = src[src_index];

        prev_src_r = rgba & 0xff;
        prev_src_g = (rgba >> 8) & 0xff;
        prev_src_b = (rgba >> 16) & 0xff;
        prev_src_a = (rgba >> 24) & 0xff;

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
          curr_src_g = (rgba >> 8) & 0xff;
          curr_src_b = (rgba >> 16) & 0xff;
          curr_src_a = (rgba >> 24) & 0xff;

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

        // right to left
        rgba = src[src_index];

        prev_src_r = rgba & 0xff;
        prev_src_g = (rgba >> 8) & 0xff;
        prev_src_b = (rgba >> 16) & 0xff;
        prev_src_a = (rgba >> 24) & 0xff;

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
          curr_src_g = (rgba >> 8) & 0xff;
          curr_src_b = (rgba >> 16) & 0xff;
          curr_src_a = (rgba >> 24) & 0xff;

          rgba = ((line[line_index] + prev_out_r) << 0) +
            ((line[line_index + 1] + prev_out_g) << 8) +
            ((line[line_index + 2] + prev_out_b) << 16) +
            ((line[line_index + 3] + prev_out_a) << 24);

          out[out_index] = rgba;

          src_index--;
          line_index -= 4;
          out_index -= height;
        }
      }
    }


    function blurRGBA(src, width, height, radius) {
      // Quick exit on zero radius
      if (!radius) { return; }

      // Unify input data type, to keep convolver calls isomorphic
      var src32 = new Uint32Array(src.buffer);

      var out      = new Uint32Array(src32.length),
          tmp_line = new Float32Array(Math.max(width, height) * 4);

      var coeff = gaussCoef(radius);

      convolveRGBA(src32, out, tmp_line, coeff, width, height);
      convolveRGBA(out, src32, tmp_line, coeff, height, width);
    }

    var glur = blurRGBA;

    let globalCanvas;
    function getCanvas(tileSize = 256) {
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
        const canvas = ctx.canvas;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    function getCanvasContext(canvas) {
        const ctx = canvas.getContext('2d', {
            willReadFrequently: true
        });
        clearCanvas(ctx);
        return ctx;
    }
    function getBlankTile(tileSize) {
        const canvas = getCanvas(tileSize);
        getCanvasContext(canvas);
        return canvas.transferToImageBitmap();
    }
    function mergeImages(images, globalCompositeOperation) {
        if (images.length === 1) {
            return images[0];
        }
        if (images.length === 0) {
            return createError('merge tiles error,not find imagebitmaps');
        }
        for (let i = 0, len = images.length; i < len; i++) {
            const image = images[i];
            if (!isImageBitmap(image)) {
                return createError('merge tiles error,images not imagebitmap');
            }
        }
        const tileSize = images[0].width;
        const canvas = getCanvas(tileSize);
        const ctx = getCanvasContext(canvas);
        if (globalCompositeOperation) {
            ctx.save();
            ctx.globalCompositeOperation = globalCompositeOperation;
        }
        images.forEach(image => {
            ctx.drawImage(image, 0, 0, tileSize, tileSize);
        });
        if (globalCompositeOperation) {
            ctx.restore();
        }
        disposeImage(images);
        return canvas.transferToImageBitmap();
    }
    function imageClip(canvas, polygons, image, reverse) {
        const ctx = getCanvasContext(canvas);
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
        if (reverse) {
            ctx.rect(0, 0, canvas.width, canvas.height);
        }
        polygons.forEach(polygon => {
            drawPolygon(polygon);
        });
        ctx.clip('evenodd');
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        const bitImage = canvas.transferToImageBitmap();
        ctx.restore();
        disposeImage(image);
        return bitImage;
    }
    function toBlobURL(imagebitmap) {
        const canvas = getCanvas();
        resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
        const ctx = getCanvasContext(canvas);
        ctx.drawImage(imagebitmap, 0, 0);
        disposeImage(imagebitmap);
        return canvas.convertToBlob();
    }
    function imageFilter(canvas, imagebitmap, filter) {
        if (!filter) {
            return imagebitmap;
        }
        resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
        const ctx = getCanvasContext(canvas);
        ctx.save();
        ctx.filter = filter;
        ctx.drawImage(imagebitmap, 0, 0);
        ctx.restore();
        const bitImage = canvas.transferToImageBitmap();
        disposeImage(imagebitmap);
        return bitImage;
    }
    function imageGaussianBlur(canvas, imagebitmap, radius) {
        if (!isNumber(radius) || radius <= 0) {
            return imagebitmap;
        }
        resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
        const ctx = getCanvasContext(canvas);
        ctx.drawImage(imagebitmap, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        glur(imageData.data, canvas.width, canvas.height, radius);
        ctx.putImageData(imageData, 0, 0);
        const bitImage = canvas.transferToImageBitmap();
        disposeImage(imagebitmap);
        return bitImage;
    }
    function imageTileScale(canvas, imagebitmap, dx, dy, w, h) {
        resizeCanvas(canvas, imagebitmap.width, imagebitmap.height);
        const ctx = getCanvasContext(canvas);
        ctx.save();
        // console.log(dx,dy,w,h);
        ctx.drawImage(imagebitmap, dx, dy, w, h, 0, 0, canvas.width, canvas.height);
        ctx.restore();
        const bitImage = canvas.transferToImageBitmap();
        disposeImage(imagebitmap);
        return bitImage;
    }
    function imageOpacity(image, opacity = 1) {
        if (!isNumber(opacity) || opacity === 1 || opacity < 0 || opacity > 1) {
            return image;
        }
        const canvas = getCanvas();
        resizeCanvas(canvas, image.width, image.height);
        const ctx = getCanvasContext(canvas);
        ctx.globalAlpha = opacity;
        ctx.drawImage(image, 0, 0);
        const bitImage = canvas.transferToImageBitmap();
        ctx.globalAlpha = 1;
        disposeImage(image);
        return bitImage;
    }
    function mergeTiles(tiles, debug) {
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
        resizeCanvas(canvas, width, height);
        const ctx = getCanvasContext(canvas);
        if (debug) {
            ctx.font = "bold 48px serif";
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = 'red';
        }
        tiles.forEach(tile => {
            const [x, y, z] = tile;
            const dx = (x - minx) * tileSize;
            const dy = (y - miny) * tileSize;
            let tileImage = tile.tileImage;
            ctx.drawImage(tileImage, dx, dy, tileSize, tileSize);
            if (debug) {
                ctx.fillText([x, y, z].join('_').toString(), dx + 100, dy + 100);
            }
        });
        disposeImage(tiles.map(tile => {
            return tile.tileImage;
        }));
        return canvas.transferToImageBitmap();
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

    /** @license zlib.js 2012 - imaya [ https://github.com/imaya/zlib.js ] The MIT License */(function() {function m(d){throw d;}var w=void 0,z=!0,aa=this;function A(d,a){var c=d.split("."),e=aa;!(c[0]in e)&&e.execScript&&e.execScript("var "+c[0]);for(var b;c.length&&(b=c.shift());)!c.length&&a!==w?e[b]=a:e=e[b]?e[b]:e[b]={};}var G="undefined"!==typeof Uint8Array&&"undefined"!==typeof Uint16Array&&"undefined"!==typeof Uint32Array&&"undefined"!==typeof DataView;function I(d,a){this.index="number"===typeof a?a:0;this.i=0;this.buffer=d instanceof(G?Uint8Array:Array)?d:new (G?Uint8Array:Array)(32768);2*this.buffer.length<=this.index&&m(Error("invalid index"));this.buffer.length<=this.index&&this.f();}I.prototype.f=function(){var d=this.buffer,a,c=d.length,e=new (G?Uint8Array:Array)(c<<1);if(G)e.set(d);else for(a=0;a<c;++a)e[a]=d[a];return this.buffer=e};
        I.prototype.d=function(d,a,c){var e=this.buffer,b=this.index,f=this.i,g=e[b],h;c&&1<a&&(d=8<a?(Q[d&255]<<24|Q[d>>>8&255]<<16|Q[d>>>16&255]<<8|Q[d>>>24&255])>>32-a:Q[d]>>8-a);if(8>a+f)g=g<<a|d,f+=a;else for(h=0;h<a;++h)g=g<<1|d>>a-h-1&1,8===++f&&(f=0,e[b++]=Q[g],g=0,b===e.length&&(e=this.f()));e[b]=g;this.buffer=e;this.i=f;this.index=b;};I.prototype.finish=function(){var d=this.buffer,a=this.index,c;0<this.i&&(d[a]<<=8-this.i,d[a]=Q[d[a]],a++);G?c=d.subarray(0,a):(d.length=a,c=d);return c};
        var ba=new (G?Uint8Array:Array)(256),ca;for(ca=0;256>ca;++ca){for(var R=ca,ha=R,ia=7,R=R>>>1;R;R>>>=1)ha<<=1,ha|=R&1,--ia;ba[ca]=(ha<<ia&255)>>>0;}var Q=ba;function ja(d){this.buffer=new (G?Uint16Array:Array)(2*d);this.length=0;}ja.prototype.getParent=function(d){return 2*((d-2)/4|0)};ja.prototype.push=function(d,a){var c,e,b=this.buffer,f;c=this.length;b[this.length++]=a;for(b[this.length++]=d;0<c;)if(e=this.getParent(c),b[c]>b[e])f=b[c],b[c]=b[e],b[e]=f,f=b[c+1],b[c+1]=b[e+1],b[e+1]=f,c=e;else break;return this.length};
        ja.prototype.pop=function(){var d,a,c=this.buffer,e,b,f;a=c[0];d=c[1];this.length-=2;c[0]=c[this.length];c[1]=c[this.length+1];for(f=0;;){b=2*f+2;if(b>=this.length)break;b+2<this.length&&c[b+2]>c[b]&&(b+=2);if(c[b]>c[f])e=c[f],c[f]=c[b],c[b]=e,e=c[f+1],c[f+1]=c[b+1],c[b+1]=e;else break;f=b;}return {index:d,value:a,length:this.length}};function S(d){var a=d.length,c=0,e=Number.POSITIVE_INFINITY,b,f,g,h,k,p,q,r,n,l;for(r=0;r<a;++r)d[r]>c&&(c=d[r]),d[r]<e&&(e=d[r]);b=1<<c;f=new (G?Uint32Array:Array)(b);g=1;h=0;for(k=2;g<=c;){for(r=0;r<a;++r)if(d[r]===g){p=0;q=h;for(n=0;n<g;++n)p=p<<1|q&1,q>>=1;l=g<<16|r;for(n=p;n<b;n+=k)f[n]=l;++h;}++g;h<<=1;k<<=1;}return [f,c,e]}function ka(d,a){this.h=na;this.w=0;this.input=G&&d instanceof Array?new Uint8Array(d):d;this.b=0;a&&(a.lazy&&(this.w=a.lazy),"number"===typeof a.compressionType&&(this.h=a.compressionType),a.outputBuffer&&(this.a=G&&a.outputBuffer instanceof Array?new Uint8Array(a.outputBuffer):a.outputBuffer),"number"===typeof a.outputIndex&&(this.b=a.outputIndex));this.a||(this.a=new (G?Uint8Array:Array)(32768));}var na=2,oa={NONE:0,r:1,k:na,N:3},pa=[],T;
        for(T=0;288>T;T++)switch(z){case 143>=T:pa.push([T+48,8]);break;case 255>=T:pa.push([T-144+400,9]);break;case 279>=T:pa.push([T-256+0,7]);break;case 287>=T:pa.push([T-280+192,8]);break;default:m("invalid literal: "+T);}
        ka.prototype.j=function(){var d,a,c,e,b=this.input;switch(this.h){case 0:c=0;for(e=b.length;c<e;){a=G?b.subarray(c,c+65535):b.slice(c,c+65535);c+=a.length;var f=a,g=c===e,h=w,k=w,p=w,q=w,r=w,n=this.a,l=this.b;if(G){for(n=new Uint8Array(this.a.buffer);n.length<=l+f.length+5;)n=new Uint8Array(n.length<<1);n.set(this.a);}h=g?1:0;n[l++]=h|0;k=f.length;p=~k+65536&65535;n[l++]=k&255;n[l++]=k>>>8&255;n[l++]=p&255;n[l++]=p>>>8&255;if(G)n.set(f,l),l+=f.length,n=n.subarray(0,l);else {q=0;for(r=f.length;q<r;++q)n[l++]=
            f[q];n.length=l;}this.b=l;this.a=n;}break;case 1:var s=new I(G?new Uint8Array(this.a.buffer):this.a,this.b);s.d(1,1,z);s.d(1,2,z);var t=qa(this,b),x,E,B;x=0;for(E=t.length;x<E;x++)if(B=t[x],I.prototype.d.apply(s,pa[B]),256<B)s.d(t[++x],t[++x],z),s.d(t[++x],5),s.d(t[++x],t[++x],z);else if(256===B)break;this.a=s.finish();this.b=this.a.length;break;case na:var C=new I(G?new Uint8Array(this.a.buffer):this.a,this.b),L,v,M,Y,Z,gb=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],da,Fa,ea,Ga,la,sa=Array(19),
            Ha,$,ma,D,Ia;L=na;C.d(1,1,z);C.d(L,2,z);v=qa(this,b);da=ra(this.L,15);Fa=ta(da);ea=ra(this.K,7);Ga=ta(ea);for(M=286;257<M&&0===da[M-1];M--);for(Y=30;1<Y&&0===ea[Y-1];Y--);var Ja=M,Ka=Y,K=new (G?Uint32Array:Array)(Ja+Ka),u,N,y,fa,J=new (G?Uint32Array:Array)(316),H,F,O=new (G?Uint8Array:Array)(19);for(u=N=0;u<Ja;u++)K[N++]=da[u];for(u=0;u<Ka;u++)K[N++]=ea[u];if(!G){u=0;for(fa=O.length;u<fa;++u)O[u]=0;}u=H=0;for(fa=K.length;u<fa;u+=N){for(N=1;u+N<fa&&K[u+N]===K[u];++N);y=N;if(0===K[u])if(3>y)for(;0<y--;)J[H++]=
            0,O[0]++;else for(;0<y;)F=138>y?y:138,F>y-3&&F<y&&(F=y-3),10>=F?(J[H++]=17,J[H++]=F-3,O[17]++):(J[H++]=18,J[H++]=F-11,O[18]++),y-=F;else if(J[H++]=K[u],O[K[u]]++,y--,3>y)for(;0<y--;)J[H++]=K[u],O[K[u]]++;else for(;0<y;)F=6>y?y:6,F>y-3&&F<y&&(F=y-3),J[H++]=16,J[H++]=F-3,O[16]++,y-=F;}d=G?J.subarray(0,H):J.slice(0,H);la=ra(O,7);for(D=0;19>D;D++)sa[D]=la[gb[D]];for(Z=19;4<Z&&0===sa[Z-1];Z--);Ha=ta(la);C.d(M-257,5,z);C.d(Y-1,5,z);C.d(Z-4,4,z);for(D=0;D<Z;D++)C.d(sa[D],3,z);D=0;for(Ia=d.length;D<Ia;D++)if($=
            d[D],C.d(Ha[$],la[$],z),16<=$){D++;switch($){case 16:ma=2;break;case 17:ma=3;break;case 18:ma=7;break;default:m("invalid code: "+$);}C.d(d[D],ma,z);}var La=[Fa,da],Ma=[Ga,ea],P,Na,ga,va,Oa,Pa,Qa,Ra;Oa=La[0];Pa=La[1];Qa=Ma[0];Ra=Ma[1];P=0;for(Na=v.length;P<Na;++P)if(ga=v[P],C.d(Oa[ga],Pa[ga],z),256<ga)C.d(v[++P],v[++P],z),va=v[++P],C.d(Qa[va],Ra[va],z),C.d(v[++P],v[++P],z);else if(256===ga)break;this.a=C.finish();this.b=this.a.length;break;default:m("invalid compression type");}return this.a};
        function ua(d,a){this.length=d;this.G=a;}
        var wa=function(){function d(b){switch(z){case 3===b:return [257,b-3,0];case 4===b:return [258,b-4,0];case 5===b:return [259,b-5,0];case 6===b:return [260,b-6,0];case 7===b:return [261,b-7,0];case 8===b:return [262,b-8,0];case 9===b:return [263,b-9,0];case 10===b:return [264,b-10,0];case 12>=b:return [265,b-11,1];case 14>=b:return [266,b-13,1];case 16>=b:return [267,b-15,1];case 18>=b:return [268,b-17,1];case 22>=b:return [269,b-19,2];case 26>=b:return [270,b-23,2];case 30>=b:return [271,b-27,2];case 34>=b:return [272,
            b-31,2];case 42>=b:return [273,b-35,3];case 50>=b:return [274,b-43,3];case 58>=b:return [275,b-51,3];case 66>=b:return [276,b-59,3];case 82>=b:return [277,b-67,4];case 98>=b:return [278,b-83,4];case 114>=b:return [279,b-99,4];case 130>=b:return [280,b-115,4];case 162>=b:return [281,b-131,5];case 194>=b:return [282,b-163,5];case 226>=b:return [283,b-195,5];case 257>=b:return [284,b-227,5];case 258===b:return [285,b-258,0];default:m("invalid length: "+b);}}var a=[],c,e;for(c=3;258>=c;c++)e=d(c),a[c]=e[2]<<24|e[1]<<
            16|e[0];return a}(),xa=G?new Uint32Array(wa):wa;
        function qa(d,a){function c(b,c){var a=b.G,d=[],e=0,f;f=xa[b.length];d[e++]=f&65535;d[e++]=f>>16&255;d[e++]=f>>24;var g;switch(z){case 1===a:g=[0,a-1,0];break;case 2===a:g=[1,a-2,0];break;case 3===a:g=[2,a-3,0];break;case 4===a:g=[3,a-4,0];break;case 6>=a:g=[4,a-5,1];break;case 8>=a:g=[5,a-7,1];break;case 12>=a:g=[6,a-9,2];break;case 16>=a:g=[7,a-13,2];break;case 24>=a:g=[8,a-17,3];break;case 32>=a:g=[9,a-25,3];break;case 48>=a:g=[10,a-33,4];break;case 64>=a:g=[11,a-49,4];break;case 96>=a:g=[12,a-
        65,5];break;case 128>=a:g=[13,a-97,5];break;case 192>=a:g=[14,a-129,6];break;case 256>=a:g=[15,a-193,6];break;case 384>=a:g=[16,a-257,7];break;case 512>=a:g=[17,a-385,7];break;case 768>=a:g=[18,a-513,8];break;case 1024>=a:g=[19,a-769,8];break;case 1536>=a:g=[20,a-1025,9];break;case 2048>=a:g=[21,a-1537,9];break;case 3072>=a:g=[22,a-2049,10];break;case 4096>=a:g=[23,a-3073,10];break;case 6144>=a:g=[24,a-4097,11];break;case 8192>=a:g=[25,a-6145,11];break;case 12288>=a:g=[26,a-8193,12];break;case 16384>=
        a:g=[27,a-12289,12];break;case 24576>=a:g=[28,a-16385,13];break;case 32768>=a:g=[29,a-24577,13];break;default:m("invalid distance");}f=g;d[e++]=f[0];d[e++]=f[1];d[e++]=f[2];var h,k;h=0;for(k=d.length;h<k;++h)n[l++]=d[h];t[d[0]]++;x[d[3]]++;s=b.length+c-1;r=null;}var e,b,f,g,h,k={},p,q,r,n=G?new Uint16Array(2*a.length):[],l=0,s=0,t=new (G?Uint32Array:Array)(286),x=new (G?Uint32Array:Array)(30),E=d.w,B;if(!G){for(f=0;285>=f;)t[f++]=0;for(f=0;29>=f;)x[f++]=0;}t[256]=1;e=0;for(b=a.length;e<b;++e){f=h=0;
            for(g=3;f<g&&e+f!==b;++f)h=h<<8|a[e+f];k[h]===w&&(k[h]=[]);p=k[h];if(!(0<s--)){for(;0<p.length&&32768<e-p[0];)p.shift();if(e+3>=b){r&&c(r,-1);f=0;for(g=b-e;f<g;++f)B=a[e+f],n[l++]=B,++t[B];break}0<p.length?(q=ya(a,e,p),r?r.length<q.length?(B=a[e-1],n[l++]=B,++t[B],c(q,0)):c(r,-1):q.length<E?r=q:c(q,0)):r?c(r,-1):(B=a[e],n[l++]=B,++t[B]);}p.push(e);}n[l++]=256;t[256]++;d.L=t;d.K=x;return G?n.subarray(0,l):n}
        function ya(d,a,c){var e,b,f=0,g,h,k,p,q=d.length;h=0;p=c.length;a:for(;h<p;h++){e=c[p-h-1];g=3;if(3<f){for(k=f;3<k;k--)if(d[e+k-1]!==d[a+k-1])continue a;g=f;}for(;258>g&&a+g<q&&d[e+g]===d[a+g];)++g;g>f&&(b=e,f=g);if(258===g)break}return new ua(f,a-b)}
        function ra(d,a){var c=d.length,e=new ja(572),b=new (G?Uint8Array:Array)(c),f,g,h,k,p;if(!G)for(k=0;k<c;k++)b[k]=0;for(k=0;k<c;++k)0<d[k]&&e.push(k,d[k]);f=Array(e.length/2);g=new (G?Uint32Array:Array)(e.length/2);if(1===f.length)return b[e.pop().index]=1,b;k=0;for(p=e.length/2;k<p;++k)f[k]=e.pop(),g[k]=f[k].value;h=za(g,g.length,a);k=0;for(p=f.length;k<p;++k)b[f[k].index]=h[k];return b}
        function za(d,a,c){function e(b){var c=k[b][p[b]];c===a?(e(b+1),e(b+1)):--g[c];++p[b];}var b=new (G?Uint16Array:Array)(c),f=new (G?Uint8Array:Array)(c),g=new (G?Uint8Array:Array)(a),h=Array(c),k=Array(c),p=Array(c),q=(1<<c)-a,r=1<<c-1,n,l,s,t,x;b[c-1]=a;for(l=0;l<c;++l)q<r?f[l]=0:(f[l]=1,q-=r),q<<=1,b[c-2-l]=(b[c-1-l]/2|0)+a;b[0]=f[0];h[0]=Array(b[0]);k[0]=Array(b[0]);for(l=1;l<c;++l)b[l]>2*b[l-1]+f[l]&&(b[l]=2*b[l-1]+f[l]),h[l]=Array(b[l]),k[l]=Array(b[l]);for(n=0;n<a;++n)g[n]=c;for(s=0;s<b[c-1];++s)h[c-
        1][s]=d[s],k[c-1][s]=s;for(n=0;n<c;++n)p[n]=0;1===f[c-1]&&(--g[0],++p[c-1]);for(l=c-2;0<=l;--l){t=n=0;x=p[l+1];for(s=0;s<b[l];s++)t=h[l+1][x]+h[l+1][x+1],t>d[n]?(h[l][s]=t,k[l][s]=a,x+=2):(h[l][s]=d[n],k[l][s]=n,++n);p[l]=0;1===f[l]&&e(l);}return g}
        function ta(d){var a=new (G?Uint16Array:Array)(d.length),c=[],e=[],b=0,f,g,h,k;f=0;for(g=d.length;f<g;f++)c[d[f]]=(c[d[f]]|0)+1;f=1;for(g=16;f<=g;f++)e[f]=b,b+=c[f]|0,b<<=1;f=0;for(g=d.length;f<g;f++){b=e[d[f]];e[d[f]]+=1;h=a[f]=0;for(k=d[f];h<k;h++)a[f]=a[f]<<1|b&1,b>>>=1;}return a}function U(d,a){this.l=[];this.m=32768;this.e=this.g=this.c=this.q=0;this.input=G?new Uint8Array(d):d;this.s=!1;this.n=Aa;this.B=!1;if(a||!(a={}))a.index&&(this.c=a.index),a.bufferSize&&(this.m=a.bufferSize),a.bufferType&&(this.n=a.bufferType),a.resize&&(this.B=a.resize);switch(this.n){case Ba:this.b=32768;this.a=new (G?Uint8Array:Array)(32768+this.m+258);break;case Aa:this.b=0;this.a=new (G?Uint8Array:Array)(this.m);this.f=this.J;this.t=this.H;this.o=this.I;break;default:m(Error("invalid inflate mode"));}}
        var Ba=0,Aa=1,Ca={D:Ba,C:Aa};
        U.prototype.p=function(){for(;!this.s;){var d=V(this,3);d&1&&(this.s=z);d>>>=1;switch(d){case 0:var a=this.input,c=this.c,e=this.a,b=this.b,f=a.length,g=w,h=w,k=e.length,p=w;this.e=this.g=0;c+1>=f&&m(Error("invalid uncompressed block header: LEN"));g=a[c++]|a[c++]<<8;c+1>=f&&m(Error("invalid uncompressed block header: NLEN"));h=a[c++]|a[c++]<<8;g===~h&&m(Error("invalid uncompressed block header: length verify"));c+g>a.length&&m(Error("input buffer is broken"));switch(this.n){case Ba:for(;b+g>e.length;){p=
            k-b;g-=p;if(G)e.set(a.subarray(c,c+p),b),b+=p,c+=p;else for(;p--;)e[b++]=a[c++];this.b=b;e=this.f();b=this.b;}break;case Aa:for(;b+g>e.length;)e=this.f({v:2});break;default:m(Error("invalid inflate mode"));}if(G)e.set(a.subarray(c,c+g),b),b+=g,c+=g;else for(;g--;)e[b++]=a[c++];this.c=c;this.b=b;this.a=e;break;case 1:this.o(Da,Ea);break;case 2:for(var q=V(this,5)+257,r=V(this,5)+1,n=V(this,4)+4,l=new (G?Uint8Array:Array)(Sa.length),s=w,t=w,x=w,E=w,B=w,C=w,L=w,v=w,M=w,v=0;v<n;++v)l[Sa[v]]=V(this,3);if(!G){v=
            n;for(n=l.length;v<n;++v)l[Sa[v]]=0;}s=S(l);E=new (G?Uint8Array:Array)(q+r);v=0;for(M=q+r;v<M;)switch(B=Ta(this,s),B){case 16:for(L=3+V(this,2);L--;)E[v++]=C;break;case 17:for(L=3+V(this,3);L--;)E[v++]=0;C=0;break;case 18:for(L=11+V(this,7);L--;)E[v++]=0;C=0;break;default:C=E[v++]=B;}t=G?S(E.subarray(0,q)):S(E.slice(0,q));x=G?S(E.subarray(q)):S(E.slice(q));this.o(t,x);break;default:m(Error("unknown BTYPE: "+d));}}return this.t()};
        var Ua=[16,17,18,0,8,7,9,6,10,5,11,4,12,3,13,2,14,1,15],Sa=G?new Uint16Array(Ua):Ua,Va=[3,4,5,6,7,8,9,10,11,13,15,17,19,23,27,31,35,43,51,59,67,83,99,115,131,163,195,227,258,258,258],Wa=G?new Uint16Array(Va):Va,Xa=[0,0,0,0,0,0,0,0,1,1,1,1,2,2,2,2,3,3,3,3,4,4,4,4,5,5,5,5,0,0,0],Ya=G?new Uint8Array(Xa):Xa,Za=[1,2,3,4,5,7,9,13,17,25,33,49,65,97,129,193,257,385,513,769,1025,1537,2049,3073,4097,6145,8193,12289,16385,24577],$a=G?new Uint16Array(Za):Za,ab=[0,0,0,0,1,1,2,2,3,3,4,4,5,5,6,6,7,7,8,8,9,9,10,
            10,11,11,12,12,13,13],bb=G?new Uint8Array(ab):ab,cb=new (G?Uint8Array:Array)(288),W,db;W=0;for(db=cb.length;W<db;++W)cb[W]=143>=W?8:255>=W?9:279>=W?7:8;var Da=S(cb),eb=new (G?Uint8Array:Array)(30),fb,hb;fb=0;for(hb=eb.length;fb<hb;++fb)eb[fb]=5;var Ea=S(eb);function V(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h;e<a;)f>=g&&m(Error("input buffer is broken")),c|=b[f++]<<e,e+=8;h=c&(1<<a)-1;d.g=c>>>a;d.e=e-a;d.c=f;return h}
        function Ta(d,a){for(var c=d.g,e=d.e,b=d.input,f=d.c,g=b.length,h=a[0],k=a[1],p,q;e<k&&!(f>=g);)c|=b[f++]<<e,e+=8;p=h[c&(1<<k)-1];q=p>>>16;q>e&&m(Error("invalid code length: "+q));d.g=c>>q;d.e=e-q;d.c=f;return p&65535}
        U.prototype.o=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length-258,f,g,h,k;256!==(f=Ta(this,d));)if(256>f)e>=b&&(this.b=e,c=this.f(),e=this.b),c[e++]=f;else {g=f-257;k=Wa[g];0<Ya[g]&&(k+=V(this,Ya[g]));f=Ta(this,a);h=$a[f];0<bb[f]&&(h+=V(this,bb[f]));e>=b&&(this.b=e,c=this.f(),e=this.b);for(;k--;)c[e]=c[e++-h];}for(;8<=this.e;)this.e-=8,this.c--;this.b=e;};
        U.prototype.I=function(d,a){var c=this.a,e=this.b;this.u=d;for(var b=c.length,f,g,h,k;256!==(f=Ta(this,d));)if(256>f)e>=b&&(c=this.f(),b=c.length),c[e++]=f;else {g=f-257;k=Wa[g];0<Ya[g]&&(k+=V(this,Ya[g]));f=Ta(this,a);h=$a[f];0<bb[f]&&(h+=V(this,bb[f]));e+k>b&&(c=this.f(),b=c.length);for(;k--;)c[e]=c[e++-h];}for(;8<=this.e;)this.e-=8,this.c--;this.b=e;};
        U.prototype.f=function(){var d=new (G?Uint8Array:Array)(this.b-32768),a=this.b-32768,c,e,b=this.a;if(G)d.set(b.subarray(32768,d.length));else {c=0;for(e=d.length;c<e;++c)d[c]=b[c+32768];}this.l.push(d);this.q+=d.length;if(G)b.set(b.subarray(a,a+32768));else for(c=0;32768>c;++c)b[c]=b[a+c];this.b=32768;return b};
        U.prototype.J=function(d){var a,c=this.input.length/this.c+1|0,e,b,f,g=this.input,h=this.a;d&&("number"===typeof d.v&&(c=d.v),"number"===typeof d.F&&(c+=d.F));2>c?(e=(g.length-this.c)/this.u[2],f=258*(e/2)|0,b=f<h.length?h.length+f:h.length<<1):b=h.length*c;G?(a=new Uint8Array(b),a.set(h)):a=h;return this.a=a};
        U.prototype.t=function(){var d=0,a=this.a,c=this.l,e,b=new (G?Uint8Array:Array)(this.q+(this.b-32768)),f,g,h,k;if(0===c.length)return G?this.a.subarray(32768,this.b):this.a.slice(32768,this.b);f=0;for(g=c.length;f<g;++f){e=c[f];h=0;for(k=e.length;h<k;++h)b[d++]=e[h];}f=32768;for(g=this.b;f<g;++f)b[d++]=a[f];this.l=[];return this.buffer=b};
        U.prototype.H=function(){var d,a=this.b;G?this.B?(d=new Uint8Array(a),d.set(this.a.subarray(0,a))):d=this.a.subarray(0,a):(this.a.length>a&&(this.a.length=a),d=this.a);return this.buffer=d};function ib(d){if("string"===typeof d){var a=d.split(""),c,e;c=0;for(e=a.length;c<e;c++)a[c]=(a[c].charCodeAt(0)&255)>>>0;d=a;}for(var b=1,f=0,g=d.length,h,k=0;0<g;){h=1024<g?1024:g;g-=h;do b+=d[k++],f+=b;while(--h);b%=65521;f%=65521;}return (f<<16|b)>>>0}function jb(d,a){var c,e;this.input=d;this.c=0;if(a||!(a={}))a.index&&(this.c=a.index),a.verify&&(this.M=a.verify);c=d[this.c++];e=d[this.c++];switch(c&15){case kb:this.method=kb;break;default:m(Error("unsupported compression method"));}0!==((c<<8)+e)%31&&m(Error("invalid fcheck flag:"+((c<<8)+e)%31));e&32&&m(Error("fdict flag is not supported"));this.A=new U(d,{index:this.c,bufferSize:a.bufferSize,bufferType:a.bufferType,resize:a.resize});}
        jb.prototype.p=function(){var d=this.input,a,c;a=this.A.p();this.c=this.A.c;this.M&&(c=(d[this.c++]<<24|d[this.c++]<<16|d[this.c++]<<8|d[this.c++])>>>0,c!==ib(a)&&m(Error("invalid adler-32 checksum")));return a};var kb=8;function lb(d,a){this.input=d;this.a=new (G?Uint8Array:Array)(32768);this.h=X.k;var c={},e;if((a||!(a={}))&&"number"===typeof a.compressionType)this.h=a.compressionType;for(e in a)c[e]=a[e];c.outputBuffer=this.a;this.z=new ka(this.input,c);}var X=oa;
        lb.prototype.j=function(){var d,a,c,e,b,f,g,h=0;g=this.a;d=kb;switch(d){case kb:a=Math.LOG2E*Math.log(32768)-8;break;default:m(Error("invalid compression method"));}c=a<<4|d;g[h++]=c;switch(d){case kb:switch(this.h){case X.NONE:b=0;break;case X.r:b=1;break;case X.k:b=2;break;default:m(Error("unsupported compression type"));}break;default:m(Error("invalid compression method"));}e=b<<6|0;g[h++]=e|31-(256*c+e)%31;f=ib(this.input);this.z.b=h;g=this.z.j();h=g.length;G&&(g=new Uint8Array(g.buffer),g.length<=
        h+4&&(this.a=new Uint8Array(g.length+4),this.a.set(g),g=this.a),g=g.subarray(0,h+4));g[h++]=f>>24&255;g[h++]=f>>16&255;g[h++]=f>>8&255;g[h++]=f&255;return g};function mb(d,a){var c,e,b,f;if(Object.keys)c=Object.keys(a);else for(e in c=[],b=0,a)c[b++]=e;b=0;for(f=c.length;b<f;++b)e=c[b],A(d+"."+e,a[e]);}A("Zlib.Inflate",jb);A("Zlib.Inflate.prototype.decompress",jb.prototype.p);mb("Zlib.Inflate.BufferType",{ADAPTIVE:Ca.C,BLOCK:Ca.D});A("Zlib.Deflate",lb);A("Zlib.Deflate.compress",function(d,a){return (new lb(d,a)).j()});A("Zlib.Deflate.prototype.compress",lb.prototype.j);mb("Zlib.Deflate.CompressionType",{NONE:X.NONE,FIXED:X.r,DYNAMIC:X.k});}).call(self);

    /**
     * Common utilities
     * @module glMatrix
     */
    var ARRAY_TYPE = typeof Float32Array !== 'undefined' ? Float32Array : Array;
    if (!Math.hypot) Math.hypot = function () {
      var y = 0,
          i = arguments.length;

      while (i--) {
        y += arguments[i] * arguments[i];
      }

      return Math.sqrt(y);
    };

    /**
     * 3 Dimensional Vector
     * @module vec3
     */

    /**
     * Creates a new, empty vec3
     *
     * @returns {vec3} a new 3D vector
     */

    function create$1() {
      var out = new ARRAY_TYPE(3);

      if (ARRAY_TYPE != Float32Array) {
        out[0] = 0;
        out[1] = 0;
        out[2] = 0;
      }

      return out;
    }
    /**
     * Subtracts vector b from vector a
     *
     * @param {vec3} out the receiving vector
     * @param {ReadonlyVec3} a the first operand
     * @param {ReadonlyVec3} b the second operand
     * @returns {vec3} out
     */

    function subtract(out, a, b) {
      out[0] = a[0] - b[0];
      out[1] = a[1] - b[1];
      out[2] = a[2] - b[2];
      return out;
    }
    /**
     * Normalize a vec3
     *
     * @param {vec3} out the receiving vector
     * @param {ReadonlyVec3} a vector to normalize
     * @returns {vec3} out
     */

    function normalize(out, a) {
      var x = a[0];
      var y = a[1];
      var z = a[2];
      var len = x * x + y * y + z * z;

      if (len > 0) {
        //TODO: evaluate use of glm_invsqrt here?
        len = 1 / Math.sqrt(len);
      }

      out[0] = a[0] * len;
      out[1] = a[1] * len;
      out[2] = a[2] * len;
      return out;
    }
    /**
     * Computes the cross product of two vec3's
     *
     * @param {vec3} out the receiving vector
     * @param {ReadonlyVec3} a the first operand
     * @param {ReadonlyVec3} b the second operand
     * @returns {vec3} out
     */

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
    /**
     * Alias for {@link vec3.subtract}
     * @function
     */

    var sub = subtract;
    /**
     * Perform some operation over an array of vec3s.
     *
     * @param {Array} a the array of vectors to iterate over
     * @param {Number} stride Number of elements between the start of each vec3. If 0 assumes tightly packed
     * @param {Number} offset Number of elements to skip at the beginning of the array
     * @param {Number} count Number of vec3s to iterate over. If 0 iterates over entire array
     * @param {Function} fn Function to call for each vector in the array
     * @param {Object} [arg] additional argument to pass to fn
     * @returns {Array} a
     * @function
     */

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

    /**
     * 2 Dimensional Vector
     * @module vec2
     */

    /**
     * Creates a new, empty vec2
     *
     * @returns {vec2} a new 2D vector
     */

    function create() {
      var out = new ARRAY_TYPE(2);

      if (ARRAY_TYPE != Float32Array) {
        out[0] = 0;
        out[1] = 0;
      }

      return out;
    }
    /**
     * Set the components of a vec2 to the given values
     *
     * @param {vec2} out the receiving vector
     * @param {Number} x X component
     * @param {Number} y Y component
     * @returns {vec2} out
     */

    function set(out, x, y) {
      out[0] = x;
      out[1] = y;
      return out;
    }
    /**
     * Perform some operation over an array of vec2s.
     *
     * @param {Array} a the array of vectors to iterate over
     * @param {Number} stride Number of elements between the start of each vec2. If 0 assumes tightly packed
     * @param {Number} offset Number of elements to skip at the beginning of the array
     * @param {Number} count Number of vec2s to iterate over. If 0 iterates over entire array
     * @param {Function} fn Function to call for each vector in the array
     * @param {Object} [arg] additional argument to pass to fn
     * @returns {Array} a
     * @function
     */

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

    const P0P1 = [];
    const P1P2 = [];
    const A$1 = [];
    const B = [];
    const C = [];
    const POSITIONS = [];
    const maxShort = 32767;

    const terrainStructure = {
        width: 64,
        height: 64,
        elementsPerHeight: 3,
        heightOffset: -1000,
        exaggeration: 1.0,
        heightScale: 0.001,
        elementMultiplier: 256,
        stride: 4,
        skirtHeight: 0.002,
        skirtOffset: 0.01 // 用于减少地形瓦片之间的缝隙
    };

    function lerp(p, q, time) {
        return (1.0 - time) * p + time * q;
    }

    const textDecoder = new TextDecoder('utf-8');
    function uint8ArrayToString(fileData) {
        return textDecoder.decode(fileData);
    }

    function decZlibBuffer(zBuffer) {
        if (zBuffer.length < 1000) {
            return null;
        }
        // @ts-ignore
        const inflate = new self.Zlib.Inflate(zBuffer);

        if (inflate) {
            return inflate.decompress();
        }
        return null;
    }

    function transformBuffer(zlibData) {
        const DataSize = 2;
        const dZlib = zlibData;

        const myW = terrainStructure.width;
        const myH = terrainStructure.height;
        const myBuffer = new Uint8Array(myW * myH * terrainStructure.stride);

        let i_height;
        let NN, NN_R;
        let jj_n, ii_n;
        for (let jj = 0; jj < myH; jj++) {
            for (let ii = 0; ii < myW; ii++) {
                // @ts-ignore
                jj_n = parseInt((149 * jj) / (myH - 1));
                // @ts-ignore
                ii_n = parseInt((149 * ii) / (myW - 1));
                // @ts-ignore
                {
                    NN = DataSize * (jj_n * 150 + ii_n);
                    i_height = dZlib[NN] + (dZlib[NN + 1] * 256);
                }
                if (i_height > 10000 || i_height < -2000) { // 低于海平面2000，高于地面10000
                    i_height = 0;
                }
                NN_R = (jj * myW + ii) * 4;
                const i_height_new = (i_height + 1000) / terrainStructure.heightScale;
                const elementMultiplier = terrainStructure.elementMultiplier;
                myBuffer[NN_R] = i_height_new / (elementMultiplier * elementMultiplier);
                myBuffer[NN_R + 1] = (i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier) / elementMultiplier;
                myBuffer[NN_R + 2] = i_height_new - myBuffer[NN_R] * elementMultiplier * elementMultiplier - myBuffer[NN_R + 1] * elementMultiplier;
                myBuffer[NN_R + 3] = 255;
            }
        }
        return myBuffer;
    }

    function zigZagDecode(value) {
        return (value >> 1) ^ -(value & 1);
    }

    function zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer) {
        const count = uBuffer.length;

        let u = 0;
        let v = 0;
        let height = 0;

        for (let i = 0; i < count; ++i) {
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

    function createHeightMap(heightmap, terrainWidth/*, exag */) {
        const width = terrainWidth, height = terrainWidth;
        const endRow = width + 1, endColum = height + 1;
        const elementsPerHeight = terrainStructure.elementsPerHeight;
        const heightOffset = terrainStructure.heightOffset;
        const exaggeration = 1;// terrainStructure.exaggeration || exag;
        const heightScale = terrainStructure.heightScale;
        const elementMultiplier = terrainStructure.elementMultiplier;
        const stride = 4;
        const skirtHeight = terrainStructure.skirtHeight;
        const heights = new Float32Array(endRow * endColum);
        let index = 0;
        let min = Infinity;
        let max = -Infinity;
        for (let i = 0; i < endRow; i++) {
            const row = i >= height ? height - 1 : i;
            for (let j = 0; j < endColum; j++) {
                const colum = j >= width ? width - 1 : j;
                let heightSample = 0;
                const terrainOffset = row * (width * stride) + colum * stride;
                for (let elementOffset = 0; elementOffset < elementsPerHeight; elementOffset++) {
                    heightSample = (heightSample * elementMultiplier) + heightmap[terrainOffset + elementOffset];
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
        return { data: heights, min, max, width: 0, height: 0, tileSize: 0, image: null };
    }

    function generateTiandituTerrain(buffer, terrainWidth, tileSize) {
        const zBuffer = new Uint8Array(buffer);

        const dZlib = decZlibBuffer(zBuffer);
        if (!dZlib) {
            throw new Error(uint8ArrayToString(new Uint8Array(buffer)));
        }
        const heightBuffer = transformBuffer(dZlib);
        const result = createHeightMap(heightBuffer, terrainWidth - 1);
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
            let x = a * 3;
            let y = a * 3 + 1;
            let z = a * 3 + 2;
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

            const p0p1 = sub(P0P1, this.p1, this.p0);
            const p1p2 = sub(P1P2, this.p2, this.p1);
            this.normal = normalize(this.normal, cross(this.normal, p0p1, p1p2));
        }

        contains(x, y) {
            if (x < this.min[0] || x > this.max[0] || y < this.min[1] || y > this.max[1]) {
                return false;
            }
            set(A$1, this.p0[0], this.p0[1]);
            set(B, this.p1[0], this.p1[1]);
            set(C, this.p2[0], this.p2[1]);
            const SABC = calTriangleArae(A$1[0], A$1[1], B[0], B[1], C[0], C[1]);
            const SPAC = calTriangleArae(x, y, A$1[0], A$1[1], C[0], C[1]);
            const SPAB = calTriangleArae(x, y, A$1[0], A$1[1], B[0], B[1]);
            const SPBC = calTriangleArae(x, y, B[0], B[1], C[0], C[1]);
            return SPAC + SPAB + SPBC - SABC <= 0.0001;
        }

        getHeight(x, y) {
            // https://stackoverflow.com/questions/18755251/linear-interpolation-of-three-3d-points-in-3d-space
            // z1 - ((x4-x1)*N.x + (y4-y1)*N.y)/ N.z
            const N = this.normal;
            return this.p0[2] - ((x - this.p0[0]) * N[0] + (y - this.p0[1]) * N[1]) / N[2];
        }
    }

    function calTriangleArae(x1, y1, x2, y2, x3, y3) {
        return Math.abs(x1 * y2 + x2 * y3 + x3 * y1 - x1 * y3 - x2 * y1 - x3 * y2) * 0.5;
    }

    // 当前像素命中某三角形后，下一个像素也很可能会在该三角形中，可以节省一些循环
    let preTriangle = null;
    function findInTriangle(triangles, x, y) {
        if (preTriangle && preTriangle.contains(x, y)) {
            return preTriangle.getHeight(x, y);
        }
        for (let i = 0; i < triangles.length; i++) {
            if (triangles[i].contains(x, y)) {
                preTriangle = triangles[i];
                return triangles[i].getHeight(x, y);
            }
        }
        return 0;
    }

    const TRIANGLES = [];

    function cesiumTerrainToHeights(buffer, terrainWidth, tileSize) {
        const terrainData = generateCesiumTerrain(buffer);
        const { positions, min, max, indices, radius } = terrainData;
        const triangles = [];
        let index = 0;
        for (let i = 0; i < indices.length; i += 3) {
            let triangle = TRIANGLES[index];
            if (triangle) {
                triangle.set(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
            } else {
                triangle = TRIANGLES[index] = new Triangle(positions, indices[i], indices[i + 1], indices[i + 2], radius * 2);
            }
            index++;
            triangles.push(triangle);
        }
        const heights = new Float32Array(terrainWidth * terrainWidth);
        index = 0;
        for (let i = 0; i < terrainWidth; i++) {
            for (let j = 0; j < terrainWidth; j++) {
                heights[index++] = findInTriangle(triangles, j / terrainWidth * radius * 2, i / terrainWidth * radius * 2);
            }
        }

        const result = { data: heights, min, max, width: terrainWidth, height: terrainWidth, tileSize };
        createTerrainImage(result);
        console.log(result);
        return result;
    }

    function generateCesiumTerrain(buffer) {
        // cesium 格式说明：
        // https://www.cnblogs.com/oloroso/p/11080222.html
        let pos = 0;
        const cartesian3Elements = 3;
        // const boundingSphereElements = cartesian3Elements + 1;
        const cartesian3Length = Float64Array.BYTES_PER_ELEMENT * cartesian3Elements;
        // const boundingSphereLength =
        // Float64Array.BYTES_PER_ELEMENT * boundingSphereElements;
        const encodedVertexElements = 3;
        const encodedVertexLength =
            Uint16Array.BYTES_PER_ELEMENT * encodedVertexElements;
        const triangleElements = 3;
        let bytesPerIndex = Uint16Array.BYTES_PER_ELEMENT;

        const view = new DataView(buffer);
        pos += cartesian3Length;

        const minimumHeight = view.getFloat32(pos, true);
        pos += Float32Array.BYTES_PER_ELEMENT;
        const maximumHeight = view.getFloat32(pos, true);
        pos += Float32Array.BYTES_PER_ELEMENT;
        pos += cartesian3Length;
        const radius = view.getFloat64(pos, true);
        pos += Float64Array.BYTES_PER_ELEMENT;
        pos += cartesian3Length;

        const vertexCount = view.getUint32(pos, true);
        pos += Uint32Array.BYTES_PER_ELEMENT;
        const encodedVertexBuffer = new Uint16Array(buffer, pos, vertexCount * 3);
        pos += vertexCount * encodedVertexLength;

        if (vertexCount > 64 * 1024) {
            bytesPerIndex = Uint32Array.BYTES_PER_ELEMENT;
        }

        const uBuffer = encodedVertexBuffer.subarray(0, vertexCount);
        const vBuffer = encodedVertexBuffer.subarray(vertexCount, 2 * vertexCount);
        const heightBuffer = encodedVertexBuffer.subarray(
            vertexCount * 2,
            3 * vertexCount
        );

        zigZagDeltaDecode(uBuffer, vBuffer, heightBuffer);

        if (pos % bytesPerIndex !== 0) {
            pos += bytesPerIndex - (pos % bytesPerIndex);
        }

        const triangleCount = view.getUint32(pos, true);
        pos += Uint32Array.BYTES_PER_ELEMENT;
        const indices = vertexCount > 65536 ? new Uint32Array(buffer, pos, triangleCount * triangleElements) : new Uint16Array(buffer, pos, triangleCount * triangleElements);

        let highest = 0;
        const length = indices.length;
        for (let i = 0; i < length; ++i) {
            const code = indices[i];
            indices[i] = highest - code;
            if (code === 0) {
                ++highest;
            }
        }
        const terrain = {
            minimumHeight: minimumHeight,
            maximumHeight: maximumHeight,
            quantizedVertices: encodedVertexBuffer,
            indices: indices
        };

        const quantizedVertices = terrain.quantizedVertices;
        const quantizedVertexCount = quantizedVertices.length / 3;
        const uBuffer_1 = quantizedVertices.subarray(0, quantizedVertexCount);
        const vBuffer_1 = quantizedVertices.subarray(
            quantizedVertexCount,
            2 * quantizedVertexCount
        );
        const heightBuffer_1 = quantizedVertices.subarray(
            quantizedVertexCount * 2,
            3 * quantizedVertexCount
        );
        const positions = POSITIONS;
        for (let i = 0; i < quantizedVertexCount; ++i) {
            const rawU = uBuffer_1[i];
            const rawV = vBuffer_1[i];

            const u = rawU / maxShort;
            const v = rawV / maxShort;
            const height = lerp(
                minimumHeight,
                maximumHeight,
                heightBuffer_1[i] / maxShort
            );
            positions[i * 3] = u;
            positions[i * 3 + 1] = (1 - v);
            positions[i * 3 + 2] = height;
        }
        return { positions, radius, min: minimumHeight, max: maximumHeight, indices };
    }

    function createTerrainImage(terrainData) {
        const canvas = getCanvas();
        const { width, height, data, tileSize } = terrainData;
        if (!width || !height || !data) {
            return;
        }
        try {
            resizeCanvas(canvas, width, height);
            let ctx = getCanvasContext(canvas);
            const imageData = ctx.createImageData(width, height);
            const out = [0, 0, 0];
            for (let i = 0, len = data.length; i < len; i++) {
                const height = data[i];
                const [r, g, b] = encodeMapBox(height, out);
                const idx = 4 * i;
                imageData.data[idx] = r;
                imageData.data[idx + 1] = g;
                imageData.data[idx + 2] = b;
                imageData.data[idx + 3] = 255;
            }
            ctx.putImageData(imageData, 0, 0);
            const image = canvas.transferToImageBitmap();
            resizeCanvas(canvas, tileSize, tileSize);
            ctx = getCanvasContext(canvas);
            ctx.drawImage(image, 0, 0, width, height, 0, 0, tileSize, tileSize);
            terrainData.image = canvas.transferToImageBitmap();

        } catch (error) {
            console.log(error);
        }
    }

    const tileImageCache = new LRUCache(200, (image) => {
        disposeImage(image);
    });
    const tileBufferCache = new LRUCache(200, (buffer) => {
        // disposeImage(image);
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
    const CONTROLCACHE = {};
    function cacheFetch(taskId, control) {
        CONTROLCACHE[taskId] = CONTROLCACHE[taskId] || [];
        CONTROLCACHE[taskId].push(control);
    }
    function cancelFetch(taskId) {
        const controlList = CONTROLCACHE[taskId] || [];
        if (controlList.length) {
            controlList.forEach(control => {
                control.abort(FetchCancelError);
            });
        }
        delete CONTROLCACHE[taskId];
    }
    function finishFetch(control) {
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
    function fetchTile(url, headers = {}, options) {
        // console.log(abortControlCache);
        return new Promise((resolve, reject) => {
            const copyImageBitMap = (image) => {
                createImageBitmap(image).then(imagebit => {
                    resolve(imagebit);
                }).catch(error => {
                    reject(error);
                });
            };
            const taskId = options.__taskId;
            if (!taskId) {
                reject(createError('taskId is null'));
                return;
            }
            const image = tileImageCache.get(url);
            if (image) {
                copyImageBitMap(image);
            }
            else {
                const fetchOptions = options.fetchOptions || {
                    headers,
                    referrer: options.referrer
                };
                const timeout = options.timeout || 0;
                const control = new AbortController();
                const signal = control.signal;
                if (timeout && isNumber(timeout) && timeout > 0) {
                    setTimeout(() => {
                        control.abort(FetchTimeoutError);
                    }, timeout);
                }
                fetchOptions.signal = signal;
                delete fetchOptions.timeout;
                cacheFetch(taskId, control);
                fetch(url, fetchOptions).then(res => res.blob()).then(blob => createImageBitmap(blob)).then(image => {
                    if (options.disableCache !== true) {
                        tileImageCache.add(url, image);
                    }
                    finishFetch(control);
                    copyImageBitMap(image);
                }).catch(error => {
                    finishFetch(control);
                    reject(error);
                });
            }
        });
    }
    function fetchTileBuffer(url, headers = {}, options) {
        return new Promise((resolve, reject) => {
            const copyBuffer = (buffer) => {
                resolve(buffer);
            };
            const taskId = options.__taskId;
            if (!taskId) {
                reject(createError('taskId is null'));
                return;
            }
            const buffer = tileBufferCache.get(url);
            if (buffer) {
                copyBuffer(buffer);
            }
            else {
                const fetchOptions = options.fetchOptions || {
                    headers,
                    referrer: options.referrer
                };
                const timeout = options.timeout || 0;
                const control = new AbortController();
                const signal = control.signal;
                if (timeout && isNumber(timeout) && timeout > 0) {
                    setTimeout(() => {
                        control.abort(FetchTimeoutError);
                    }, timeout);
                }
                fetchOptions.signal = signal;
                delete fetchOptions.timeout;
                cacheFetch(taskId, control);
                fetch(url, fetchOptions).then(res => res.arrayBuffer()).then(buffer => {
                    if (options.disableCache !== true) {
                        tileBufferCache.add(url, buffer);
                    }
                    finishFetch(control);
                    copyBuffer(buffer);
                }).catch(error => {
                    finishFetch(control);
                    reject(error);
                });
            }
        });
    }
    function getTile(url, options) {
        return new Promise((resolve, reject) => {
            const urls = checkTileUrl(url);
            const headers = Object.assign({}, HEADERS, options.headers || {});
            const fetchTiles = urls.map(tileUrl => {
                return fetchTile(tileUrl, headers, options);
            });
            const { returnBlobURL, globalCompositeOperation } = options;
            Promise.all(fetchTiles).then(imagebits => {
                const canvas = getCanvas();
                const image = mergeImages(imagebits, globalCompositeOperation);
                if (image instanceof Error) {
                    reject(image);
                    return;
                }
                // const filter = options.filter;
                const filterImage = imageFilter(canvas, image, options.filter);
                const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);
                const opImage = imageOpacity(blurImage, options.opacity);
                if (!returnBlobURL) {
                    resolve(opImage);
                }
                else {
                    toBlobURL(opImage).then(blob => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    }).catch(error => {
                        reject(error);
                    });
                }
            }).catch(error => {
                reject(error);
            });
        });
    }
    function getTileWithMaxZoom(options) {
        const { urlTemplate, x, y, z, maxAvailableZoom, subdomains, returnBlobURL, globalCompositeOperation } = options;
        return new Promise((resolve, reject) => {
            const urlTemplates = checkTileUrl(urlTemplate);
            for (let i = 0, len = urlTemplates.length; i < len; i++) {
                const urlTemplate = urlTemplates[i];
                if (urlTemplate && urlTemplate.indexOf('{s}') > -1) {
                    if (!subdomains || subdomains.length === 0) {
                        reject(createError('not find subdomains'));
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
                const image = mergeImages(imagebits, globalCompositeOperation);
                if (image instanceof Error) {
                    reject(image);
                    return;
                }
                const filterImage = imageFilter(canvas, image, options.filter);
                const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);
                let opImage;
                if (zoomOffset <= 0) {
                    opImage = (imageOpacity(blurImage, options.opacity));
                }
                else {
                    const { width, height } = blurImage;
                    const dx = width * dxScale, dy = height * dyScale, w = width * wScale, h = height * hScale;
                    const imageBitMap = imageTileScale(canvas, blurImage, dx, dy, w, h);
                    opImage = imageOpacity(imageBitMap, options.opacity);
                }
                if (!returnBlobURL) {
                    resolve(opImage);
                }
                else {
                    toBlobURL(opImage).then(blob => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    }).catch(error => {
                        reject(error);
                    });
                }
            }).catch(error => {
                reject(error);
            });
        });
    }
    function encodeTerrainTile(url, options) {
        return new Promise((resolve, reject) => {
            const urls = checkTileUrl(url);
            const headers = Object.assign({}, HEADERS, options.headers || {});
            const { returnBlobURL, terrainWidth, tileSize, terrainType } = options;
            const returnImage = (terrainImage) => {
                if (!returnBlobURL) {
                    resolve(terrainImage);
                }
                else {
                    toBlobURL(terrainImage).then(blob => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    }).catch(error => {
                        reject(error);
                    });
                }
            };
            if (terrainType === 'mapzen') {
                const fetchTiles = urls.map(tileUrl => {
                    return fetchTile(tileUrl, headers, options);
                });
                Promise.all(fetchTiles).then(imagebits => {
                    const canvas = getCanvas();
                    const image = mergeImages(imagebits);
                    if (image instanceof Error) {
                        reject(image);
                        return;
                    }
                    resizeCanvas(canvas, image.width, image.height);
                    const ctx = getCanvasContext(canvas);
                    ctx.drawImage(image, 0, 0);
                    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                    transformMapZen(imageData);
                    ctx.putImageData(imageData, 0, 0);
                    const terrainImage = canvas.transferToImageBitmap();
                    returnImage(terrainImage);
                }).catch(error => {
                    reject(error);
                });
            }
            else if (terrainType === 'tianditu' || terrainType === 'cesium') {
                const fetchTiles = urls.map(tileUrl => {
                    return fetchTileBuffer(tileUrl, headers, options);
                });
                Promise.all(fetchTiles).then(buffers => {
                    if (!buffers || buffers.length === 0) {
                        reject(createError('buffers is null'));
                        return;
                    }
                    const buffer = buffers[0];
                    if (buffer.byteLength === 0) {
                        reject(createError('buffer is empty'));
                        return;
                    }
                    let result;
                    if (terrainType === 'tianditu') {
                        result = generateTiandituTerrain(buffer, terrainWidth, tileSize);
                    }
                    else {
                        result = cesiumTerrainToHeights(buffer, terrainWidth, tileSize);
                    }
                    if (!result.image) {
                        reject(createError('generate terrain data error,not find image data'));
                        return;
                    }
                    resolve(result.image);
                }).catch(error => {
                    reject(error);
                });
            }
            else {
                reject(createError('not support terrainType:' + terrainType));
            }
        });
    }

    const SIZE = 512;
    function imageSlicing(options) {
        options.disableCache = true;
        return new Promise((resolve, reject) => {
            const url = options.url;
            const urls = checkTileUrl(url);
            const headers = Object.assign({}, HEADERS, options.headers || {});
            const fetchTiles = urls.map(tileUrl => {
                return fetchTile(tileUrl, headers, options);
            });
            Promise.all(fetchTiles).then(imagebits => {
                const canvas = getCanvas(SIZE);
                const image = mergeImages(imagebits);
                if (image instanceof Error) {
                    reject(image);
                    return;
                }
                const { width, height } = image;
                const rows = Math.ceil(height / SIZE);
                const cols = Math.ceil(width / SIZE);
                const items = [];
                for (let row = 1; row <= rows; row++) {
                    const y1 = (row - 1) * SIZE;
                    const y2 = Math.min(height, row * SIZE);
                    for (let col = 1; col <= cols; col++) {
                        const x1 = (col - 1) * SIZE;
                        const x2 = Math.min(width, col * SIZE);
                        const w = x2 - x1, h = y2 - y1;
                        resizeCanvas(canvas, w, h);
                        const ctx = getCanvasContext(canvas);
                        ctx.drawImage(image, x1, y1, w, h, 0, 0, canvas.width, canvas.height);
                        const tempImage = canvas.transferToImageBitmap();
                        const filterImage = imageFilter(canvas, tempImage, options.filter);
                        const blurImage = imageGaussianBlur(canvas, filterImage, options.gaussianBlurRadius);
                        const opImage = imageOpacity(blurImage, options.opacity);
                        items.push({
                            id: uuid(),
                            x: x1,
                            y: y1,
                            width: w,
                            height: h,
                            row,
                            col,
                            image: opImage
                        });
                    }
                }
                const result = {
                    rows,
                    cols,
                    rowWidth: SIZE,
                    colsHeight: SIZE,
                    width,
                    height,
                    items
                };
                disposeImage(image);
                resolve(result);
            }).catch(error => {
                reject(error);
            });
        });
    }
    function imageToBlobURL(options) {
        return new Promise((resolve, reject) => {
            const debug = options.debug;
            const items = options.items;
            const workerId = options._workerId;
            const temp = [];
            const isEnd = () => {
                return temp.length === items.length;
            };
            items.forEach((item, index) => {
                const canvas = new OffscreenCanvas(item.width, item.height);
                const ctx = getCanvasContext(canvas);
                ctx.drawImage(item.image, 0, 0);
                if (debug) {
                    console.log('workerId:' + workerId + ',image to blob url :' + (index + 1) + '/' + items.length);
                }
                canvas.convertToBlob().then(blob => {
                    const url = URL.createObjectURL(blob);
                    item.url = url;
                    temp.push(1);
                    disposeImage(item.image);
                    delete item.image;
                    if (isEnd()) {
                        resolve(items);
                    }
                }).catch(error => {
                    console.error(error);
                    reject(error);
                });
            });
        });
    }

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
    function injectMask(maskId, geojson) {
        if (!isPolygon(geojson)) {
            return createError('geojson.feature is not Polygon');
        }
        if (GeoJSONCache[maskId]) {
            return createError('the' + maskId + ' geojson Already exists');
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
            const { tile, tileBBOX, projection, tileSize, maskId, returnBlobURL, reverse } = options;
            const feature = GeoJSONCache[maskId];
            if (!feature) {
                reject(createError('not find mask by maskId:' + maskId));
                return;
            }
            const canvas = getCanvas(tileSize);
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
            const judgeReverse = () => {
                if (!reverse) {
                    returnImage(getBlankTile(tileSize));
                }
                else {
                    returnImage(tile);
                }
            };
            if (!bboxIntersect(bbox, tileBBOX)) {
                judgeReverse();
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
                const image = imageClip(canvas, pixels, tile, reverse);
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
                judgeReverse();
                return;
            }
            newCoordinates = transformCoordinates(projection, clipRings);
            const pixels = transformPixels(projection, tileBBOX, tileSize, newCoordinates);
            const image = imageClip(canvas, pixels, tile, reverse);
            returnImage(image);
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
    const merc = new SphericalMercator({
        size: TILESIZE,
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
        let minrow = y;
        mincol = Math.floor(mincol);
        minrow = Math.floor(minrow);
        const xmin = orginX + (mincol) * res;
        const xmax = orginX + (mincol + 1) * res;
        const ymin = -orginY + (minrow) * res;
        const ymax = -orginY + (minrow + 1) * res;
        return [xmin, ymin, xmax, ymax];
    }
    function cal4326Tiles(x, y, z, zoomOffset = 0) {
        zoomOffset = zoomOffset || 0;
        const [orginX, orginY] = ORIGIN;
        const res = get4326Res(z) * TILESIZE;
        const tileBBOX = merc.bbox(x, y, z);
        // console.log(tileBBOX);
        const [minx, miny, maxx, maxy] = tileBBOX;
        let mincol = (minx - orginX) / res, maxcol = (maxx - orginX) / res;
        // const MAXROW = Math.floor(orginY * 2 / res);
        // let minrow = MAXROW - (orginY - miny) / res, maxrow = MAXROW - (orginY - maxy) / res;
        let minrow = (orginY - maxy) / res, maxrow = (orginY - miny) / res;
        mincol = Math.floor(mincol);
        maxcol = Math.floor(maxcol);
        minrow = Math.floor(minrow);
        maxrow = Math.floor(maxrow);
        // console.log(minrow, maxrow, MAXROW);
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
        const ymin = orginY - (maxrow + 1) * res;
        const ymax = orginY - (minrow) * res;
        // console.log(xmin, xmax, ymin, ymax);
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
        // console.log(tileBBOX);
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
    function tilesImageData(image, tilesbbox, tilebbox, projection) {
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
        resizeCanvas(tileCanvas, w, h);
        const ctx = getCanvasContext(tileCanvas);
        ctx.drawImage(image, x1, y1, w, h, 0, 0, w, h);
        disposeImage(image);
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
            image: tileCanvas.transferToImageBitmap()
            // canvas: tileCanvas
        };
    }
    function transformTiles(pixelsresult, mbbox, debug) {
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
        resizeCanvas(canvas, width, height);
        const ctx = getCanvasContext(canvas);
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
        resizeCanvas(canvas1, TILESIZE, TILESIZE);
        const ctx1 = getCanvasContext(canvas);
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
        const canvas = ctx.canvas;
        const { width, height } = canvas;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;
        const leftIsBlank = () => {
            for (let row = 1; row <= height; row++) {
                const idx = (width * 4) * (row - 1) + 0;
                const a = data[idx + 3];
                if (a > 0) {
                    return false;
                }
            }
            return true;
        };
        // const topIsBlank = () => {
        //     for (let col = 1; col <= width; col++) {
        //         const idx = (col - 1) * 4;
        //         const a = data[idx + 3];
        //         if (a > 0) {
        //             return false;
        //         }
        //     }
        //     return true;
        // }
        const bottomIsBlank = () => {
            for (let col = 1; col <= width; col++) {
                const idx = (col - 1) * 4 + (height - 1) * width * 4;
                const a = data[idx + 3];
                if (a > 0) {
                    return false;
                }
            }
            return true;
        };
        if (leftIsBlank()) {
            for (let row = 1; row <= height; row++) {
                const idx1 = (width * 4) * (row - 1) + 0;
                const idx2 = idx1 + 4;
                const r = data[idx2];
                const g = data[idx2 + 1];
                const b = data[idx2 + 2];
                const a = data[idx2 + 3];
                data[idx1] = r;
                data[idx1 + 1] = g;
                data[idx1 + 2] = b;
                data[idx1 + 3] = a;
            }
        }
        if (bottomIsBlank()) {
            for (let col = 1; col <= width; col++) {
                const idx1 = (col - 1) * 4 + (height - 1) * width * 4;
                const idx2 = (col - 1) * 4 + (height - 2) * width * 4;
                const r = data[idx2];
                const g = data[idx2 + 1];
                const b = data[idx2 + 2];
                const a = data[idx2 + 3];
                data[idx1] = r;
                data[idx1 + 1] = g;
                data[idx1 + 2] = b;
                data[idx1 + 3] = a;
            }
        }
        // if (topIsBlank()) {
        //     console.log(true);
        //     for (let col = 1; col <= width; col++) {
        //         const idx1 = (col - 1) * 4;
        //         const idx2 = (col - 1) * 4 + width * 4;
        //         const r = data[idx2];
        //         const g = data[idx2 + 1];
        //         const b = data[idx2 + 2];
        //         const a = data[idx2 + 3];
        //         data[idx1] = r;
        //         data[idx1 + 1] = g;
        //         data[idx1 + 2] = b;
        //         data[idx1 + 3] = a;
        //     }
        // }
        ctx.putImageData(imageData, 0, 0);
    }
    function tileTransform(options) {
        return new Promise((resolve, reject) => {
            const { x, y, z, projection, zoomOffset, errorLog, debug, returnBlobURL } = options;
            const returnImage = (opImage) => {
                if (!returnBlobURL) {
                    resolve(opImage);
                }
                else {
                    toBlobURL(opImage).then(blob => {
                        const url = URL.createObjectURL(blob);
                        resolve(url);
                    }).catch(error => {
                        reject(error);
                    });
                }
            };
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
                    returnImage(getBlankTile());
                    return;
                }
                result.loadCount = 0;
                const loadTile = () => {
                    if (result.loadCount >= tiles.length) {
                        const image = mergeTiles(tiles, debug);
                        let image1;
                        if (projection === 'EPSG:4326') {
                            const imageData = tilesImageData(image, result.tilesbbox, result.bbox, projection);
                            image1 = transformTiles(imageData, result.mbbox, debug);
                            returnImage(image1 || getBlankTile());
                        }
                        else {
                            const imageData = tilesImageData(image, result.tilesbbox, result.mbbox, projection);
                            image1 = transformTiles(imageData, result.bbox, debug);
                            returnImage(image1 || getBlankTile());
                        }
                    }
                    else {
                        const tile = tiles[result.loadCount];
                        const [x, y, z] = tile;
                        getTileWithMaxZoom(Object.assign({}, options, { x, y, z, returnBlobURL: false })).then(image => {
                            tile.tileImage = image;
                            result.loadCount++;
                            loadTile();
                        }).catch(error => {
                            if (errorLog) {
                                console.error(error);
                            }
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
    function checkBuffers(image) {
        const buffers = [];
        if (isImageBitmap(image)) {
            buffers.push(image);
        }
        return buffers;
    }
    const onmessage = function (message, postResponse) {
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
            imageSlicing(data).then((result) => {
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
            imageToBlobURL(data).then((result) => {
                postResponse(null, result, []);
            }).catch(error => {
                postResponse(error);
            });
            return;
        }
        if (type === 'encodeTerrainTile') {
            const { url } = data;
            encodeTerrainTile(url, data).then(image => {
                postResponse(null, image, checkBuffers(image));
            }).catch(error => {
                postResponse(error);
            });
            return;
        }
        const errorMessage = 'not support message type:' + type;
        console.error(errorMessage);
        postResponse(createError(errorMessage));
    };

    exports.initialize = initialize;
    exports.onmessage = onmessage;

    Object.defineProperty(exports, '__esModule', { value: true });

})`
