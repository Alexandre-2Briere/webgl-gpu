/** Column-major 4×4 matrix multiply: out = a × b */
export function mul4x4(a: Float32Array, b: Float32Array, out: Float32Array): void {
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      let sum = 0
      for (let k = 0; k < 4; k++) {
        sum += a[k * 4 + row] * b[col * 4 + k]
      }
      out[col * 4 + row] = sum
    }
  }
}
