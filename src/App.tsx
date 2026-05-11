import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { AppSettings, CurveData, ImportMode, Preset } from './types';
import { CurveEditorCanvas } from './components/CurveEditorCanvas';
import { ImportDialog } from './components/ImportDialog';
import { PresetPanel } from './components/PresetPanel';
import { SavePresetDialog } from './components/SavePresetDialog';
import { SettingsDialog } from './components/SettingsDialog';
import { ToolBar } from './components/ToolBar';
import {
  addMidPoint,
  cloneCurve,
  createDefaultCurve,
  curveToTextBox1,
  curveToTextBox2,
  invertCurve,
  removeMidPoint,
  textBoxesToCurve,
} from './utils/curveUtils';
import { callHost, isInCEP } from './utils/cepBridge';
import {
  copyPresetFile,
  ensureDir,
  getDefaultSaveLocation,
  loadPresetsFromFile,
  openFileDialog,
  savePresetsToFile,
} from './utils/fileUtils';

const STORAGE_PRESETS = 'smoothio_presets';
const STORAGE_SETTINGS = 'smoothio_settings';
const STORAGE_CURVE_SYNC = 'smoothio_curve_sync';

const DEFAULT_SETTINGS: AppSettings = {
  presetSize: 60,
  presetSaveLocation: getDefaultSaveLocation(),
};

function loadSettings(): AppSettings {
  try { const r = localStorage.getItem(STORAGE_SETTINGS); if (r) return { ...DEFAULT_SETTINGS, ...JSON.parse(r) }; } catch {}
  return { ...DEFAULT_SETTINGS };
}
function loadPresets(): Preset[] {
  try { const r = localStorage.getItem(STORAGE_PRESETS); if (r) return JSON.parse(r); } catch {}
  return [];
}
function saveSettings(s: AppSettings) { localStorage.setItem(STORAGE_SETTINGS, JSON.stringify(s)); }
function savePresets(p: Preset[]) { localStorage.setItem(STORAGE_PRESETS, JSON.stringify(p)); }

// Toolbar fixed heights (px) – toolbar + 2 inputs + apply + small borders
const FIXED_H = 36 + 28 + 28 + 44 + 4;

export const App: React.FC = () => {
  const [curve, setCurveRaw] = useState<CurveData>(createDefaultCurve);
  const [text1, setText1] = useState(() => curveToTextBox1(createDefaultCurve()));
  const [text2, setText2] = useState('');
  const [separateDimensions, setSeparateDimensions] = useState(false);
  const [presets, setPresets] = useState<Preset[]>(loadPresets);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [showSave, setShowSave] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [dividerPos, setDividerPos] = useState(0.68);
  const [status, setStatus] = useState('');
  const [graphSide, setGraphSide] = useState(300);

  const leftPanelRef = useRef<HTMLDivElement>(null);
  const dividerRef = useRef<{ startX: number; startPos: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popoutRef = useRef<Window | null>(null);

  // Enforce 1:1 graph ratio
  useLayoutEffect(() => {
    const el = leftPanelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      const side = Math.max(80, Math.min(width, height - FIXED_H));
      setGraphSide(side);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const setCurve = useCallback((c: CurveData) => {
    setCurveRaw(c);
    setText1(curveToTextBox1(c));
    setText2(curveToTextBox2(c));
    // Sync to popout via localStorage (storage event fires only in other windows)
    localStorage.setItem(STORAGE_CURVE_SYNC, JSON.stringify({ curve: c, ts: Date.now() }));
  }, []);

  // Listen for curve changes FROM the popout window
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_CURVE_SYNC || !e.newValue) return;
      try {
        const { curve: c } = JSON.parse(e.newValue);
        setCurveRaw(c);
        setText1(curveToTextBox1(c));
        setText2(curveToTextBox2(c));
      } catch {}
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const handleAdd = () => setCurve(addMidPoint(curve));
  const handleRemove = () => setCurve(removeMidPoint(curve));
  const handleInvert = () => setCurve(invertCurve(curve));
  const handleToggleSep = () => setSeparateDimensions(v => !v);

  const onText1Change = (val: string) => {
    setText1(val);
    const p = textBoxesToCurve(val, text2);
    if (p) { setCurveRaw(p); localStorage.setItem(STORAGE_CURVE_SYNC, JSON.stringify({ curve: p, ts: Date.now() })); }
  };
  const onText2Change = (val: string) => {
    setText2(val);
    const p = textBoxesToCurve(text1, val);
    if (p) { setCurveRaw(p); localStorage.setItem(STORAGE_CURVE_SYNC, JSON.stringify({ curve: p, ts: Date.now() })); }
  };

  const showStatus = (msg: string) => { setStatus(msg); setTimeout(() => setStatus(''), 3000); };

  const handleImportEase = async () => {
    if (!isInCEP()) { showStatus('Not in AE'); return; }
    try {
      const r = await callHost<{ ok: boolean; curve?: CurveData; error?: string }>('smoothio_importEase');
      if (r.ok && r.curve) { setCurve(r.curve); showStatus('Ease imported'); }
      else showStatus(r.error || 'Import failed');
    } catch (e) { showStatus(String(e)); }
  };

  const handleApply = async () => {
    if (!isInCEP()) { showStatus('Not in AE'); return; }
    try {
      const r = await callHost<{ ok: boolean; error?: string }>(
        'smoothio_applyEasing', curve, separateDimensions
      );
      if (!r.ok) showStatus(r.error || 'Apply failed');
    } catch (e) { showStatus(String(e)); }
  };

  const handleResetEase = () => {
    setCurve(createDefaultCurve());
  };

  const handleOpenPopout = () => {
    if (popoutRef.current && !popoutRef.current.closed) {
      try { popoutRef.current.focus(); } catch {}
      return;
    }
    popoutRef.current = null;
    localStorage.setItem(STORAGE_CURVE_SYNC, JSON.stringify({ curve, ts: Date.now() }));
    // Build absolute URL from current page location so it works in CEP file:// context
    const popoutUrl = window.location.href.replace(/[^/]*$/, 'popout.html');
    const w = window.open(popoutUrl, 'smoothio-popout', 'width=580,height=620,resizable=yes');
    popoutRef.current = w;
  };

  const handleSavePreset = (name: string) => {
    const p: Preset = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2),
      name, curve: cloneCurve(curve), createdAt: Date.now(), order: presets.length,
    };
    const next = [...presets, p];
    setPresets(next); savePresets(next); setShowSave(false); showStatus(`Saved: ${name}`);
  };

  const handleDeletePreset = (id: string) => {
    const next = presets.filter(p => p.id !== id);
    setPresets(next); savePresets(next);
  };

  const handleLoadPreset = (preset: Preset) => { setCurve(cloneCurve(preset.curve)); showStatus(`Loaded: ${preset.name}`); };

  const handleExport = () => {
    ensureDir(settings.presetSaveLocation);
    const res = savePresetsToFile(presets, settings.presetSaveLocation);
    showStatus(res.ok ? `Exported` : `Export failed: ${res.error}`);
  };

  const handleImportFile = () => {
    const filePath = openFileDialog(settings.presetSaveLocation);
    if (!filePath) return;
    const res = loadPresetsFromFile(filePath);
    if (!res.ok || !res.data) { showStatus(`Import failed: ${res.error}`); return; }
    copyPresetFile(filePath, settings.presetSaveLocation);
    const next = res.data.presets.map((p, i) => ({ ...p, order: i }));
    setPresets(next); savePresets(next); showStatus(`Imported ${next.length} preset(s)`);
  };

  const handleSaveSettings = (s: AppSettings) => { setSettings(s); saveSettings(s); };
  const handleDeleteAllPresets = () => { setPresets([]); savePresets([]); showStatus('All presets deleted'); };

  // Divider drag
  const onDividerMouseDown = (e: React.MouseEvent) => {
    dividerRef.current = { startX: e.clientX, startPos: dividerPos };
    e.preventDefault();
  };
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dividerRef.current || !containerRef.current) return;
      const totalW = containerRef.current.offsetWidth;
      const dx = e.clientX - dividerRef.current.startX;
      setDividerPos(Math.max(0.3, Math.min(0.82, dividerRef.current.startPos + dx / totalW)));
    };
    const onUp = () => { dividerRef.current = null; };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%', height: '100%',
        display: 'flex',
        background: '#141414',
        color: '#e0e0e0',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        fontSize: 13,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Left panel */}
      <div
        ref={leftPanelRef}
        style={{
          width: `${dividerPos * 100}%`,
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          overflow: 'hidden',
        }}
      >
        {/* 1:1 graph */}
        <div
          style={{
            width: graphSide,
            height: graphSide,
            flexShrink: 0,
            alignSelf: 'center',
          }}
        >
          <CurveEditorCanvas
            curve={curve}
            onChange={setCurve}
            gridDivisions={5}
            />
        </div>

        {/* Spacer to push controls to bottom if graph is smaller than panel width */}
        <div style={{ flex: 1 }} />

        {/* Toolbar */}
        <ToolBar
          onAdd={handleAdd}
          onRemove={handleRemove}
          onImportEase={handleImportEase}
          onInvert={handleInvert}
          separateDimensions={separateDimensions}
          onToggleSeparateDimensions={handleToggleSep}
          onResetEase={handleResetEase}
        />

        {/* Text inputs */}
        <input
          value={text1}
          onChange={e => onText1Change(e.target.value)}
          style={inputStyle}
          placeholder="Curve values…"
          spellCheck={false}
        />
        <input
          value={text2}
          onChange={e => onText2Change(e.target.value)}
          style={{ ...inputStyle, borderTop: '1px solid #111' }}
          placeholder="Midpoint values…"
          spellCheck={false}
        />

        {/* Apply */}
        <button
          onClick={handleApply}
          style={{
            height: 44, background: '#0077ff', border: 'none',
            color: '#fff', fontSize: 15, fontWeight: 700,
            cursor: 'pointer', letterSpacing: 1, flexShrink: 0,
          }}
          onMouseEnter={e => ((e.target as HTMLElement).style.background = '#0055cc')}
          onMouseLeave={e => ((e.target as HTMLElement).style.background = '#0077ff')}
        >
          {status || 'APPLY'}
        </button>
      </div>

      {/* Divider */}
      <div
        onMouseDown={onDividerMouseDown}
        style={{
          width: 6, background: '#1a1a1a', cursor: 'col-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, borderLeft: '1px solid #222', borderRight: '1px solid #222',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {[0, 1, 2].map(i => <div key={i} style={{ width: 3, height: 3, borderRadius: '50%', background: '#444' }} />)}
        </div>
      </div>

      {/* Right panel */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <PresetPanel
          presets={presets}
          presetSize={settings.presetSize}
          onLoadPreset={handleLoadPreset}
          onDeletePreset={handleDeletePreset}
          onSave={() => setShowSave(true)}
          onExport={handleExport}
          onImport={handleImportFile}
          onSettings={() => setShowSettings(true)}
        />
      </div>

      {/* Dialogs */}
      {showSave && <SavePresetDialog curve={curve} onSave={handleSavePreset} onCancel={() => setShowSave(false)} />}
      {showSettings && (
        <SettingsDialog
          settings={settings}
          defaultSettings={DEFAULT_SETTINGS}
          onSave={handleSaveSettings}
          onDeleteAllPresets={handleDeleteAllPresets}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

const inputStyle: React.CSSProperties = {
  width: '100%', height: 28,
  background: '#1a1a1a', border: 'none',
  color: '#888', padding: '0 12px', fontSize: 11,
  outline: 'none', flexShrink: 0,
  fontFamily: '"Consolas", "Courier New", monospace',
};
