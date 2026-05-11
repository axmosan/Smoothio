export interface Point {
  x: number;
  y: number;
}

export interface HandlePair {
  out: Point;
  in: Point;
}

export interface CurveData {
  midPoints: Point[];
  handles: HandlePair[];
}

export interface Preset {
  id: string;
  name: string;
  curve: CurveData;
  createdAt: number;
  order: number;
}

export interface AppSettings {
  presetSize: number;
  presetSaveLocation: string;
}

export type ImportMode = 'skip' | 'overwrite' | 'overwriteAll';

export type DragTarget =
  | { type: 'midpoint'; index: number }
  | { type: 'handleOut'; segIndex: number }
  | { type: 'handleIn'; segIndex: number };

export interface DragState {
  target: DragTarget;
  startSvgPos: Point;
  startValue: Point;
}

export interface ExportedPresets {
  version: string;
  presets: Preset[];
}
