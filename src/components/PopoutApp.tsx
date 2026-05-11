import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CurveData } from '../types';
import { CurveEditorCanvas } from './CurveEditorCanvas';
import { addMidPoint, createDefaultCurve, curveToTextBox1, removeMidPoint } from '../utils/curveUtils';

const STORAGE_KEY = 'smoothio_curve_sync';

function readCurve(): CurveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw).curve as CurveData;
  } catch { return null; }
}

export const PopoutApp: React.FC = () => {
  const [curve, setCurveRaw] = useState<CurveData>(() => readCurve() || createDefaultCurve());
  const containerRef = useRef<HTMLDivElement>(null);
  const [graphSide, setGraphSide] = useState(400);

  const setCurve = useCallback((c: CurveData) => {
    setCurveRaw(c);
    // Notify main window via localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ curve: c, ts: Date.now() }));
  }, []);

  // Listen for curve updates FROM the main window
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        const { curve: c } = JSON.parse(e.newValue);
        setCurveRaw(c);
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // 1:1 graph – fill the window
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const TOOLBAR_H = 44;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const side = Math.max(80, Math.min(width, height - TOOLBAR_H));
      setGraphSide(side);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#141414',
        overflow: 'hidden',
      }}
    >
      {/* Graph */}
      <div style={{ width: graphSide, height: graphSide, flexShrink: 0, alignSelf: 'center' }}>
        <CurveEditorCanvas curve={curve} onChange={setCurve} gridDivisions={5} />
      </div>

      <div style={{ flex: 1 }} />

      {/* Toolbar */}
      <div style={{ display: 'flex', height: 44, background: '#252525', flexShrink: 0 }}>
        <PopBtn onClick={() => setCurve(addMidPoint(curve))}>+</PopBtn>
        <PopBtn onClick={() => setCurve(removeMidPoint(curve))}>−</PopBtn>
      </div>
    </div>
  );
};

const PopBtn: React.FC<{ onClick: () => void; children: React.ReactNode }> = ({ onClick, children }) => {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1, height: '100%',
        background: hover ? '#333' : '#252525',
        border: 'none', borderRight: '1px solid #1a1a1a',
        color: '#ccc', fontSize: 22, fontWeight: 700,
        cursor: 'pointer', transition: 'background 0.1s',
      }}
    >
      {children}
    </button>
  );
};
