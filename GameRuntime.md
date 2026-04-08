# Minimum Game Runtime

Assumes: full-screen `<canvas id="game">` in HTML, and a save string (base64+deflate `SceneSnapshot`).

---

## Imports

```typescript
import {
  Engine,
  SaveManager,
  LightGameObject,
  LightType,
} from '@/src/webgpu/engine'
import { applyPhysics, applyCollisions } from '@/src/webgpu/engine/gameObject/rigidbody'
import { Rigidbody3D } from '@/src/webgpu/engine/gameObject/rigidbody/Rigidbody3D'
import { CubeHitbox } from '@/src/webgpu/engine/gameObject/hitbox/CubeHitbox'
import type {
  IGameObject,
  SceneSnapshot,
  ObjectSnapshot,
} from '@/src/webgpu/engine'
```

---

## 1 — Boot

```typescript
const canvas = document.getElementById('game') as HTMLCanvasElement
canvas.width  = window.innerWidth
canvas.height = window.innerHeight
window.addEventListener('resize', () => {
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
})

const engine = await Engine.create(canvas)
```

---

## 2 — Decode the save string

```typescript
const saveManager = new SaveManager()
const snapshot: SceneSnapshot | null = await saveManager.load(saveString)
if (snapshot === null) throw new Error('Invalid save string')
```

`SceneSnapshot` shape:
```typescript
{
  version: 1,
  camera: { position: [x,y,z], yaw: number, pitch: number },
  objects: ObjectSnapshot[]   // see step 3
}
```

---

## 3 — Restore camera

```typescript
const camera = engine.createCamera({
  position: snapshot.camera.position,
  yaw:      snapshot.camera.yaw,
  pitch:    snapshot.camera.pitch,
})
engine.setCamera(camera)
```

---

## 4 — Restore objects

Track all live objects and the rigidbody layer map for the physics loop.

```typescript
const objects: IGameObject[]                  = []
const layerMap = new Map<string, Rigidbody3D[]>()

// Cache FBX assets so each URL is loaded only once
const fbxCache = new Map<string, Awaited<ReturnType<typeof engine.loadFbx>>>()

for (const record of snapshot.objects) {
  const gameObject = await _spawnFromRecord(engine, record, fbxCache)
  if (gameObject === null) continue

  objects.push(gameObject)

  const rigidbody = gameObject.getRigidbody()
  if (rigidbody) {
    const bucket = layerMap.get(rigidbody.layer) ?? []
    bucket.push(rigidbody)
    layerMap.set(rigidbody.layer, bucket)
  }
}
```

### `_spawnFromRecord` helper

```typescript
async function _spawnFromRecord(
  engine:   Engine,
  record:   ObjectSnapshot,
  fbxCache: Map<string, ReturnType<typeof engine.loadFbx> extends Promise<infer T> ? T : never>,
): Promise<IGameObject | null> {

  // Build rigidbody from physicsConfig if needed
  let rigidbody: Rigidbody3D | undefined
  if (record.physicsConfig.hasRigidbody) {
    rigidbody = new Rigidbody3D({
      layer:    record.physicsConfig.layer,
      isStatic: record.physicsConfig.isStatic,
      hitbox:   record.physicsConfig.hasHitbox ? new CubeHitbox([0.5, 0.5, 0.5]) : null,
    })
  }

  const baseOptions = {
    position:  record.position,
    quaternion: record.quaternion,
    scale:     record.scale,
    rigidbody,
  }

  switch (record.key) {
    case 'Cube': {
      // Unit cube: 12 floats per vertex (pos | pad | normal | pad | color), 36 vertices
      const vertices = _buildUnitCubeVertices(record.color)
      const gameObject = engine.createMesh({ ...baseOptions, vertices })
      return gameObject
    }

    case 'Quad': {
      const gameObject = engine.createQuad3D({
        ...baseOptions,
        position: record.position,
        width:    record.scale[0],
        height:   record.scale[2],
        color:    record.color,
      })
      return gameObject
    }

    case 'FBX': {
      let asset = fbxCache.get(record.assetUrl)
      if (!asset) {
        asset = await engine.loadFbx(record.assetUrl)
        fbxCache.set(record.assetUrl, asset)
      }
      const gameObject = engine.createFbxModel({ ...baseOptions, asset })
      return gameObject
    }

    case 'Light':
    case 'DirectionalLight': {
      let lightObject: LightGameObject
      if (record.lightType === 2) {
        lightObject = engine.createDirectionalLight()
      } else if (record.lightType === 0) {
        lightObject = engine.createAmbientLight()
      } else {
        lightObject = engine.createPointLight({ radius: record.radius })
      }
      lightObject.setPosition(record.position)
      lightObject.setColor(record.color[0], record.color[1], record.color[2], record.color[3])
      if ('direction' in record) {
        lightObject.setDirection(record.direction)
      }
      return lightObject
    }

    default:
      return null
  }
}
```

> **Note on Cube vertices:** the sandbox uses a pre-built unit cube `Float32Array` (48 bytes × 36 vertices). Supply your own or import a helper from `src/webgpu/engine/utils/`.

---

## 5 — Run the loops

```typescript
// Render loop (engine manages this internally)
engine.start()

// Physics / logic loop
let lastTimestamp = performance.now()

function logicTick(timestamp: number): void {
  const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1)
  lastTimestamp = timestamp

  applyPhysics(objects, deltaTime)
  applyCollisions(layerMap, objects)

  requestAnimationFrame(logicTick)
}
requestAnimationFrame(logicTick)
```

---

## Save back

```typescript
const encodedString: string = await saveManager.save(snapshot)
// persist encodedString wherever needed (localStorage, server, etc.)
```

`saveManager.save()` accepts any `SceneSnapshot` you construct or the same one loaded earlier.

---

## Constraints

| Limit | Value |
|-------|-------|
| Max renderable objects | 512 (UniformPool) |
| Max encoded save size | 5 MB |
| `setCamera()` required | before `engine.start()` |
| Physics bodies only collide | within the same `layer` string |
