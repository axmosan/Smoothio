import { ExportedPresets, Preset } from '../types';

declare function require(mod: string): unknown;

function getFs() {
  try {
    return (require('fs') as typeof import('fs'));
  } catch {
    return null;
  }
}
function getPath() {
  try {
    return (require('path') as typeof import('path'));
  } catch {
    return null;
  }
}

export function savePresetsToFile(
  presets: Preset[],
  saveLocation: string
): { ok: boolean; error?: string } {
  const fs = getFs();
  const path = getPath();
  if (!fs || !path) return { ok: false, error: 'Node.js not available' };

  try {
    if (!fs.existsSync(saveLocation)) {
      fs.mkdirSync(saveLocation, { recursive: true });
    }
    const data: ExportedPresets = {
      version: '1.0',
      presets: [...presets].sort((a, b) => a.order - b.order),
    };
    const filePath = path.join(saveLocation, 'Smoothio_Presets.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function loadPresetsFromFile(
  filePath: string
): { ok: boolean; data?: ExportedPresets; error?: string } {
  const fs = getFs();
  if (!fs) return { ok: false, error: 'Node.js not available' };

  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ExportedPresets;
    if (!data.version || !Array.isArray(data.presets)) {
      return { ok: false, error: 'Invalid preset file format' };
    }
    return { ok: true, data };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function openFileDialog(defaultPath: string): string | null {
  try {
    const { execSync } = require('child_process') as typeof import('child_process');
    const script = `
      Add-Type -AssemblyName System.Windows.Forms
      $dlg = New-Object System.Windows.Forms.OpenFileDialog
      $dlg.InitialDirectory = "${defaultPath.replace(/\\/g, '\\\\')}"
      $dlg.Filter = "JSON Files (*.json)|*.json"
      $dlg.Title = "Import Smoothio Presets"
      if ($dlg.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        Write-Output $dlg.FileName
      } else {
        Write-Output ""
      }
    `.trim();
    const result = execSync(`powershell -NoProfile -Command "${script.replace(/"/g, '\\"').replace(/\n/g, ' ')}"`, {
      timeout: 30000,
    }).toString().trim();
    return result || null;
  } catch {
    return null;
  }
}

export function copyPresetFile(
  srcPath: string,
  destDir: string
): { ok: boolean; error?: string } {
  const fs = getFs();
  const path = getPath();
  if (!fs || !path) return { ok: false, error: 'Node.js not available' };
  try {
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const destPath = path.join(destDir, path.basename(srcPath));
    fs.copyFileSync(srcPath, destPath);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

export function ensureDir(dirPath: string): void {
  const fs = getFs();
  if (!fs) return;
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

export function getDefaultSaveLocation(): string {
  try {
    const os = require('os') as typeof import('os');
    const path = getPath();
    if (path) {
      return path.join(os.homedir(), 'Documents', 'Smoothio', 'User Presets');
    }
  } catch {
    //
  }
  return 'C:\\Users\\User\\Documents\\Smoothio\\User Presets';
}
