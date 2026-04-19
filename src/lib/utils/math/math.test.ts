import { describe, it, expect } from 'vitest';
import { safeParseInt, safeParseFloat } from './math';

// ── safeParseInt ──────────────────────────────────────────────────────────────

describe('safeParseInt', () => {
  it('returns the integer for a valid integer string', () => {
    expect(safeParseInt('42')).toBe(42);
  });

  it('returns the integer for a valid negative integer string', () => {
    expect(safeParseInt('-7')).toBe(-7);
  });

  it('truncates a float string to its integer part', () => {
    expect(safeParseInt('3.9')).toBe(3);
  });

  it('returns the default value of 0 for an empty string', () => {
    expect(safeParseInt('')).toBe(0);
  });

  it('returns the default value of 0 for a non-numeric string', () => {
    expect(safeParseInt('abc')).toBe(0);
  });

  it('returns the explicit defaultValue when the string is non-numeric', () => {
    expect(safeParseInt('abc', 99)).toBe(99);
  });

  it('does not parse hex notation — stops at the "x" and returns 0', () => {
    // parseInt("0xFF", 10) stops at "x" and returns 0, which is not NaN,
    // so the result is 0 rather than 255.
    expect(safeParseInt('0xFF')).toBe(0);
  });

  it('handles leading zeros correctly under base-10', () => {
    expect(safeParseInt('007')).toBe(7);
  });

  it('returns the default value of 0 for a whitespace-only string', () => {
    expect(safeParseInt(' ')).toBe(0);
  });

  it('returns 0 for the string "0"', () => {
    expect(safeParseInt('0')).toBe(0);
  });
});

// ── safeParseFloat ────────────────────────────────────────────────────────────

describe('safeParseFloat', () => {
  it('returns the float for a valid float string', () => {
    expect(safeParseFloat('3.14')).toBeCloseTo(3.14);
  });

  it('returns the integer for an integer string', () => {
    expect(safeParseFloat('42')).toBe(42);
  });

  it('returns the float for a valid negative float string', () => {
    expect(safeParseFloat('-1.5')).toBeCloseTo(-1.5);
  });

  it('returns the default value of 0 for an empty string', () => {
    expect(safeParseFloat('')).toBe(0);
  });

  it('returns the default value of 0 for a non-numeric string', () => {
    expect(safeParseFloat('abc')).toBe(0);
  });

  it('returns the explicit defaultValue when the string is non-numeric', () => {
    expect(safeParseFloat('abc', 99.9)).toBeCloseTo(99.9);
  });

  it('parses scientific notation correctly', () => {
    expect(safeParseFloat('1e2')).toBe(100);
  });

  it('returns 0 for the string "0"', () => {
    expect(safeParseFloat('0')).toBe(0);
  });
});
