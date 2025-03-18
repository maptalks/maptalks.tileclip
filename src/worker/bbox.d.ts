export type BBOXtype = [number, number, number, number];
export declare function bboxIntersect(bbox1: BBOXtype, bbox2: BBOXtype): boolean;
export declare function bboxInBBOX(bbox1: BBOXtype, bbox2: BBOXtype): boolean;
export declare function toPoints(bbox: BBOXtype): number[][];
export declare function toBBOX(points: Array<[number, number]>): BBOXtype;
export declare function bboxOfBBOXList(bboxList: Array<BBOXtype>): BBOXtype;
