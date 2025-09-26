
export type BBOXtype = [number, number, number, number];
export function bboxIntersect(bbox1: BBOXtype, bbox2: BBOXtype) {
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

export function getBBOXCenter(bbox: BBOXtype): [number, number] {
    const x = (bbox[0] + bbox[2]) / 2;
    const y = (bbox[1] + bbox[3]) / 2;
    return [x, y];
}

export function pointInBBOX(point: [number, number], bbox: BBOXtype) {
    const [minx, miny, maxx, maxy] = bbox;
    const [x, y] = point;
    return x >= minx && x <= maxx && y >= miny && y <= maxy;
}

export function bboxInBBOX(bbox1: BBOXtype, bbox2: BBOXtype) {
    const [x1, y1, x2, y2] = bbox1;
    return x1 >= bbox2[0] && x2 <= bbox2[2] && y1 >= bbox2[1] && y2 <= bbox2[3];
}

export function bboxToPoints(bbox: BBOXtype) {
    const [minx, miny, maxx, maxy] = bbox;
    return [
        [minx, miny],
        [maxx, miny],
        [maxx, maxy],
        [minx, maxy]
    ];
}

export function pointsToBBOX(points: Array<[number, number]>): BBOXtype {
    let xmin = Infinity, ymin = Infinity, xmax = -Infinity, ymax = -Infinity;
    points.forEach(point => {
        xmin = Math.min(xmin, point[0]);
        xmax = Math.max(xmax, point[0]);
        ymin = Math.min(ymin, point[1]);
        ymax = Math.max(ymax, point[1]);
    });
    return [xmin, ymin, xmax, ymax];

}

export function bboxOfBBOXList(bboxList: Array<BBOXtype>): BBOXtype {
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
