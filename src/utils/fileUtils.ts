import { AppSettings, ExportedPresets, ImportMode, Preset } from '../types';

declare function require(mod: string): unknown;

function getFs()  { try { return require('fs')           as typeof import('fs');           } catch { return null; } }
function getPath(){ try { return require('path')         as typeof import('path');         } catch { return null; } }
function getOs()  { try { return require('os')           as typeof import('os');           } catch { return null; } }
function getCp()  { try { return require('child_process')as typeof import('child_process');} catch { return null; } }

// ── Paths ────────────────────────────────────────────────────────────────────

export function getDefaultSaveLocation(): string {
  try {
    const os = getOs(); const path = getPath();
    if (os && path) return path.join(os.homedir(), 'Documents', 'Smoothio', 'User Presets');
  } catch {}
  return 'C:\\Users\\User\\Documents\\Smoothio\\User Presets';
}

export function getCanonicalPresetsPath(): string {
  try {
    const os = getOs(); const path = getPath();
    if (os && path) return path.join(os.homedir(), 'Documents', 'Smoothio', 'User Presets', 'Smoothio_Presets.json');
  } catch {}
  return 'C:\\Users\\User\\Documents\\Smoothio\\User Presets\\Smoothio_Presets.json';
}

export function ensureDir(dirPath: string): void {
  const fs = getFs();
  if (!fs) return;
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });
}

// ── Read / Write ──────────────────────────────────────────────────────────────

/** Save presets to an exact file path (creates parent dirs as needed). */
export function savePresetsToFile(
  presets: Preset[],
  filePath: string,
): { ok: boolean; error?: string } {
  const fs = getFs(); const path = getPath();
  if (!fs || !path) return { ok: false, error: 'Node.js not available' };
  try {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: ExportedPresets = {
      version: '1.0',
      presets: [...presets].sort((a, b) => a.order - b.order),
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

/** Write current presets to the canonical User Presets location. */
export function autoSaveToCanonical(presets: Preset[]): void {
  savePresetsToFile(presets, getCanonicalPresetsPath());
}

export function loadPresetsFromFile(
  filePath: string,
): { ok: boolean; data?: ExportedPresets; error?: string } {
  const fs = getFs();
  if (!fs) return { ok: false, error: 'Node.js not available' };
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ExportedPresets;
    if (!data.version || !Array.isArray(data.presets)) {
      return { ok: false, error: 'Invalid format' };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function loadPresetsFromCanonical(): { ok: boolean; data?: ExportedPresets } {
  return loadPresetsFromFile(getCanonicalPresetsPath());
}

// ── Settings file (shared between the panel and the separate Settings window) ──
// CEP extensions don't share localStorage, so settings are exchanged through this
// JSON file. `ts` lets each side detect changes made by the other; `command` lets
// the Settings window ask the panel to run an action it can't do itself.

export type SettingsCommand = 'deleteAllPresets' | null;

export interface SettingsFile {
  settings: AppSettings;
  command: SettingsCommand;
  ts: number;
}

export function getCanonicalSettingsPath(): string {
  try {
    const os = getOs(); const path = getPath();
    if (os && path) return path.join(os.homedir(), 'Documents', 'Smoothio', 'settings.json');
  } catch {}
  return 'C:\\Users\\User\\Documents\\Smoothio\\settings.json';
}

/** Write the settings file with a fresh timestamp; returns that ts (or 0 if no fs). */
export function writeSettingsFile(settings: AppSettings, command: SettingsCommand = null): number {
  const fs = getFs(); const path = getPath();
  const ts = Date.now();
  if (!fs || !path) return ts;
  try {
    const p = getCanonicalSettingsPath();
    const dir = path.dirname(p);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data: SettingsFile = { settings, command, ts };
    fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
  return ts;
}

export function readSettingsFile(): SettingsFile | null {
  const fs = getFs();
  if (!fs) return null;
  try {
    const raw = fs.readFileSync(getCanonicalSettingsPath(), 'utf-8');
    const d = JSON.parse(raw) as SettingsFile;
    if (d && d.settings && typeof d.ts === 'number') return d;
  } catch {}
  return null;
}

// ── PowerShell dialogs ────────────────────────────────────────────────────────

/** Execute a PowerShell script written to a temp file; returns stdout trimmed. */
function runPs(lines: string[]): string {
  const fs = getFs(); const path = getPath(); const os = getOs(); const cp = getCp();
  if (!fs || !path || !os || !cp) return '';
  const tmp = path.join(os.tmpdir(), `smoothio_${Date.now()}.ps1`);
  try {
    fs.writeFileSync(tmp, lines.join('\r\n'), 'utf-8');
    return cp.execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmp}"`,
      { timeout: 30000 },
    ).toString().trim();
  } catch {
    return '';
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

export function openFileDialog(defaultPath: string): string | null {
  ensureDir(defaultPath);
  const result = runPs([
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.OpenFileDialog',
    `$d.InitialDirectory = "${defaultPath.replace(/\\/g, '\\\\')}"`,
    '$d.Filter = "JSON Files (*.json)|*.json"',
    '$d.Title = "Import Smoothio Presets"',
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }',
    'else { Write-Output "" }',
  ]);
  return result || null;
}

export function openSaveDialog(defaultDir: string, defaultName: string): string | null {
  const result = runPs([
    'Add-Type -AssemblyName System.Windows.Forms',
    '$d = New-Object System.Windows.Forms.SaveFileDialog',
    `$d.InitialDirectory = "${defaultDir.replace(/\\/g, '\\\\')}"`,
    `$d.FileName = "${defaultName}"`,
    '$d.Filter = "JSON Files (*.json)|*.json"',
    '$d.Title = "Export Smoothio Presets"',
    '$d.OverwritePrompt = $true',
    'if ($d.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $d.FileName }',
    'else { Write-Output "" }',
  ]);
  return result || null;
}

// ── Merge helpers ─────────────────────────────────────────────────────────────

export function mergePresets(
  existing: Preset[],
  incoming: Preset[],
  mode: ImportMode,
): Preset[] {
  if (mode === 'overwriteAll') {
    return incoming.map((p, i) => ({ ...p, order: i }));
  }
  if (mode === 'skip') {
    const names = new Set(existing.map(p => p.name));
    const toAdd = incoming.filter(p => !names.has(p.name));
    return [...existing, ...toAdd].map((p, i) => ({ ...p, order: i }));
  }
  // overwrite: replace same-name, append new
  const byName = new Map(incoming.map(p => [p.name, p]));
  const merged = existing.map(p => byName.has(p.name) ? { ...byName.get(p.name)!, order: p.order } : p);
  const existingNames = new Set(existing.map(p => p.name));
  const toAdd = incoming.filter(p => !existingNames.has(p.name));
  return [...merged, ...toAdd].map((p, i) => ({ ...p, order: i }));
}

/** Extract just the filename (without extension) from a full path. */
export function basename(filePath: string): string {
  return filePath.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? filePath;
}
