import { UniformBuffer } from './UniformBuffer';
import { logger } from '../utils';
import { FLOAT_SIZE } from '../math';
import type { LightGameObject } from '../gameObject/LightGameObject';

export const MAX_LIGHTS = 250;

// GPU buffer layout (see common.wgsl LightBuffer struct):
//   offset  0: count (u32) + 12 bytes padding  → 16 bytes header
//   offset 16: array of Light[250], each 32 bytes
//     Light: position(vec3f=12) + radius(f32=4) + color(vec3f=12) + lightType(u32=4)
const HEADER_SIZE = 4 * FLOAT_SIZE;              // 16 bytes
const LIGHT_SIZE  = 8 * FLOAT_SIZE;              // 32 bytes (3+1+3+1 floats)
const BUFFER_SIZE = HEADER_SIZE + MAX_LIGHTS * LIGHT_SIZE;  // 8016 bytes

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
