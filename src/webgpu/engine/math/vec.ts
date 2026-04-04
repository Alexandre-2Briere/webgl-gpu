export const FLOAT_SIZE = 4  // bytes per GPU f32 or u32

/** Parses a float string, returning `fallback` (default 0) when the result is NaN. */
export function safeParseFloat(value: string, fallback = 0): number {
  const parsed = parseFloat(value)
  return isNaN(parsed) ? fallback : parsed
}

export type Vec2 = [number, number]
export type Vec3 = [number, number, number]
export type Vec4 = [number, number, number, number]

export function cross3(a: number[], b: number[]): number[] {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ]
}

export function norm3(v: number[]): Vec3 {
  const len = Math.sqrt(v[0] ** 2 + v[1] ** 2 + v[2] ** 2)
  return len > 0 ? [v[0] / len, v[1] / len, v[2] / len] : [0, 1, 0]
}

// yaw: [cosYaw, sinYaw], pitch: [cosPitch, sinPitch]
export function forward(yaw: Vec2, pitch: Vec2): Vec3 {
  const [cosYaw, sinYaw] = yaw
  const [cosPitch, sinPitch] = pitch
  return [sinYaw * cosPitch, -sinPitch, -cosYaw * cosPitch]
}

export function right(yaw: Vec2): Vec3 {
  const [cosYaw, sinYaw] = yaw
  return [cosYaw, 0, sinYaw]
}

// up = right × forward
export function up(rightDir: Vec3, forwardDir: Vec3): Vec3 {
  return cross3(rightDir, forwardDir) as Vec3
}

export function dot(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error("Dot multiplication of 2 vector of different length is impossible")
  }
  let result = 0
  for (let i = 0; i < a.length; i++) {
    result += a[i] * b[i]
  }
  return result
}

export function addVec(a: number[], b: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] + b[i]
  }
  return out
}

export function subVec(a: number[], b: number[]): number[] {
  const out: number[] = []
  for (let i = 0; i < a.length; i++) {
    out[i] = a[i] - b[i]
  }
  return out
}

export function scaleVec(v: number[], s: number): number[] {
  const out: number[] = []
  for (let i = 0; i < v.length; i++) {
    out[i] = v[i] * s
  }
  return out
}

export function lenSq(v: number[]): number {
  let sum = 0
  for (let i = 0; i < v.length; i++) {
    sum += v[i] * v[i]
  }
  return sum
}

/** Fast inverse square root — Quake III algorithm adapted for float64 via DataView bit hack + 1 Newton–Raphson iteration. */
function fastInvSqrt(x: number): number {
  const buf = new ArrayBuffer(8)
  const view = new DataView(buf)
  view.setFloat64(0, x, true)
  const lo = view.getUint32(0, true)
  const hi = view.getUint32(4, true)
  // 64-bit magic: 0x5FE6EB50C7B537A9 - (n >> 1)
  const newHi = 0x5FE6EB50 - (hi >>> 1) - (lo >>> 31 ? 1 : 0)
  view.setUint32(4, newHi, true)
  view.setUint32(0, 0, true)
  let y = view.getFloat64(0, true)
  // one Newton–Raphson iteration
  y = y * (1.5 - 0.5 * x * y * y)
  return y
}

/** Normalize a Vec3, returning [0, 1, 0] if the vector is degenerate (lenSq < 1e-12). Uses fast inverse sqrt. */
export function safeNorm3(v: Vec3): Vec3 {
  const sq = v[0] * v[0] + v[1] * v[1] + v[2] * v[2]
  if (sq < 1e-12) {
    return [0, 1, 0]
  }
  const inv = fastInvSqrt(sq)
  return [v[0] * inv, v[1] * inv, v[2] * inv]
}
