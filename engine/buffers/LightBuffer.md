# LightBuffer

`LightBuffer` is a specialized uniform buffer that structures and manages dynamic scene lighting data (supporting a maximum of 250 lights). It automatically serializes and uploads light information in a layout matching the common WGSL shaders.

---

## Technical Shape

* **Maximum Lights**: 250 lights
* **GPU Usage Flags**: `GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST`
* **Buffer Memory Layout**:
  * **Header** (16 bytes):
    * Offset `0` (4 bytes): `count` (`u32`) - active light count.
    * Offset `4` (12 bytes): `padding` - unused bytes to align structure to 16 bytes.
  * **Light Array** (Offset `16` to `8016`): Array of 250 elements, each element is exactly 32 bytes:
    * Offset `+0` (12 bytes): `position` (`vec3f`)
    * Offset `+12` (4 bytes): `radius` (`f32`)
    * Offset `+16` (12 bytes): `color` (`vec3f`) – colored intensity (`color * intensity`)
    * Offset `+28` (4 bytes): `lightType` (`u32`)
* **Total Buffer Size**: 16 bytes (header) + 250 * 32 bytes (lights) = `8016` bytes.

---

## Detailed WebGPU Usage Explanation

The data structure inside the `LightBuffer` matches the `LightBuffer` uniform struct defined in WebGPU WGSL shaders. To guarantee precise layout matching and performance optimization, `LightBuffer` writes its data into an `ArrayBuffer` using a `DataView`. This handles mixing `f32` floats and `u32` integers at arbitrary byte offsets within each element.

The `upload()` call is optimized to copy data only when changes occur (via a dirty-tracking flag).

---

## Code Example

```typescript
import { LightBuffer } from './LightBuffer';
import { LightGameObject } from '../gameObject/Light/LightGameObject';

// 1. Setup bind group layout for lights
const lightBindGroupLayout = device.createBindGroupLayout({
  label: 'light-layout',
  entries: [{
    binding: 0,
    visibility: GPUShaderStage.FRAGMENT | GPUShaderStage.VERTEX,
    buffer: { type: 'uniform' }
  }]
});

// 2. Instantiate LightBuffer
const lightBuffer = new LightBuffer(device, lightBindGroupLayout);

// 3. Add light game objects to buffer management
const pointLight = new LightGameObject();
pointLight.radius = 15.0;
pointLight.intensity = 2.0;
pointLight.color = new Float32Array([1.0, 0.8, 0.6]); // Warm light

lightBuffer.addLight(pointLight);

// 4. Update and upload inside render tick
// Only uploads data if some settings changed or dirty flag got marked
lightBuffer.upload(device.queue);

// 5. Use in Fragment Pass
const renderPass = commandEncoder.beginRenderPass(renderPassDesc);
renderPass.setPipeline(renderPipeline);
renderPass.setBindGroup(1, lightBuffer.bindGroup); // Passes the single bindGroup inherited from UniformBuffer
renderPass.draw(6);
renderPass.end();

// 6. Cleanup
lightBuffer.destroy();
```
