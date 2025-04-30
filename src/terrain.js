import { getCanvas, getCanvasContext, resizeCanvas } from './canvas.js';
import { encodeMapBox } from './util.js';
import './zlib.min.js';
import { vec2, vec3 } from 'gl-matrix';

const P0P1 = [];
const P1P2 = [];
const A = [];
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
    const height_buffer = new ArrayBuffer(DataSize);
    const height_view = new DataView(height_buffer);

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
            if (DataSize === 4) {
                NN = DataSize * (jj_n * 150 + ii_n);
                height_view.setInt8(0, dZlib[NN]);
                height_view.setInt8(1, dZlib[NN + 1]);
                height_view.setInt8(2, dZlib[NN + 2]);
                height_view.setInt8(3, dZlib[NN + 3]);
                i_height = height_view.getFloat32(0, true);

            } else {
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

export function generateTiandituTerrain(buffer, terrainWidth, tileSize) {
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

        const p0p1 = vec3.sub(P0P1, this.p1, this.p0);
        const p1p2 = vec3.sub(P1P2, this.p2, this.p1);
        this.normal = vec3.normalize(this.normal, vec3.cross(this.normal, p0p1, p1p2));
    }

    contains(x, y) {
        if (x < this.min[0] || x > this.max[0] || y < this.min[1] || y > this.max[1]) {
            return false;
        }
        vec2.set(A, this.p0[0], this.p0[1]);
        vec2.set(B, this.p1[0], this.p1[1]);
        vec2.set(C, this.p2[0], this.p2[1]);
        const SABC = calTriangleArae(A[0], A[1], B[0], B[1], C[0], C[1]);
        const SPAC = calTriangleArae(x, y, A[0], A[1], C[0], C[1]);
        const SPAB = calTriangleArae(x, y, A[0], A[1], B[0], B[1]);
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

export function cesiumTerrainToHeights(buffer, terrainWidth, tileSize) {
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

export function generateCesiumTerrain(buffer) {
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

export function createTerrainImage(terrainData) {
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

export function transformMapZen(imageData) {
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

export function transformArcgis(result) {
    const { width, height, pixels } = result;
    const canvas = getCanvas();
    resizeCanvas(canvas, width, height);
    const ctx = getCanvasContext(canvas);
    if (!pixels || pixels.length === 0) {
        return null;
    }
    const heights = pixels[0];
    const imageData = ctx.createImageData(width, height);
    for (let i = 0, len = imageData.data.length; i < len; i += 4) {
        const height = heights[i / 4];
        const [r, g, b] = encodeMapBox(height);
        imageData.data[i] = r;
        imageData.data[i + 1] = g;
        imageData.data[i + 2] = b;
        imageData.data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas.transferToImageBitmap();
}

export function transferToQGisGray(imageData, minHeight, maxHeight) {
    const data = imageData.data;
    const ah = (maxHeight - minHeight) / (255 * 255 * 255);
    for (let i = 0, len = data.length; i < len; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const height = b * ah + (g * 255) * ah + (r * 255 * 255) * ah + minHeight;
        const [r1, g1, b1] = encodeMapBox(height);
        data[i] = r1;
        data[i + 1] = g1;
        data[i + 2] = b1;
    }
    return imageData;
}
