import React from 'react';

interface Props {
  onAdd: () => void;
  onRemove: () => void;
  onImportEase: () => void;
  onInvert: () => void;
  separateDimensions: boolean;
  onToggleSeparateDimensions: () => void;
  onResetEase: () => void;
}

function Btn({
  onClick,
  title,
  flex,
  children,
  active,
}: {
  onClick: () => void;
  title: string;
  flex: number;
  children: React.ReactNode;
  active?: boolean;
}) {
  const [hover, setHover] = React.useState(false);
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex,
        height: '100%',
        background: active ? '#1a3a5a' : hover ? '#333' : '#252525',
        border: 'none',
        borderRight: '1px solid #1a1a1a',
        color: '#ccc',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
        transition: 'background 0.1s',
        minWidth: 0,
      }}
    >
      {children}
    </button>
  );
}

// SVG icon: do NOT apply any filter for Combine/Separate (they already have correct colors)
// Apply brightness(0) invert(1) for monochrome dark-fill icons → white
function Icon({ src, rotate, raw }: { src: string; rotate?: number; raw?: boolean }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{
        width: 18,
        height: 18,
        filter: raw ? 'none' : 'brightness(0) invert(1)',
        transform: rotate ? `rotate(${rotate}deg)` : undefined,
        pointerEvents: 'none',
        display: 'block',
      }}
    />
  );
}

export const ToolBar: React.FC<Props> = ({
  onAdd, onRemove, onImportEase, onInvert,
  separateDimensions, onToggleSeparateDimensions, onResetEase,
}) => (
  <div style={{ display: 'flex', height: 36, background: '#252525', flexShrink: 0 }}>
    <Btn onClick={onAdd} title="Add midpoint" flex={3}>
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>+</span>
    </Btn>
    <Btn onClick={onRemove} title="Remove midpoint" flex={3}>
      <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>−</span>
    </Btn>
    <Btn onClick={onImportEase} title="Import Ease from selected keyframes" flex={2}>
      <Icon src="icons/inport-ease.svg" rotate={-90} />
    </Btn>
    <Btn onClick={onInvert} title="Invert Graph" flex={2}>
      <Icon src="icons/invert.svg" />
    </Btn>
    <Btn
      onClick={onToggleSeparateDimensions}
      title={separateDimensions ? 'Separate Dimensions (ON)' : 'Combine Dimensions'}
      flex={2}
      active={separateDimensions}
    >
      {/* raw=true: these SVGs have built-in colors, don't invert */}
      <Icon
        src={separateDimensions ? 'icons/Separate Dimensions.svg' : 'icons/Combine Dimensions.svg'}
        raw={true}
      />
    </Btn>
    <Btn onClick={onResetEase} title="Reset Ease to Linear" flex={2}>
      <span style={{ fontSize: 14, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1 }}>0</span>
    </Btn>
  </div>
);
