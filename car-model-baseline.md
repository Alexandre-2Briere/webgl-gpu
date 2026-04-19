# Car FBX — Baseline

## Setup

```typescript
import { Engine } from './src/webgpu/engine/Engine';

const canvas = document.querySelector('canvas') as HTMLCanvasElement;
const engine = await Engine.create(canvas);

engine.setCamera({
  position: [0, 2, 6],
  target: [0, 0, 0],
  fov: 60,
  near: 0.1,
  far: 1000,
});
```

## Load and display

```typescript
const textures = {
  body:    '/textures/body_red.png',
  wheels:  '/textures/wheels.png',
  windows: '/textures/windows.png',
  interior:'/textures/interior.png',
};

// Keys must match the texture filenames referenced inside the FBX
const asset = await engine.loadFbx('/models/car.fbx', undefined, {
  'body.png':     textures.body,
  'wheels.png':   textures.wheels,
  'windows.png':  textures.windows,
  'interior.png': textures.interior,
});

const car = engine.createFbxModel({
  renderable: { asset },
  position: [0, 0, 0],
});

engine.start();
```

## Switch a material at runtime

```typescript
// sliceIndex 0 = first material group in the FBX (e.g. body)
await asset.setSliceTexture(0, '/textures/body_blue.png');
```

## Slice index → part name

The FBX parser names slices `<meshName>` (single material) or `<meshName>_mat<N>` (multiple).
Log them at load time to map indices:

```typescript
console.log((asset as any).slices.map((s: any, i: number) => `${i}: ${s}`));
```
