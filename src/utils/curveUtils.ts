import { CurveData, HandlePair, Point } from '../types';

export function createDefaultCurve(): CurveData {
  return {
    midPoints: [],
    handles: [{ out: { x: 0.25, y: 0.25 }, in: { x: 0.75, y: 0.75 } }],
  };
}

export function numSegments(curve: CurveData): number {
  return curve.midPoints.length + 1;
}

export function getAnchorPoints(curve: CurveData): Point[] {
  return [{ x: 0, y: 0 }, ...curve.midPoints, { x: 1, y: 1 }];
}

export function addMidPoint(curve: CurveData): CurveData {
  const anchors = getAnchorPoints(curve);
  const midSegIndex = Math.floor(curve.midPoints.length / 2);

  const leftAnchor = anchors[midSegIndex];
  const rightAnchor = anchors[midSegIndex + 1];
  const existingHandle = curve.handles[midSegIndex];

  const newMid: Point = {
    x: (leftAnchor.x + rightAnchor.x) / 2,
    y: (leftAnchor.y + rightAnchor.y) / 2,
  };

  const newHandle1: HandlePair = {
    out: {
      x: leftAnchor.x + (existingHandle.out.x - leftAnchor.x) * 0.5,
      y: leftAnchor.y + (existingHandle.out.y - leftAnchor.y) * 0.5,
    },
    in: {
      x: newMid.x - (rightAnchor.x - existingHandle.in.x) * 0.25,
      y: newMid.y - (rightAnchor.y - existingHandle.in.y) * 0.25,
    },
  };

  const newHandle2: HandlePair = {
    out: {
      x: newMid.x + (rightAnchor.x - existingHandle.in.x) * 0.25,
      y: newMid.y + (rightAnchor.y - existingHandle.in.y) * 0.25,
    },
    in: {
      x: existingHandle.in.x + (rightAnchor.x - existingHandle.in.x) * 0.5,
      y: existingHandle.in.y + (rightAnchor.y - existingHandle.in.y) * 0.5,
    },
  };

  return {
    midPoints: [
      ...curve.midPoints.slice(0, midSegIndex),
      newMid,
      ...curve.midPoints.slice(midSegIndex),
    ],
    handles: [
      ...curve.handles.slice(0, midSegIndex),
      newHandle1,
      newHandle2,
      ...curve.handles.slice(midSegIndex + 1),
    ],
  };
}

export function removeMidPoint(curve: CurveData): CurveData {
  if (curve.midPoints.length === 0) return curve;

  const removeIndex = Math.floor((curve.midPoints.length - 1) / 2);

  const mergedHandle: HandlePair = {
    out: curve.handles[removeIndex].out,
    in: curve.handles[removeIndex + 1].in,
  };

  return {
    midPoints: [
      ...curve.midPoints.slice(0, removeIndex),
      ...curve.midPoints.slice(removeIndex + 1),
    ],
    handles: [
      ...curve.handles.slice(0, removeIndex),
      mergedHandle,
      ...curve.handles.slice(removeIndex + 2),
    ],
  };
}

export function invertCurve(curve: CurveData): CurveData {
  // Reflect the curve around the diagonal y=x: swap x and y of every control point.
  // (0,0) and (1,1) lie on y=x so anchors stay fixed; ease-out ↔ ease-in.
  return {
    midPoints: curve.midPoints.map(p => ({ x: p.y, y: p.x })),
    handles: curve.handles.map(h => ({
      out: { x: h.out.y, y: h.out.x },
      in:  { x: h.in.y,  y: h.in.x  },
    })),
  };
}

function r2(v: number): number {
  return Math.round(v * 100) / 100;
}

export function curveToTextBox1(curve: CurveData): string {
  return curve.handles
    .map(h => [r2(h.out.x), r2(h.out.y), r2(h.in.x), r2(h.in.y)].join(','))
    .join(',');
}

export function curveToTextBox2(curve: CurveData): string {
  return curve.midPoints.map(p => `${r2(p.x)},${r2(p.y)}`).join(',');
}

export function textBoxesToCurve(
  text1: string,
  text2: string
): CurveData | null {
  const mids = text2.trim()
    ? text2.split(',').map(s => parseFloat(s.trim()))
    : [];
  if (text2.trim() && (mids.length % 2 !== 0 || mids.some(isNaN))) return null;

  const midPoints: Point[] = [];
  for (let i = 0; i < mids.length; i += 2) {
    midPoints.push({ x: mids[i], y: mids[i + 1] });
  }

  const numSegs = midPoints.length + 1;
  const vals = text1.split(',').map(s => parseFloat(s.trim()));
  if (vals.length !== numSegs * 4 || vals.some(isNaN)) return null;

  const handles: HandlePair[] = [];
  for (let i = 0; i < numSegs; i++) {
    handles.push({
      out: { x: vals[i * 4], y: vals[i * 4 + 1] },
      in: { x: vals[i * 4 + 2], y: vals[i * 4 + 3] },
    });
  }

  return { midPoints, handles };
}

export function buildSvgPath(
  curve: CurveData,
  toSvg: (p: Point) => Point
): string {
  const anchors = getAnchorPoints(curve);
  let d = '';

  for (let i = 0; i < curve.handles.length; i++) {
    const a0 = toSvg(anchors[i]);
    const a1 = toSvg(anchors[i + 1]);
    const cp1 = toSvg(curve.handles[i].out);
    const cp2 = toSvg(curve.handles[i].in);

    if (i === 0) d += `M ${a0.x.toFixed(2)} ${a0.y.toFixed(2)}`;
    d += ` C ${cp1.x.toFixed(2)} ${cp1.y.toFixed(2)} ${cp2.x.toFixed(2)} ${cp2.y.toFixed(2)} ${a1.x.toFixed(2)} ${a1.y.toFixed(2)}`;
  }
  return d;
}

export function cloneCurve(curve: CurveData): CurveData {
  return JSON.parse(JSON.stringify(curve));
}
