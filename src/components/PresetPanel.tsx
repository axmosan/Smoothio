import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Preset } from '../types';
import { PresetCard } from './PresetCard';

const DRAG_THRESHOLD = 6; // px before drag starts
const FLIP_DURATION  = 180; // ms for card swap animation

interface Props {
  presets: Preset[];
  presetSize: number;
  onLoadPreset: (preset: Preset) => void;
  onDeletePreset: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onSettings: () => void;
  onReorderPresets: (reordered: Preset[]) => void;
}

function SvgBtn({ src, title, onClick }: { src: string; title: string; onClick: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32, height: 32,
        background: hover ? '#333' : 'transparent',
        border: 'none', borderRadius: 4, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 0, transition: 'background 0.1s',
      }}
    >
      <img src={src} alt={title} style={{ width: 18, height: 18, filter: 'invert(1)', pointerEvents: 'none' }} />
    </button>
  );
}

export const PresetPanel: React.FC<Props> = ({
  presets, presetSize,
  onLoadPreset, onDeletePreset,
  onSave, onExport, onImport, onSettings,
  onReorderPresets,
}) => {
  const [isAltHeld, setIsAltHeld] = useState(false);
  const [dragId,    setDragId]    = useState<string | null>(null);
  const [overIdx,   setOverIdx]   = useState<number | null>(null);

  // Stable refs for window event handlers
  const pendingRef    = useRef<{ id: string; startX: number; startY: number } | null>(null);
  const dragIdRef     = useRef<string | null>(null);
  const overIdxRef    = useRef<number | null>(null);
  const sortedRef     = useRef<Preset[]>([]);
  const isAltHeldRef  = useRef(false);
  const didDragRef    = useRef(false);

  // Card DOM refs for FLIP animation
  const cardRefs          = useRef<Map<string, HTMLDivElement>>(new Map());
  const pendingSnapshotRef = useRef<Map<string, DOMRect> | null>(null);

  const sorted = useMemo(() => [...presets].sort((a, b) => a.order - b.order), [presets]);
  sortedRef.current = sorted;

  // Live visual reorder while dragging
  const displayPresets = useMemo(() => {
    if (dragId === null || overIdx === null) return sorted;
    const fromIdx = sorted.findIndex(p => p.id === dragId);
    if (fromIdx === -1 || fromIdx === overIdx) return sorted;
    const arr = [...sorted];
    const [item] = arr.splice(fromIdx, 1);
    arr.splice(overIdx, 0, item);
    return arr;
  }, [sorted, dragId, overIdx]);

  // FLIP: run after displayPresets DOM mutations, animate using stored snapshot
  useLayoutEffect(() => {
    const snapshot = pendingSnapshotRef.current;
    pendingSnapshotRef.current = null;
    if (!snapshot) return;

    cardRefs.current.forEach((el, id) => {
      const oldRect = snapshot.get(id);
      if (!oldRect) return;
      const newRect = el.getBoundingClientRect();
      const dx = oldRect.left - newRect.left;
      const dy = oldRect.top  - newRect.top;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return;

      el.style.transform  = `translate(${dx}px,${dy}px)`;
      el.style.transition = 'none';
      void el.getBoundingClientRect(); // force reflow
      el.style.transition = `transform ${FLIP_DURATION}ms ease`;
      el.style.transform  = '';
    });
  }, [displayPresets]);

  // Mouse enters a card while dragging → snapshot + update overIdx
  const handleCardMouseEnter = useCallback((id: string, idx: number) => {
    if (dragIdRef.current === null || id === dragIdRef.current) return;
    // Snapshot current positions before state update
    const snapshot = new Map<string, DOMRect>();
    cardRefs.current.forEach((el, cid) => snapshot.set(cid, el.getBoundingClientRect()));
    pendingSnapshotRef.current = snapshot;
    overIdxRef.current = idx;
    setOverIdx(idx);
  }, []);

  // Card mousedown → start pending drag
  const handleCardPointerDown = useCallback((id: string, e: React.MouseEvent) => {
    if (dragIdRef.current !== null) return;
    pendingRef.current = { id, startX: e.clientX, startY: e.clientY };
  }, []);

  // Global mousemove: cross threshold → promote pending to drag
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const p = pendingRef.current;
      if (!p || dragIdRef.current !== null) return;
      const dist = Math.hypot(e.clientX - p.startX, e.clientY - p.startY);
      if (dist < DRAG_THRESHOLD) return;
      pendingRef.current = null;
      const startIdx = sortedRef.current.findIndex(pr => pr.id === p.id);
      dragIdRef.current  = p.id;
      overIdxRef.current = startIdx;
      setDragId(p.id);
      setOverIdx(startIdx);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  // Global mouseup: commit drag OR let click fall through for activation
  useEffect(() => {
    const onUp = () => {
      // Pending but threshold not crossed → natural click will fire, just clear
      if (pendingRef.current) {
        pendingRef.current = null;
        return;
      }
      if (dragIdRef.current === null) return;

      // Commit reorder
      const cur      = sortedRef.current;
      const fromIdx  = cur.findIndex(p => p.id === dragIdRef.current);
      const toIdx    = overIdxRef.current ?? fromIdx;
      if (fromIdx !== -1 && fromIdx !== toIdx) {
        const arr = [...cur];
        const [item] = arr.splice(fromIdx, 1);
        arr.splice(toIdx, 0, item);
        onReorderPresets(arr.map((p, i) => ({ ...p, order: i })));
      }

      didDragRef.current = true; // suppress the click that follows mouseup
      dragIdRef.current  = null;
      overIdxRef.current = null;
      setDragId(null);
      setOverIdx(null);
    };
    window.addEventListener('mouseup', onUp);
    return () => window.removeEventListener('mouseup', onUp);
  }, [onReorderPresets]);

  // Grabbing cursor on body while dragging
  useEffect(() => {
    if (dragId) {
      document.body.style.cursor     = 'grabbing';
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    }
    return () => {
      document.body.style.cursor     = '';
      document.body.style.userSelect = '';
    };
  }, [dragId]);

  // Alt key tracking
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Alt') return;
      const held = e.type === 'keydown';
      isAltHeldRef.current = held;
      setIsAltHeld(held);
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#141414', overflow: 'hidden' }}>
      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 2, padding: '4px 8px', borderBottom: '1px solid #222', flexShrink: 0, justifyContent: 'flex-end' }}>
        <SvgBtn src="icons/save.svg"   title="Save Preset"     onClick={onSave} />
        <SvgBtn src="icons/export.svg" title="Export Presets"  onClick={onExport} />
        <SvgBtn src="icons/import.svg" title="Import Presets"  onClick={onImport} />
        <button
          title="Settings"
          onClick={onSettings}
          style={{ width: 32, height: 32, background: 'transparent', border: 'none', borderRadius: 4, cursor: 'pointer', color: '#ccc', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ⚙
        </button>
      </div>

      {/* Preset grid */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px', display: 'flex', flexWrap: 'wrap', alignContent: 'flex-start', gap: 4 }}>
        {displayPresets.map((preset, idx) => (
          <PresetCard
            key={preset.id}
            ref={el => { if (el) cardRefs.current.set(preset.id, el); else cardRefs.current.delete(preset.id); }}
            preset={preset}
            size={presetSize}
            isAltHeld={isAltHeld}
            isDragging={dragId === preset.id}
            onClick={() => {
              if (didDragRef.current) { didDragRef.current = false; return; }
              if (isAltHeldRef.current) onDeletePreset(preset.id);
              else onLoadPreset(preset);
            }}
            onPointerDown={e => handleCardPointerDown(preset.id, e)}
            onCardMouseEnter={() => handleCardMouseEnter(preset.id, idx)}
          />
        ))}
      </div>
    </div>
  );
};
