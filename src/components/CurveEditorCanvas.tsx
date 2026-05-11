import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { CurveData, DragState, DragTarget, Point } from '../types';
import { buildSvgPath, getAnchorPoints } from '../utils/curveUtils';

interface Props {
  curve: CurveData;
  onChange: (curve: CurveData) => void;
  gridDivisions?: number;
}

const ANCHOR_R = 6;
const HANDLE_R = 4;
const HIT_R = 10;
const PADDING = 20;

export const CurveEditorCanvas: React.FC<Props> = ({
  curve,
  onChange,
  gridDivisions = 5,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 300, h: 300 });
  const [drag, setDrag] = useState<DragState | null>(null);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panRef = useRef<{ startMouse: Point; startPan: Point } | null>(null);

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { w, h } = size;
  const graphW = w - 2 * PADDING;
  const graphH = h - 2 * PADDING;

  // normalized → SVG pixels (accounts for pan)
  const toSvg = useCallback(
    (p: Point): Point => ({
      x: PADDING + (p.x - pan.x) * graphW,
      y: h - PADDING - (p.y - pan.y) * graphH,
    }),
    [graphW, graphH, h, pan]
  );

  // SVG pixels → normalized
  const fromSvg = useCallback(
    (s: Point): Point => ({
      x: s.x / graphW - PADDING / graphW + pan.x,
      y: 1 - (s.y - PADDING) / graphH + pan.y,
    }),
    [graphW, graphH, pan]
  );

  const getSvgPos = (e: MouseEvent | React.MouseEvent): Point => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  // Hit-test: find draggable element under cursor
  const hitTest = useCallback(
    (svgPos: Point): DragTarget | null => {
      for (let i = 0; i < curve.midPoints.length; i++) {
        const sp = toSvg(curve.midPoints[i]);
        const dx = svgPos.x - sp.x, dy = svgPos.y - sp.y;
        if (dx * dx + dy * dy <= HIT_R * HIT_R) return { type: 'midpoint', index: i };
      }
      for (let seg = 0; seg < curve.handles.length; seg++) {
        const outSvg = toSvg(curve.handles[seg].out);
        const inSvg = toSvg(curve.handles[seg].in);
        const dxO = svgPos.x - outSvg.x, dyO = svgPos.y - outSvg.y;
        if (dxO * dxO + dyO * dyO <= HIT_R * HIT_R) return { type: 'handleOut', segIndex: seg };
        const dxI = svgPos.x - inSvg.x, dyI = svgPos.y - inSvg.y;
        if (dxI * dxI + dyI * dyI <= HIT_R * HIT_R) return { type: 'handleIn', segIndex: seg };
      }
      return null;
    },
    [curve, toSvg]
  );

  // Find the nearest ease handle (out or in) to a given SVG position
  const findNearestHandle = useCallback(
    (svgPos: Point): DragTarget | null => {
      let minDist = Infinity;
      let best: DragTarget | null = null;
      for (let seg = 0; seg < curve.handles.length; seg++) {
        const outSvg = toSvg(curve.handles[seg].out);
        const dxO = svgPos.x - outSvg.x, dyO = svgPos.y - outSvg.y;
        const dO = dxO * dxO + dyO * dyO;
        if (dO < minDist) { minDist = dO; best = { type: 'handleOut', segIndex: seg }; }

        const inSvg = toSvg(curve.handles[seg].in);
        const dxI = svgPos.x - inSvg.x, dyI = svgPos.y - inSvg.y;
        const dI = dxI * dxI + dyI * dyI;
        if (dI < minDist) { minDist = dI; best = { type: 'handleIn', segIndex: seg }; }
      }
      return best;
    },
    [curve.handles, toSvg]
  );

  const onMouseDown = (e: React.MouseEvent) => {
    if (e.button === 2) { e.preventDefault(); setPan({ x: 0, y: 0 }); return; }

    const svgPos = getSvgPos(e);

    if (e.button === 1) {
      e.preventDefault();
      panRef.current = { startMouse: svgPos, startPan: { ...pan } };
      setIsPanning(true);
      return;
    }

    if (e.button !== 0) return;
    e.preventDefault();

    const target = hitTest(svgPos);
    if (target) {
      let startValue: Point;
      if (target.type === 'midpoint') startValue = { ...curve.midPoints[target.index] };
      else if (target.type === 'handleOut') startValue = { ...curve.handles[target.segIndex].out };
      else startValue = { ...curve.handles[target.segIndex].in };
      setDrag({ target, startSvgPos: svgPos, startValue });
      return;
    }

    // No direct hit: snap the nearest ease handle to the cursor, then start dragging it
    const nearest = findNearestHandle(svgPos);
    if (!nearest) return;
    const cursorNorm = fromSvg(svgPos);
    const next = JSON.parse(JSON.stringify(curve)) as CurveData;
    if (nearest.type === 'handleOut') next.handles[nearest.segIndex].out = cursorNorm;
    else if (nearest.type === 'handleIn') next.handles[nearest.segIndex].in = cursorNorm;
    onChange(next);
    setDrag({ target: nearest, startSvgPos: svgPos, startValue: cursorNorm });
  };

  // Drag (left button) — update curve
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const svgPos = getSvgPos(e);
      const dx = (svgPos.x - drag.startSvgPos.x) / graphW;
      const dy = -(svgPos.y - drag.startSvgPos.y) / graphH;
      const newVal: Point = { x: drag.startValue.x + dx, y: drag.startValue.y + dy };

      const next = JSON.parse(JSON.stringify(curve)) as CurveData;
      const { target } = drag;
      if (target.type === 'midpoint') next.midPoints[target.index] = newVal;
      else if (target.type === 'handleOut') next.handles[target.segIndex].out = newVal;
      else next.handles[target.segIndex].in = newVal;
      onChange(next);
    };
    const onUp = () => setDrag(null);
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [drag, curve, graphW, graphH, onChange]);

  // Pan (middle button)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!panRef.current) return;
      const svgPos = { x: e.clientX - svgRef.current!.getBoundingClientRect().left,
                       y: e.clientY - svgRef.current!.getBoundingClientRect().top };
      const dx = (svgPos.x - panRef.current.startMouse.x) / graphW;
      const dy = -(svgPos.y - panRef.current.startMouse.y) / graphH;
      setPan({ x: panRef.current.startPan.x - dx, y: panRef.current.startPan.y - dy });
    };
    const onUp = () => { panRef.current = null; setIsPanning(false); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [graphW, graphH]);

  // --- Build grid lines in normalized space, clipped to canvas ---
  const gridLines: React.ReactElement[] = [];
  const nDiv = gridDivisions;
  // Compute which line indices are potentially visible (add buffer of 2)
  const xMin = pan.x, xMax = pan.x + 1;
  const yMin = pan.y, yMax = pan.y + 1;
  const iXStart = Math.floor(xMin * nDiv) - 1;
  const iXEnd   = Math.ceil(xMax * nDiv) + 1;
  const iYStart = Math.floor(yMin * nDiv) - 1;
  const iYEnd   = Math.ceil(yMax * nDiv) + 1;

  for (let i = iXStart; i <= iXEnd; i++) {
    const t = i / nDiv;
    const svgX = toSvg({ x: t, y: 0 }).x;
    gridLines.push(
      <line key={`v${i}`} x1={svgX} y1={PADDING} x2={svgX} y2={h - PADDING}
        stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
    );
  }
  for (let i = iYStart; i <= iYEnd; i++) {
    const t = i / nDiv;
    const svgY = toSvg({ x: 0, y: t }).y;
    gridLines.push(
      <line key={`h${i}`} x1={PADDING} y1={svgY} x2={w - PADDING} y2={svgY}
        stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
    );
  }

  // Highlight 0 and 1 axes (slightly brighter)
  const axis0X = toSvg({ x: 0, y: 0 }).x;
  const axis1X = toSvg({ x: 1, y: 0 }).x;
  const axis0Y = toSvg({ x: 0, y: 0 }).y;
  const axis1Y = toSvg({ x: 0, y: 1 }).y;

  const anchors = getAnchorPoints(curve);
  const curvePath = buildSvgPath(curve, toSvg);

  return (
    <div
      ref={containerRef}
      style={{ width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}
    >
      <svg
        ref={svgRef}
        width={w}
        height={h}
        style={{ display: 'block', userSelect: 'none', cursor: drag ? 'grabbing' : isPanning ? 'grabbing' : 'default' }}
        onMouseDown={onMouseDown}
        onContextMenu={e => { e.preventDefault(); setPan({ x: 0, y: 0 }); }}
      >
        <defs>
          <clipPath id="gc">
            <rect x={PADDING} y={PADDING} width={w - 2 * PADDING} height={h - 2 * PADDING} />
          </clipPath>
        </defs>

        {/* Background */}
        <rect x={0} y={0} width={w} height={h} fill="#0d0d0d" />

        {/* Grid (clipped) */}
        <g clipPath="url(#gc)">
          {gridLines}
          {/* Axis lines (brighter) */}
          <line x1={axis0X} y1={PADDING} x2={axis0X} y2={h - PADDING} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          <line x1={axis1X} y1={PADDING} x2={axis1X} y2={h - PADDING} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          <line x1={PADDING} y1={axis0Y} x2={w - PADDING} y2={axis0Y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />
          <line x1={PADDING} y1={axis1Y} x2={w - PADDING} y2={axis1Y} stroke="rgba(255,255,255,0.18)" strokeWidth={1} />

          {/* Curve */}
          {curvePath && (
            <path d={curvePath} fill="none" stroke="#ffffff" strokeWidth={2} strokeLinecap="round" />
          )}
        </g>

        {/* Canvas border */}
        <rect x={PADDING} y={PADDING} width={w - 2 * PADDING} height={h - 2 * PADDING}
          fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />

        {/* Handle lines (not clipped, so handles outside grid are visible) */}
        {curve.handles.map((hp, seg) => {
          const la = toSvg(anchors[seg]);
          const ra = toSvg(anchors[seg + 1]);
          const outSvg = toSvg(hp.out);
          const inSvg = toSvg(hp.in);
          return (
            <g key={seg}>
              <line x1={la.x} y1={la.y} x2={outSvg.x} y2={outSvg.y} stroke="#0077ff" strokeWidth={1.5} />
              <line x1={ra.x} y1={ra.y} x2={inSvg.x} y2={inSvg.y} stroke="#0077ff" strokeWidth={1.5} />
            </g>
          );
        })}

        {/* Handle endpoints */}
        {curve.handles.map((hp, seg) => {
          const outSvg = toSvg(hp.out);
          const inSvg = toSvg(hp.in);
          return (
            <g key={seg}>
              <circle cx={outSvg.x} cy={outSvg.y} r={HANDLE_R} fill="#0077ff" style={{ cursor: 'grab' }} />
              <circle cx={inSvg.x} cy={inSvg.y} r={HANDLE_R} fill="#0077ff" style={{ cursor: 'grab' }} />
            </g>
          );
        })}

        {/* Fixed anchors: start (0,0) and end (1,1) */}
        {[{ x: 0, y: 0 }, { x: 1, y: 1 }].map((p, i) => {
          const sp = toSvg(p);
          return <circle key={i} cx={sp.x} cy={sp.y} r={ANCHOR_R} fill="#0077ff" stroke="#ffffff" strokeWidth={1.5} />;
        })}

        {/* Midpoint anchors (draggable) */}
        {curve.midPoints.map((mp, i) => {
          const sp = toSvg(mp);
          return <circle key={i} cx={sp.x} cy={sp.y} r={ANCHOR_R} fill="#0077ff" stroke="#ffffff" strokeWidth={1.5} style={{ cursor: 'grab' }} />;
        })}
      </svg>
    </div>
  );
};
