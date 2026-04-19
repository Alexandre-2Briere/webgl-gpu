import { describe, it, expect, vi, afterEach } from 'vitest';
import { hexToRGBA, rgbToHex, rgbaToHex, type RGBA } from './color';

afterEach(() => {
  vi.restoreAllMocks();
});

// ── hexToRGBA ─────────────────────────────────────────────────────────────────

describe('hexToRGBA', () => {
  it('converts a valid 6-character lowercase hex string to RGBA', () => {
    expect(hexToRGBA('#ff8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it('converts a valid 6-character uppercase hex string to RGBA', () => {
    expect(hexToRGBA('#FF8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it('converts a valid mixed-case hex string to RGBA', () => {
    expect(hexToRGBA('#Ff8800')).toEqual({ r: 255, g: 136, b: 0, a: 1 });
  });

  it('converts all-zero hex to { r:0, g:0, b:0, a:1 }', () => {
    expect(hexToRGBA('#000000')).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('converts all-maximum hex to { r:255, g:255, b:255, a:1 }', () => {
    expect(hexToRGBA('#ffffff')).toEqual({ r: 255, g: 255, b: 255, a: 1 });
  });

  it('always sets alpha to 1 for a valid 6-character hex', () => {
    const result = hexToRGBA('#123456');
    expect(result.a).toBe(1);
  });

  it('calls console.error and returns the fallback for an invalid hex string', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = hexToRGBA('#GGGGGG' as `#${string}`);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('calls console.error and returns the fallback for a string missing the leading #', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = hexToRGBA('ff0000' as `#${string}`);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('calls console.error and returns the fallback for a non-hex string', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = hexToRGBA('#not-hex' as `#${string}`);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });

  it('calls console.error and returns the fallback for an empty string', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = hexToRGBA('' as `#${string}`);
    expect(errorSpy).toHaveBeenCalledOnce();
    expect(result).toEqual({ r: 0, g: 0, b: 0, a: 1 });
  });
});

// ── rgbToHex ──────────────────────────────────────────────────────────────────

describe('rgbToHex', () => {
  it('converts a basic RGBA value to a 6-character uppercase hex string', () => {
    const color: RGBA = { r: 255, g: 0, b: 0, a: 1 };
    expect(rgbToHex(color)).toBe('#FF0000');
  });

  it('converts all-zero RGB channels to "#000000"', () => {
    const color: RGBA = { r: 0, g: 0, b: 0, a: 1 };
    expect(rgbToHex(color)).toBe('#000000');
  });

  it('pads single-digit hex values with a leading zero', () => {
    const color: RGBA = { r: 1, g: 2, b: 3, a: 1 };
    expect(rgbToHex(color)).toBe('#010203');
  });

  it('converts all-maximum RGB channels to "#FFFFFF"', () => {
    const color: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    expect(rgbToHex(color)).toBe('#FFFFFF');
  });

  it('result starts with # and is 7 characters long', () => {
    const color: RGBA = { r: 16, g: 32, b: 48, a: 1 };
    const result = rgbToHex(color);
    expect(result.startsWith('#')).toBe(true);
    expect(result).toHaveLength(7);
  });
});

// ── rgbaToHex ─────────────────────────────────────────────────────────────────

describe('rgbaToHex', () => {
  it('appends the alpha channel as two uppercase hex digits after the RGB hex', () => {
    const color: RGBA = { r: 255, g: 0, b: 0, a: 16 };
    expect(rgbaToHex(color)).toBe('#FF000010');
  });

  it('converts all-zero RGBA channels to "#00000000"', () => {
    const color: RGBA = { r: 0, g: 0, b: 0, a: 0 };
    expect(rgbaToHex(color)).toBe('#00000000');
  });

  it('pads a single-digit alpha value with a leading zero', () => {
    const color: RGBA = { r: 255, g: 255, b: 255, a: 1 };
    expect(rgbaToHex(color)).toBe('#FFFFFF01');
  });

  it('produces a 9-character string (# + 6 RGB digits + 2 alpha digits)', () => {
    const color: RGBA = { r: 16, g: 32, b: 48, a: 64 };
    const result = rgbaToHex(color);
    expect(result).toHaveLength(9);
  });

  it('the first 7 characters of the result match the rgbToHex output for the same color', () => {
    const color: RGBA = { r: 100, g: 150, b: 200, a: 128 };
    expect(rgbaToHex(color).slice(0, 7)).toBe(rgbToHex(color));
  });
});
