import React, { useEffect, useState } from 'react';
import { Preset } from '../types';
import { PresetCard } from './PresetCard';

interface Props {
  presets: Preset[];
  presetSize: number;
  onLoadPreset: (preset: Preset) => void;
  onDeletePreset: (id: string) => void;
  onSave: () => void;
  onExport: () => void;
  onImport: () => void;
  onSettings: () => void;
}

function SvgBtn({
  src,
  title,
  onClick,
}: {
  src: string;
  title: string;
  onClick: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 32,
        height: 32,
        background: hover ? '#333' : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.1s',
      }}
    >
      <img
        src={src}
        alt={title}
        style={{ width: 18, height: 18, filter: 'invert(1)', pointerEvents: 'none' }}
      />
    </button>
  );
}

export const PresetPanel: React.FC<Props> = ({
  presets,
  presetSize,
  onLoadPreset,
  onDeletePreset,
  onSave,
  onExport,
  onImport,
  onSettings,
}) => {
  const [isAltHeld, setIsAltHeld] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Alt') setIsAltHeld(e.type === 'keydown');
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
    };
  }, []);

  const sorted = [...presets].sort((a, b) => a.order - b.order);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: '#141414',
        overflow: 'hidden',
      }}
    >
      {/* Action buttons */}
      <div
        style={{
          display: 'flex',
          gap: 2,
          padding: '4px 8px',
          borderBottom: '1px solid #222',
          flexShrink: 0,
          justifyContent: 'flex-end',
        }}
      >
        <SvgBtn src="icons/save.svg" title="Save Preset" onClick={onSave} />
        <SvgBtn src="icons/export.svg" title="Export Presets" onClick={onExport} />
        <SvgBtn src="icons/import.svg" title="Import Presets" onClick={onImport} />
        <button
          title="Settings"
          onClick={onSettings}
          style={{
            width: 32,
            height: 32,
            background: 'transparent',
            border: 'none',
            borderRadius: 4,
            cursor: 'pointer',
            color: '#ccc',
            fontSize: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ⚙
        </button>
      </div>

      {/* Preset grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 4px',
          display: 'flex',
          flexWrap: 'wrap',
          alignContent: 'flex-start',
          gap: 4,
        }}
      >
        {sorted.map(preset => (
          <PresetCard
            key={preset.id}
            preset={preset}
            size={presetSize}
            isAltHeld={isAltHeld}
            onClick={() => onLoadPreset(preset)}
            onDelete={() => onDeletePreset(preset.id)}
          />
        ))}
      </div>
    </div>
  );
};
