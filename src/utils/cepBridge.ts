declare global {
  interface Window {
    CSInterface?: new () => { evalScript(s: string, cb: (r: string) => void): void };
    __adobe_cep__?: { evalScript(s: string, cb: (r: string) => void): void };
  }
}

let _cs: { evalScript(s: string, cb: (r: string) => void): void } | null = null;

function getCS() {
  if (_cs) return _cs;
  if (window.CSInterface) {
    try { _cs = new window.CSInterface(); return _cs; } catch { /**/ }
  }
  if (window.__adobe_cep__) {
    _cs = window.__adobe_cep__;
    return _cs;
  }
  return null;
}

export function isInCEP(): boolean {
  return !!(window.CSInterface || window.__adobe_cep__);
}

export function evalScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const cs = getCS();
    if (!cs) { reject(new Error('CSInterface not available')); return; }
    cs.evalScript(script, (result: string) => {
      if (result === 'EvalScript error.') reject(new Error('ExtendScript error'));
      else resolve(result ?? '');
    });
  });
}

export async function callHost<T = unknown>(fn: string, ...args: unknown[]): Promise<T> {
  const argsStr = args.map(a => JSON.stringify(a)).join(', ');
  const raw = await evalScript(`${fn}(${argsStr})`);
  return JSON.parse(raw) as T;
}
