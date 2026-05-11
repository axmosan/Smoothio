import React, { useCallback, useEffect, useRef, useState } from 'react';
import { CurveData } from '../types';
import { CurveEditorCanvas } from './CurveEditorCanvas';

interface Props {
  curve: CurveData;
  onChange: (curve: CurveData) => void;
  onClose: () => void;
  onAdd: () => void;
  onRemove: () => void;
}

export const PopoutEditor: React.FC<Props> = ({
  curve, onChange, onClose, onAdd, onRemove,
}) => {
  const [pos, setPos] = useState({ x: 40, y: 40 });
  const [size, setSize] = useState({ w: 520, h: 520 });
  const dragRef = useRef<{ startMouse: { x: number; y: number }; startPos: { x: number; y: number } } | null>(null);
  const resizeRef = useRef<{ startMouse: { x: number; y: number }; startSize: { w: number; h: number } } | null>(null);

  const onHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    dragRef.current = { startMouse: { x: e.clientX, y: e.clientY }, startPos: { ...pos } };
  };

  const onResizeMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    e.preventDefault();
    resizeRef.current = { startMouse: { x: e.clientX, y: e.clientY }, startSize: { ...size } };
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startMouse.x;
        const dy = e.clientY - dragRef.current.startMouse.y;
        setPos({
          x: Math.max(0, dragRef.current.startPos.x + dx),
          y: Math.max(0, dragRef.current.startPos.y + dy),
        });
      }
      if (resizeRef.current) {
        const dx = e.clientX - resizeRef.current.startMouse.x;
        const dy = e.clientY - resizeRef.current.startMouse.y;
        setSize({
          w: Math.max(280, resizeRef.current.startSize.w + dx),
          h: Math.max(280, resizeRef.current.startSize.h + dy),
        });
      }
    };
    const onUp = () => {
      dragRef.current = null;
      resizeRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  return (
    <div
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h + 44,
        background: '#1a1a1a',
        border: '1px solid #333',
        borderRadius: 4,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 100,
        boxShadow: '0 8px 32px rgba(0,0,0,0.7)',
        overflow: 'hidden',
      }}
    >
      {/* Header drag bar */}
      <div
        onMouseDown={onHeaderMouseDown}
        style={{
          height: 32,
          background: '#252525',
          borderBottom: '1px solid #333',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          padding: '0 8px',
          cursor: 'move',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: 16,
            lineHeight: 1,
            padding: '2px 6px',
          }}
        >
          ×
        </button>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <CurveEditorCanvas
          curve={curve}
          onChange={onChange}
          gridDivisions={5}

        />
      </div>

      {/* Toolbar */}
      <div
        style={{
          height: 36,
          background: '#1e1e1e',
          borderTop: '1px solid #2a2a2a',
          display: 'flex',
          flexShrink: 0,
        }}
      >
        <button
          onClick={onAdd}
          style={btnStyle}
        >
          +
        </button>
        <button
          onClick={onRemove}
          style={{ ...btnStyle, borderLeft: '1px solid #2a2a2a' }}
        >
          −
        </button>
      </div>

      {/* Resize handle */}
      <div
        onMouseDown={onResizeMouseDown}
        style={{
          position: 'absolute',
          right: 0,
          bottom: 0,
          width: 14,
          height: 14,
          cursor: 'se-resize',
        }}
      />
    </div>
  );
};

const btnStyle: React.CSSProperties = {
  flex: 1,
  background: 'none',
  border: 'none',
  color: '#ccc',
  fontSize: 20,
  cursor: 'pointer',
  fontWeight: 'bold',
};
