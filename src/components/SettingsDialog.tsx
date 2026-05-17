import React, { useState } from 'react';
import { AppSettings } from '../types';

interface Props {
  settings: AppSettings;
  defaultSettings: AppSettings;
  onSave: (settings: AppSettings) => void;
  onDeleteAllPresets: () => void;
  onClose: () => void;
}

export const SettingsDialog: React.FC<Props> = ({
  settings,
  defaultSettings,
  onSave,
  onDeleteAllPresets,
  onClose,
}) => {
  const [local, setLocal] = useState<AppSettings>({ ...settings });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = () => {
    onSave(local);
    onClose();
  };

  return (
    <div style={overlay}>
      <div style={modal}>
        <h2 style={{ color: '#e0e0e0', fontSize: 20, fontWeight: 600, marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>⚙</span> Setting
        </h2>

        {/* Preset Size */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <label style={{ color: '#ccc', fontSize: 14 }}>Preset Size</label>
            <span style={{ color: '#888', fontSize: 12 }}>{local.presetSize}px</span>
          </div>
          <input
            type="range"
            min={32}
            max={120}
            value={local.presetSize}
            onChange={e => setLocal({ ...local, presetSize: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#0077ff' }}
          />
        </div>

        {/* Preset Save Location */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ color: '#ccc', fontSize: 14, display: 'block', marginBottom: 8 }}>
            Preset Save Location
          </label>
          <input
            type="text"
            value={local.presetSaveLocation}
            onChange={e => setLocal({ ...local, presetSaveLocation: e.target.value })}
            style={{
              width: '100%',
              background: '#1a1a1a',
              border: '1px solid #333',
              borderRadius: 3,
              color: '#888',
              padding: '6px 10px',
              fontSize: 12,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ borderTop: '1px solid #2a2a2a', marginBottom: 20 }} />

        {/* Actions */}
        <div style={{ display: 'flex', gap: 10, marginBottom: 24 }}>
          {confirmDelete ? (
            <>
              <span style={{ color: '#ff4444', fontSize: 13, flex: 1 }}>
                Are you sure? This cannot be undone.
              </span>
              <button
                onClick={() => { onDeleteAllPresets(); setConfirmDelete(false); }}
                style={{ ...actionBtn, background: '#cc2222' }}
              >
                Yes, Delete
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                style={{ ...actionBtn, background: '#333' }}
              >
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setConfirmDelete(true)}
                style={{ ...actionBtn, background: '#cc2222' }}
              >
                Delete All Presets
              </button>
              <button
                onClick={() => setLocal({ ...defaultSettings })}
                style={{ ...actionBtn, background: '#333' }}
              >
                Reset All Preferences
              </button>
            </>
          )}
        </div>

        {/* Close */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={handleSave} style={{ ...actionBtn, background: '#2a2a2a', padding: '7px 36px' }}>
            Close
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
  padding: 10,
};

const modal: React.CSSProperties = {
  background: '#1e1e1e',
  border: '1px solid #333',
  borderRadius: 6,
  padding: 24,
  width: 460,
  maxWidth: 'calc(100vw - 20px)',
  maxHeight: 'calc(100vh - 20px)',
  overflowY: 'auto',
  boxSizing: 'border-box',
  boxShadow: '0 16px 48px rgba(0,0,0,0.8)',
};

const actionBtn: React.CSSProperties = {
  border: 'none',
  borderRadius: 4,
  color: '#ccc',
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
};
