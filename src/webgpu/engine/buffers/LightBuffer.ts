import { UniformBuffer } from './UniformBuffer';
import { logger } from '../utils/logger';
import type { LightGameObject } from '../gameObject/Light/LightGameObject';
import { FLOAT_SIZE } from '../math/vec';

/** @internal */
export const MAX_LIGHTS = 250;

// GPU buffer layout (see common.wgsl LightBuffer struct):
//   offset  0: count (u32) + 12 bytes padding  → 16 bytes header
//   offset 16: array of Light[250], each 32 bytes
//     Light: position(vec3f=12) + radius(f32=4) + color(vec3f=12) + lightType(u32=4)
const HEADER_SIZE = 4 * FLOAT_SIZE;              
const LIGHT_SIZE  = 8 * FLOAT_SIZE;              
const BUFFER_SIZE = HEADER_SIZE + MAX_LIGHTS * LIGHT_SIZE;  

/** @internal */
export class LightBuffer extends UniformBuffer {
  private _dirty = true;
  private readonly _lights: LightGameObject[] = [];

  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    super(device, BUFFER_SIZE, layout, 'light-buffer');
  }

  addLight(light: LightGameObject): void {
    if (this._lights.length >= MAX_LIGHTS) {
      logger.error(`LightBuffer: max ${MAX_LIGHTS} lights reached, ignoring addLight()`);
      return;
    }
    this._lights.push(light);
    this._dirty = true;
  }

  removeLight(light: LightGameObject): void {
    const index = this._lights.indexOf(light);
    if (index === -1) {
      logger.error('LightBuffer: removeLight() called with unregistered light');
      return;
    }
    this._lights.splice(index, 1);
    this._dirty = true;
  }

  markDirty(): void { this._dirty = true; }

  /**
   * Serialises all registered lights into the GPU uniform buffer.
   * No-ops when no light or transform has changed since the last upload.
   *
   * Mirrors the WGSL `LightBuffer` struct layout:
   *   [0]  count (u32) + 12 bytes padding        → 16-byte header
   *   [16] Light[n], each 32 bytes:
   *          +0  position.x/y/z  (3 × f32)
   *          +12 radius          (f32)
   *          +16 color.r/g/b     (3 × f32)
   *          +28 lightType       (u32)
   *
   * DataView is used instead of a typed array because the struct mixes f32 and u32
   * fields at arbitrary byte offsets within each 32-byte light entry.
   */
  upload(queue: GPUQueue): void {
    if (!this._dirty) return;
    const buffer = new ArrayBuffer(BUFFER_SIZE);
    const view   = new DataView(buffer);
    view.setUint32(0, this._lights.length, true);
    for (let i = 0; i < this._lights.length; i++) {
      const light = this._lights[i];
      const base  = HEADER_SIZE + i * LIGHT_SIZE;
      view.setFloat32(base +  0, light.gpuPosition[0], true);
      view.setFloat32(base +  4, light.gpuPosition[1], true);
      view.setFloat32(base +  8, light.gpuPosition[2], true);
      view.setFloat32(base + 12, light.radius,      true);
      view.setFloat32(base + 16, light.color[0],    true);
      view.setFloat32(base + 20, light.color[1],    true);
      view.setFloat32(base + 24, light.color[2],    true);
      view.setUint32( base + 28, light.lightType,   true);
    }
    this._write(queue, buffer);
    this._dirty = false;
  }
}
