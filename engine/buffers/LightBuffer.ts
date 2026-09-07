/**
 * @file LightBuffer.ts
 * @description Specialized uniform buffer that structures and manages dynamic scene lighting data
 * (up to a maximum of 250 lights).
 * 
 * Shape / Layout:
 *   - Header (16 bytes):
 *       - Offset 0 (4 bytes): count (u32, active lights count)
 *       - Offset 4 (12 bytes): padding (unused)
 *   - Light Array (Offset 16 to 8016): Array of 250 elements, each element is exactly 32 bytes:
 *       - Offset +0 (12 bytes): position (vec3f)
 *       - Offset +12 (4 bytes): radius (f32)
 *       - Offset +16 (12 bytes): color (vec3f) -> matching color * intensity
 *       - Offset +28 (4 bytes): lightType (u32)
 * 
 * Total Buffer Size: 8016 bytes
 * 
 * GPU Usage Flags:
 *   - UNIFORM | COPY_DST (inherited from UniformBuffer)
 * 
 * For detailed code examples and integration instructions, refer to type-specific markdown:
 * [LightBuffer.md](LightBuffer.md)
 * 
 * @internal
 */

import { UniformBuffer } from './UniformBuffer';
import { logger } from '../utils/logger';
import type { LightGameObject } from '../gameObject/Light/LightGameObject';
import { FLOAT_SIZE } from '../math/vec';

/** 
 * Maximum supported lights in the buffer. 
 * @internal 
 */
export const MAX_LIGHTS = 250;

// GPU buffer layout calculations (matching common.wgsl LightBuffer struct)
const HEADER_SIZE = 4 * FLOAT_SIZE;              
const LIGHT_SIZE  = 8 * FLOAT_SIZE;              
const BUFFER_SIZE = HEADER_SIZE + MAX_LIGHTS * LIGHT_SIZE;  

/** @internal */
export class LightBuffer extends UniformBuffer {
  // --- Instance Fields ---
  private readonly _lights: LightGameObject[] = [];
  private _dirty = true;

  // --- Constructor ---
  /**
   * Creates a new instance of LightBuffer.
   * @param device - The active GPUDevice.
   * @param layout - Bind group layout, must have a uniform buffer entry at binding 0.
   */
  constructor(device: GPUDevice, layout: GPUBindGroupLayout) {
    super(device, BUFFER_SIZE, layout, 'light-buffer');
  }

  // --- Public Methods ---
  /**
   * Appends an active light game object to buffer management.
   * Sets the dirty flag to queue a data upload on the next engine loop tick.
   * @param light - The LightGameObject to add.
   */
  addLight(light: LightGameObject): void {
    if (this._lights.length >= MAX_LIGHTS) {
      logger.error(`LightBuffer: max ${MAX_LIGHTS} lights reached, ignoring addLight()`);
      return;
    }
    this._lights.push(light);
    this._dirty = true;
  }

  /**
   * Removes an existing light game object from buffer management.
   * Sets the dirty flag to queue a data upload on the next engine loop tick.
   * @param light - The LightGameObject to remove.
   */
  removeLight(light: LightGameObject): void {
    const index = this._lights.indexOf(light);
    if (index === -1) {
      logger.error('LightBuffer: removeLight() called with unregistered light');
      return;
    }
    this._lights.splice(index, 1);
    this._dirty = true;
  }

  /**
   * Flags the buffer as dirty. Used to force data refresh on next cycle
   * even if no lights were added or removed (e.g. dynamic changes to light position/color).
   */
  markDirty(): void { 
    this._dirty = true; 
  }

  /**
   * Serializes all registered lights into the GPU uniform buffer using a DataView
   * to align integers (lightType/count) and floats (radius/positions) correctly.
   * 
   * Operates as a no-op if the dirty flag is false.
   * @param queue - The active GPUQueue execution context.
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
      view.setFloat32(base + 16, light.color[0] * light.intensity, true);
      view.setFloat32(base + 20, light.color[1] * light.intensity, true);
      view.setFloat32(base + 24, light.color[2] * light.intensity, true);
      view.setUint32( base + 28, light.lightType,   true);
    }
    this._write(queue, buffer);
    this._dirty = false;
  }
}

