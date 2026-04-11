# Minimum Game Runtime

Assumes: full-screen `<canvas id="game">` in HTML, and a combined save string (tagged segments joined by `|||`).

---

## Imports

```typescript
import { Engine } from '@/src/webgpu/engine'
```

---

## Init

```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement
canvas.width  = window.innerWidth
canvas.height = window.innerHeight
window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
})

const engine = await Engine.create(canvas)
await engine.loadScene(saveString)
engine.start()
```

`engine.loadScene(saveString)` handles everything internally:
- Splits the combined string on `|||` and decodes each tagged segment
- Restores the camera from the `sceneConstants` segment
- Spawns all game objects (Cube, Quad, FBX) from `gameObjects` segments — FBX assets deduplicated by URL
- Spawns all lights (Point/Ambient/Directional) from `lightObjects` segments
- Registers the physics loop via `engine.onFrame`

Throws if the save string is invalid or corrupt.

---

## Save back

```typescript
import { SaveManager } from '@/src/webgpu/engine'
import type { SaveSegments } from '@/src/webgpu/engine'

const saveManager = new SaveManager()
const segments: SaveSegments = {
  sceneConstants: [{ version: 1, camera: { position: [0,0,5], yaw: 0, pitch: 0 } }],
  gameObjects:    [{ version: 1, objects: [ /* CubeSnapshot | QuadSnapshot | FbxObjectSnapshot */ ] }],
  lightObjects:   [{ version: 1, objects: [ /* LightSnapshot | DirectionalLightSnapshot */ ] }],
}
const encodedString: string = await saveManager.save(segments)
// persist encodedString wherever needed (localStorage, server, etc.)
```

Each array field supports multiple entries of the same type for future extensibility.

---

## Constraints

| Limit | Value |
|-------|-------|
| Max renderable objects | 512 (UniformPool) |
| Max encoded save size | 5 MB |
| Segment separator | `\|\|\|` (never appears in base64 output) |
| `setCamera()` required | before `engine.start()` (handled by `loadScene`) |
| Physics bodies only collide | within the same `layer` string |
