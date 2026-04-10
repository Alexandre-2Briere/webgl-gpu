# Minimum Game Runtime

Assumes: full-screen `<canvas id="game">` in HTML, and a save string (base64+deflate `SceneSnapshot`).

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
- Decodes and validates the save string
- Restores the camera
- Spawns all objects (Cube, Quad, FBX, Point/Ambient/Directional lights) — FBX assets are deduplicated by URL
- Registers the physics loop via `engine.onFrame`

Throws if the save string is invalid or corrupt.

---

## Save back

```typescript
import { SaveManager } from '@/src/webgpu/engine'

const saveManager = new SaveManager()
const snapshot = /* SceneSnapshot you constructed or loaded earlier */
const encodedString: string = await saveManager.save(snapshot)
// persist encodedString wherever needed (localStorage, server, etc.)
```

---

## Advanced: restore from a snapshot directly

If you already have a decoded `SceneSnapshot` (e.g. to inspect it before restoring):

```typescript
import { Engine, SaveManager, restoreFromSnapshot } from '@/src/webgpu/engine'

const saveManager = new SaveManager()
const snapshot = await saveManager.load(saveString)
if (snapshot === null) throw new Error('Invalid save string')

// inspect / mutate snapshot here …

const engine = await Engine.create(canvas)
await restoreFromSnapshot(engine, snapshot)
engine.start()
```

---

## Constraints

| Limit | Value |
|-------|-------|
| Max renderable objects | 512 (UniformPool) |
| Max encoded save size | 5 MB |
| `setCamera()` required | before `engine.start()` (handled by `loadScene`) |
| Physics bodies only collide | within the same `layer` string |
