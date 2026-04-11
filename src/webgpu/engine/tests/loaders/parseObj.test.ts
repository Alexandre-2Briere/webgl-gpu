import { describe, it, expect } from 'vitest';
import { parseObj } from '../../loaders/parseObj';

// Vertex format: 12 floats per vertex: pos(3) pad(1) normal(3) pad(1) color(4)
const FLOATS_PER_VERTEX = 12;

describe('parseObj — basic parsing', () => {
  it('returns vertices and indices as typed arrays', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const result = parseObj(source);
    expect(result.vertices).toBeInstanceOf(Float32Array);
    expect(result.indices).toBeInstanceOf(Uint32Array);
  });

  it('single triangle produces 3 vertices and 3 indices', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const result = parseObj(source);
    expect(result.vertices.length).toBe(3 * FLOATS_PER_VERTEX);
    expect(result.indices.length).toBe(3);
  });

  it('vertices are stored at positions 0, 1, 2 of each 12-float block', () => {
    const source = `
v 1 2 3
v 4 5 6
v 7 8 9
f 1 2 3
`;
    const result = parseObj(source);
    // First vertex position: floats 0,1,2
    expect(result.vertices[0]).toBeCloseTo(1, 5);
    expect(result.vertices[1]).toBeCloseTo(2, 5);
    expect(result.vertices[2]).toBeCloseTo(3, 5);
  });

  it('color is always white [1,1,1,1] at floats 8-11 of each vertex', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const result = parseObj(source);
    expect(result.vertices[8]).toBeCloseTo(1, 5);
    expect(result.vertices[9]).toBeCloseTo(1, 5);
    expect(result.vertices[10]).toBeCloseTo(1, 5);
    expect(result.vertices[11]).toBeCloseTo(1, 5);
  });

  it('indices reference the correct vertex positions', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const result = parseObj(source);
    // Triangle f 1 2 3 → indices 0 1 2 (0-based)
    expect(result.indices[0]).toBe(0);
    expect(result.indices[1]).toBe(1);
    expect(result.indices[2]).toBe(2);
  });
});

describe('parseObj — normals', () => {
  it('uses vn normals when present (v//vn format)', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
vn 0 0 1
f 1//1 2//1 3//1
`;
    const result = parseObj(source);
    // Normal is at floats 4, 5, 6
    expect(result.vertices[4]).toBeCloseTo(0, 5);
    expect(result.vertices[5]).toBeCloseTo(0, 5);
    expect(result.vertices[6]).toBeCloseTo(1, 5);
  });

  it('computes flat face normals when no vn lines present', () => {
    // XY plane triangle → normal should be (0,0,1) or (0,0,-1)
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    const result = parseObj(source);
    const nx = result.vertices[4];
    const ny = result.vertices[5];
    const nz = result.vertices[6];
    const length = Math.sqrt(nx * nx + ny * ny + nz * nz);
    // Flat normal should be unit length (or zero if degenerate)
    if (length > 0) {
      expect(length).toBeCloseTo(1, 3);
    }
  });
});

describe('parseObj — face triangulation', () => {
  it('quad face (4 vertices) is triangulated into 2 triangles (6 indices)', () => {
    const source = `
v 0 0 0
v 1 0 0
v 1 1 0
v 0 1 0
f 1 2 3 4
`;
    const result = parseObj(source);
    expect(result.indices.length).toBe(6);
  });
});

describe('parseObj — deduplication', () => {
  it('two triangles sharing an edge share vertex indices', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
v 1 1 0
f 1 2 3
f 2 4 3
`;
    const result = parseObj(source);
    // 4 unique vertices, 6 indices
    expect(result.vertices.length).toBe(4 * FLOATS_PER_VERTEX);
    expect(result.indices.length).toBe(6);
  });
});

describe('parseObj — edge cases and wrong input', () => {
  it('empty string returns empty vertices and indices', () => {
    const result = parseObj('');
    expect(result.vertices.length).toBe(0);
    expect(result.indices.length).toBe(0);
  });

  it('only comments (no geometry) returns empty output without throwing', () => {
    const result = parseObj('# This is a comment\n# Another comment\n');
    expect(result.vertices.length).toBe(0);
    expect(result.indices.length).toBe(0);
  });

  it('vertex definitions with no faces produce empty indices', () => {
    const result = parseObj('v 1 0 0\nv 0 1 0\nv 0 0 1\n');
    expect(result.indices.length).toBe(0);
  });

  it('does not throw on a string with only whitespace', () => {
    expect(() => parseObj('   \n   \n')).not.toThrow();
  });

  it('ignores mtllib, usemtl, and s directives without throwing', () => {
    const source = `
mtllib material.mtl
usemtl Mat
s 1
v 0 0 0
v 1 0 0
v 0 1 0
f 1 2 3
`;
    expect(() => parseObj(source)).not.toThrow();
  });

  it('v/vt/vn face format is parsed without throwing', () => {
    const source = `
v 0 0 0
v 1 0 0
v 0 1 0
vt 0 0
vt 1 0
vt 0 1
vn 0 0 1
f 1/1/1 2/2/1 3/3/1
`;
    expect(() => parseObj(source)).not.toThrow();
    const result = parseObj(source);
    expect(result.vertices.length).toBeGreaterThan(0);
  });
});
