const STORAGE_PREFIX = 'webgl-demo.';

function readFromStorage(key: string): string | null {
  try {
    return localStorage.getItem(STORAGE_PREFIX + key);
  } catch {
    return null;
  }
}

function writeToStorage(key: string, value: string): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + key, value);
  } catch {
    // private browsing or storage quota exceeded
  }
}

export function getStoredNumber(key: string, defaultValue: number): number {
  const raw = readFromStorage(key);
  if (raw === null) return defaultValue;
  const parsed = parseFloat(raw);
  return isFinite(parsed) ? parsed : defaultValue;
}

export function setStoredNumber(key: string, value: number): void {
  writeToStorage(key, String(value));
}
