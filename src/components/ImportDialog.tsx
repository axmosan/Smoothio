import React, { useState } from 'react';
import { ImportMode } from '../types';

interface Props {
  onImport: (mode: ImportMode) => void;
  onCancel: () => void;
}

const MODES: { mode: ImportMode; label: string; description: string }[] = [
  {
    mode: 'skip',
    label: 'Skip if Exis',
    description: 'If there is a conflict with an existing preset, adding that preset will be skipped.',
  },
  {
    mode: 'overwrite',
    label: 'Overwrite if Exis',
    description: 'If there is a conflict with an existing preset, that preset will be overwritten.',
  },
  {
    mode: 'overwriteAll',
    label: 'Overwrite All',
    description: 'All presets will be overwritten.',
  },
];

export const ImportDialog: React.FC<Props> = ({ onImport, onCancel }) => {
  const [selected, setSelected] = useState<ImportMode>('skip');

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ color: '#e0e0e0', fontSize: 20, fontWeight: 600, marginBottom: 4 }}>
          Import Preset Option
        </h2>
        <p style={{ color: '#666', fontSize: 12, marginBottom: 20 }}>
          If there is no conflict with existing presets, they will be kept as is.
        </p>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
          <button onClick={onCancel} style={{ ...btn, background: '#cc2222' }}>
            Cancel
          </button>
          {MODES.map(m => (
            <button
              key={m.mode}
              onClick={() => setSelected(m.mode)}
              style={{
                ...btn,
                background: selected === m.mode ? '#0077ff' : '#2a2a2a',
                border: selected === m.mode ? '1px solid #0055cc' : '1px solid transparent',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div
          style={{
            background: '#111',
            border: '1px solid #2a2a2a',
            borderRadius: 4,
            padding: '10px 14px',
            marginBottom: 20,
          }}
        >
          <p style={{ color: '#ccc', fontSize: 13 }}>
            {MODES.find(m => m.mode === selected)?.description}
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={() => onImport(selected)}
            style={{ ...btn, background: '#0077ff', padding: '6px 24px' }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
};

const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  zIndex: 200,
};

const modal: React.CSSProperties = {
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 6,
  padding: 24,
  minWidth: 360,
  maxWidth: 600,
  boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
};

const btn: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  color: '#fff',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};
