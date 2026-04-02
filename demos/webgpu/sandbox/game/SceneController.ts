import { Engine }           from '../../../../src/webgpu/engine/index'
import type { IGameObject, ISceneObject, FbxAssetHandle } from '../../../../src/webgpu/engine/index'
import { LightGameObject } from '../../../../src/webgpu/engine/gameObject/LightGameObject'
import { applyPhysics, applyCollisions } from '../../../../src/webgpu/engine/gameObject/rigidbody/index'
import { Rigidbody3D } from '../../../../src/webgpu/engine/gameObject/rigidbody/Rigidbody3D'
import { CubeHitbox }  from '../../../../src/webgpu/engine/gameObject/hitbox/CubeHitbox'
import type { Vec3 }   from '../../../../src/webgpu/engine/math'
import type { Terminal }    from '../ui/Terminal'
import type { PropertyPanel } from '../ui/PropertyPanel'
import type { SceneHierarchy } from '../ui/SceneHierarchy'
import type { ItemEntry, PropertyGroup, PhysicsConfig, SpawnContext, PrimitiveSpawnContext, FbxSpawnContext, LightSpawnContext } from '../items/types'
import { spawn as spawnQuad } from '../items/quad'
import { spawn as spawnCube } from '../items/cube'
import { spawn as spawnFBX, FBX_CATALOG } from '../items/fbx'
import { spawn as spawnLight } from '../items/lights'
import { spawn as spawnDirectionalLight } from '../items/directionalLight'

const CAMERA_MOVE_SPEED  = 5.0   // units per second
const CAMERA_YAW_SPEED   = 1.5   // radians per second (Q/E keys)
const MOUSE_SENSITIVITY  = 0.003  // radians per pixel

const DEFAULT_PHYSICS: PhysicsConfig = {
  hasRigidbody: false,
  isStatic:     false,
  hasHitbox:    false,
  layer:        'default',
}

const SPAWN_MAP: Record<string, (engine: Engine, context: SpawnContext) => ISceneObject> = {
  Quad:  (engine, context) => spawnQuad(engine, context as PrimitiveSpawnContext),
  Cube:  (engine, context) => spawnCube(engine, context as PrimitiveSpawnContext),
  FBX:   (engine, context) => spawnFBX(engine, context as FbxSpawnContext),
  Light:            (engine, context) => spawnLight(engine, context as LightSpawnContext),
  DirectionalLight: (engine, context) => spawnDirectionalLight(engine, context as LightSpawnContext),
}

function isGameObject(object: ISceneObject): object is IGameObject {
  return 'renderable' in object
}

function makeHitbox(key: string, scale: Vec3): CubeHitbox {
  if (key === 'Quad') return new CubeHitbox([scale[0] * 0.5, 0.01,           scale[2] * 0.5])
  return new CubeHitbox([scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5])
}

interface SpawnedObject {
  gameObject:     ISceneObject
  key:            string
  label:          string
  properties:     PropertyGroup[]
  physicsConfig:  PhysicsConfig
  selectedFbxUrl: string | null
  // World-space position snapshot taken at the moment Play is pressed.
  // Restored on stop. Null before the first Play.
  playSnapshot: [number, number, number] | null
}

export class SceneController {
  private readonly _canvas:          HTMLCanvasElement
  private readonly _terminal:        Terminal
  private readonly _propertyPanel:   PropertyPanel
  private readonly _sceneHierarchy:  SceneHierarchy

  private _engine!:             Engine
  private _fbxCache:            Map<string, FbxAssetHandle> = new Map()
  private _rigidbodyLayerMap:   Map<string, Rigidbody3D[]> = new Map()
  private _spawnedObjects:      SpawnedObject[] = []

  private _playing = false

  // Input state
  private readonly _pressedKeys = new Set<string>()
  private unfocused = true;
  private _mouseButtonDown = false
  private _mouseDeltaX     = 0
  private _mouseDeltaY     = 0

  constructor(
    canvas: HTMLCanvasElement,
    terminal: Terminal,
    propertyPanel: PropertyPanel,
    sceneHierarchy: SceneHierarchy,
  ) {
    this._canvas         = canvas
    this._terminal       = terminal
    this._propertyPanel  = propertyPanel
    this._sceneHierarchy = sceneHierarchy
  }

  // ── Init ──────────────────────────────────────────────────────────────────────

  async init(): Promise<void> {
    this._engine = await Engine.create(this._canvas)
    const camera = this._engine.createCamera({
      fovY:     Math.PI / 3,
      near:     0.1,
      far:      500,
      position: [0, 3, 8],
      yaw:      0,
      pitch:    Math.atan2(3, 8),
    })
    this._engine.setCamera(camera)

    this._terminal.print('Loading FBX assets...', 'log')
    await Promise.all(FBX_CATALOG.map(({ url }) =>
      this._engine.loadFbx(url).then(handle => this._fbxCache.set(url, handle))
    ))
    this._propertyPanel.setFbxCatalog(FBX_CATALOG)

    // Render loop always runs so spawned objects are visible immediately.
    this._engine.start()

    // Permanent low-level directional light — always on, not shown in hierarchy.
    this._engine.createDirectionalLight({
      direction: [0.577, 0.577, 0.577],
      color:     [0.35, 0.35, 0.35],
      power:     1.0,
    })

    this._wireInput()
    this._engine.onFrame(this._onFrame)
    this._wirePhysicsCallbacks()

    this._terminal.print('Engine initialised.', 'log')
    this._terminal.print('Press Play to start | Click an object to inspect it.', 'log')
  }

  // ── Play / Stop ──────────────────────────────────────────────────────────────

  play(): void {
    if (this._playing) return
    this.unfocused = false;

    // Snapshot current positions before physics starts
    for (const spawnedObject of this._spawnedObjects) {
      const position = spawnedObject.gameObject.position
      spawnedObject.playSnapshot = [position[0], position[1], position[2]]
    }

    this._canvas.requestPointerLock()
    this._playing = true

    for (const spawnedObject of this._spawnedObjects) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(false)
      }
    }

    this._terminal.print('Play started.', 'log')
  }

  stop(): void {
    if (!this._playing) return

    this.unfocused = true;

    // Release pointer lock (no-op if already released by ESC)
    if (document.pointerLockElement === this._canvas) {
      document.exitPointerLock()
    }

    // Restore pre-play positions and zero velocities
    this._resetPhysics()

    this._playing = false

    for (const spawnedObject of this._spawnedObjects) {
      if (spawnedObject.gameObject instanceof LightGameObject) {
        spawnedObject.gameObject.setVisualizationVisible(true)
      }
    }

    this._terminal.print('Play stopped.', 'log')
  }

  isPlaying(): boolean {
    return this._playing
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────────

  spawn(key: string, entry: ItemEntry): void {
    if (!entry.isReady) {
      this._terminal.print(`${entry.label} is not yet available.`, 'warn')
      return
    }

    const spawnFn = SPAWN_MAP[key]
    if (!spawnFn) {
      this._terminal.print(`No spawn handler registered for: ${key}`, 'warn')
      return
    }

    const selectedFbxUrl = key === 'FBX' ? FBX_CATALOG[0].url : null
    const context: SpawnContext = key === 'FBX'
      ? { kind: 'fbx', asset: this._fbxCache.get(selectedFbxUrl!)! }
      : key === 'Light' || key === 'DirectionalLight'
        ? { kind: 'light' }
        : { kind: 'primitive' }

    const gameObject = spawnFn(this._engine, context)

    const rb = gameObject.getRigidbody()
    if (rb) {
      let bucket = this._rigidbodyLayerMap.get(rb.layer)
      if (!bucket) { bucket = []; this._rigidbodyLayerMap.set(rb.layer, bucket) }
      bucket.push(rb)
    }

    const label = this._generateUniqueName(entry.label)
    const physicsConfig: PhysicsConfig = { ...DEFAULT_PHYSICS }

    this._spawnedObjects.push({
      gameObject,
      key,
      label,
      properties:     entry.properties,
      physicsConfig,
      selectedFbxUrl,
      playSnapshot:   null,
    })

    const index = this._spawnedObjects.length - 1
    this._sceneHierarchy.addObject(label)
    this._sceneHierarchy.setSelected(index)
    this._propertyPanel.show(gameObject, label, entry.properties, physicsConfig, selectedFbxUrl ?? undefined)
    this._terminal.print(`Spawned ${label} at (0, 0, 0).`, 'log')
  }

  // ── Public: select / rename (called by SceneHierarchy callbacks) ──────────────

  selectObject(index: number): void {
    const obj = this._spawnedObjects[index]
    if (!obj) return
    this._sceneHierarchy.setSelected(index)
    this._propertyPanel.show(obj.gameObject, obj.label, obj.properties, obj.physicsConfig, obj.selectedFbxUrl ?? undefined)
  }

  renameObject(index: number, newName: string): boolean {
    const obj = this._spawnedObjects[index]
    if (!obj) return false
    obj.label = newName
    this._sceneHierarchy.renameRow(index, newName)
    if (this._propertyPanel.currentObject === obj.gameObject) {
      this._propertyPanel.setTitle(newName)
    }
    return true
  }

  removeObject(index: number): void {
    const obj = this._spawnedObjects[index]
    if (!obj) return

    // Remove rigidbody from layer map
    const rb = obj.gameObject.getRigidbody()
    if (rb) {
      const bucket = this._rigidbodyLayerMap.get(rb.layer)
      if (bucket) {
        const i = bucket.indexOf(rb)
        if (i !== -1) bucket.splice(i, 1)
      }
    }

    // Hide property panel if this object was selected
    if (this._propertyPanel.currentObject === obj.gameObject) {
      this._propertyPanel.hide()
    }

    obj.gameObject.destroy()
    this._spawnedObjects.splice(index, 1)
    this._sceneHierarchy.removeRow(index)

    this._terminal.print(`Removed ${obj.label}.`, 'log')
  }

  // ── Frame callback (registered with engine.onFrame) ─────────────────────────

  private _onFrame = (deltaTime: number): void => {
    this._applyCamera(deltaTime)

    // Mouse drag rotation when not playing (no pointer lock)
    if (this._mouseButtonDown && !this._playing) {
      this._engine.camera.rotate(
        -this._mouseDeltaX * MOUSE_SENSITIVITY,
        -this._mouseDeltaY * MOUSE_SENSITIVITY,
      )
      this._mouseDeltaX = 0
      this._mouseDeltaY = 0
    }

    // Mouse rotation when pointer is locked (play mode)
    if (document.pointerLockElement === this._canvas) {
      this._engine.camera.rotate(
        this._mouseDeltaX * MOUSE_SENSITIVITY,
        this._mouseDeltaY * MOUSE_SENSITIVITY,
      )
      this._mouseDeltaX = 0
      this._mouseDeltaY = 0
    }

    if (this._playing) {
      const physicsObjects = this._spawnedObjects.map(s => s.gameObject).filter(isGameObject)
      applyPhysics(physicsObjects, deltaTime)
      applyCollisions(this._rigidbodyLayerMap, physicsObjects)
    }
  }

  // ── Camera movement ───────────────────────────────────────────────────────────

  private _applyCamera(deltaTime: number): void {
    if(this.unfocused) return;
    const camera   = this._engine.camera
    const cosYaw   = Math.cos(camera.yaw)
    const sinYaw   = Math.sin(camera.yaw)

    let moveX = 0
    let moveZ = 0

    // W/S: forward/back on XZ plane (ignoring pitch for horizontal movement)
    if (this._pressedKeys.has('KeyW')) { moveX += sinYaw; moveZ -= cosYaw }
    if (this._pressedKeys.has('KeyS')) { moveX -= sinYaw; moveZ += cosYaw }
    // A/D: strafe left/right
    if (this._pressedKeys.has('KeyA')) { moveX -= cosYaw; moveZ -= sinYaw }
    if (this._pressedKeys.has('KeyD')) { moveX += cosYaw; moveZ += sinYaw }

    if (moveX !== 0 || moveZ !== 0) {
      const length    = Math.sqrt(moveX * moveX + moveZ * moveZ)
      const moveSpeed = CAMERA_MOVE_SPEED * deltaTime
      camera.position[0] += (moveX / length) * moveSpeed
      camera.position[2] += (moveZ / length) * moveSpeed
    }

    // Q/E: yaw rotation
    if (this._pressedKeys.has('KeyQ')) { camera.yaw -= CAMERA_YAW_SPEED * deltaTime }
    if (this._pressedKeys.has('KeyE')) { camera.yaw += CAMERA_YAW_SPEED * deltaTime }

    // Space / Shift: vertical
    if (this._pressedKeys.has('Space'))      { camera.position[1] += CAMERA_MOVE_SPEED * deltaTime }
    if (this._pressedKeys.has('ShiftLeft') ||
        this._pressedKeys.has('ShiftRight')) { camera.position[1] -= CAMERA_MOVE_SPEED * deltaTime }
  }

  // ── Physics reset ─────────────────────────────────────────────────────────────

  private _resetPhysics(): void {
    for (const spawnedObject of this._spawnedObjects) {
      const { gameObject, playSnapshot } = spawnedObject

      // Restore pre-play position
      if (playSnapshot) {
        gameObject.setPosition([playSnapshot[0], playSnapshot[1], playSnapshot[2]])
      }

      // Zero rigidbody velocity
      const rb = gameObject.getRigidbody()
      if (rb) {
        rb.velocity[0] = 0
        rb.velocity[1] = 0
        rb.velocity[2] = 0
      }
    }
  }

  // ── Unique name generation ────────────────────────────────────────────────────

  private _generateUniqueName(base: string): string {
    const existing = new Set(this._spawnedObjects.map(s => s.label))
    if (!existing.has(base)) return base
    let i = 1
    while (existing.has(`${base} (${i})`)) i++
    return `${base} (${i})`
  }

  // ── Physics wiring ────────────────────────────────────────────────────────────

  private _wirePhysicsCallbacks(): void {
    this._propertyPanel.onPhysicsChange = (config) => {
      const idx = this._spawnedObjects.findIndex(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (idx === -1) return
      this._rebuildObject(idx, config)
      const obj = this._spawnedObjects[idx]
      this._propertyPanel.show(obj.gameObject, obj.label, obj.properties, config, obj.selectedFbxUrl ?? undefined)
    }

    this._propertyPanel.onAssetChange = (url) => {
      const idx = this._spawnedObjects.findIndex(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (idx === -1) return
      this._spawnedObjects[idx].selectedFbxUrl = url
      this._rebuildObject(idx, this._spawnedObjects[idx].physicsConfig)
      const obj = this._spawnedObjects[idx]
      this._propertyPanel.show(obj.gameObject, obj.label, obj.properties, obj.physicsConfig, url)
    }

    this._propertyPanel.onScaleChange = (x, y, z) => {
      const obj = this._spawnedObjects.find(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (!obj) return
      if (!isGameObject(obj.gameObject)) return
      const hitbox = obj.gameObject.hitbox
      if (hitbox?.type === 'cube') {
        const hy = obj.key === 'Quad' ? 0.01 : y * 0.5
        ;(hitbox as CubeHitbox).halfExtents = [x * 0.5, hy, z * 0.5]
      }
    }

    this._propertyPanel.onRadiusChange = (radius) => {
      const obj = this._spawnedObjects.find(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (obj?.gameObject instanceof LightGameObject) {
        obj.gameObject.setRadius(radius)
      }
    }

    this._propertyPanel.onLightTypeChange = (type) => {
      const obj = this._spawnedObjects.find(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (obj?.gameObject instanceof LightGameObject) {
        obj.gameObject.setLightType(type)
      }
    }

    this._propertyPanel.onPowerChange = (power) => {
      const obj = this._spawnedObjects.find(
        s => s.gameObject === this._propertyPanel.currentObject,
      )
      if (obj?.gameObject instanceof LightGameObject) {
        obj.gameObject.setRadius(power)
      }
    }
  }

  private _rebuildObject(index: number, config: PhysicsConfig): void {
    const obj   = this._spawnedObjects[index]
    if (!isGameObject(obj.gameObject)) return
    const oldGO = obj.gameObject

    // Save current transform and color
    const pos   = [...oldGO.position]   as [number, number, number]
    const quat  = [...oldGO.quaternion] as [number, number, number, number]
    const scale = [...oldGO.scale]      as Vec3
    const color = [...oldGO.color]      as [number, number, number, number]

    // Remove old rigidbody from layer map
    const oldRb = oldGO.getRigidbody()
    if (oldRb) {
      const bucket = this._rigidbodyLayerMap.get(oldRb.layer)
      if (bucket) {
        const i = bucket.indexOf(oldRb)
        if (i !== -1) bucket.splice(i, 1)
      }
    }

    oldGO.destroy()

    // Build new physics components
    const hitbox    = config.hasHitbox    ? makeHitbox(obj.key, scale) : undefined
    const rigidbody = config.hasRigidbody
      ? new Rigidbody3D({ layer: config.layer, isStatic: config.isStatic, hitbox })
      : undefined

    const context: SpawnContext = obj.key === 'FBX'
      ? { kind: 'fbx', asset: this._fbxCache.get(obj.selectedFbxUrl!)!, rigidbody, hitbox }
      : { kind: 'primitive', rigidbody, hitbox }

    const spawnFn = SPAWN_MAP[obj.key]
    const newGO   = spawnFn(this._engine, context)
    newGO.setPosition(pos)
    newGO.setQuaternion(quat)
    newGO.setScale(scale[0], scale[1], scale[2])
    newGO.setColor(color[0], color[1], color[2], color[3])

    // Register new rigidbody
    const newRb = newGO.getRigidbody()
    if (newRb) {
      let bucket = this._rigidbodyLayerMap.get(newRb.layer)
      if (!bucket) { bucket = []; this._rigidbodyLayerMap.set(newRb.layer, bucket) }
      bucket.push(newRb)
    }

    obj.gameObject    = newGO
    obj.physicsConfig = config
  }

  // ── Input wiring ──────────────────────────────────────────────────────────────

  private _wireInput(): void {
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      this._pressedKeys.add(event.code)
    })

    window.addEventListener('keyup', (event: KeyboardEvent) => {
      this._pressedKeys.delete(event.code)
    })

    window.addEventListener('mousedown', (event: MouseEvent) => {
      if (event.button === 0) this._mouseButtonDown = true
    })

    window.addEventListener('mouseup', (event: MouseEvent) => {
      if (event.button === 0) this._mouseButtonDown = false
    })

    window.addEventListener('mousemove', (event: MouseEvent) => {
      if (document.pointerLockElement === this._canvas) {
        this._mouseDeltaX += event.movementX
        this._mouseDeltaY += event.movementY
      } else if (this._mouseButtonDown) {
        this._mouseDeltaX += event.movementX
        this._mouseDeltaY += event.movementY
      }
    })

    // ESC releases pointer lock → browser fires pointerlockchange
    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement !== this._canvas && this._playing) {
        this.stop()
        // Notify the play button to revert label (dispatched for main.ts to handle)
        document.dispatchEvent(new CustomEvent('sandbox:stopped'))
      }
    })

    // Screen-space object picking (only active when not playing)
    this._canvas.addEventListener('click', (event: MouseEvent) => {
      if (this._playing) return

      const canvasRect   = this._canvas.getBoundingClientRect()
      const clickNdcX    = ((event.clientX - canvasRect.left) / canvasRect.width)  * 2 - 1
      const clickNdcY    = 1 - ((event.clientY - canvasRect.top) / canvasRect.height) * 2

      const cameraData   = this._engine.camera.getData()  // viewProj packed at indices [0..15]
      let closestObject: SpawnedObject | null = null
      let closestIndex  = -1
      let closestDistance = 0.08  // NDC pick threshold

      for (let i = 0; i < this._spawnedObjects.length; i++) {
        const spawnedObject = this._spawnedObjects[i]
        const [worldX, worldY, worldZ] = spawnedObject.gameObject.position
        // Transform world position by the viewProj matrix (column-major)
        const clipX = cameraData[0]*worldX + cameraData[4]*worldY + cameraData[8]*worldZ  + cameraData[12]
        const clipY = cameraData[1]*worldX + cameraData[5]*worldY + cameraData[9]*worldZ  + cameraData[13]
        const clipW = cameraData[3]*worldX + cameraData[7]*worldY + cameraData[11]*worldZ + cameraData[15]
        if (clipW <= 0) continue  // behind camera

        const screenNdcX = clipX / clipW
        const screenNdcY = clipY / clipW
        const distance   = Math.hypot(screenNdcX - clickNdcX, screenNdcY - clickNdcY)
        if (distance < closestDistance) {
          closestDistance = distance
          closestObject   = spawnedObject
          closestIndex    = i
        }
      }

      if (closestObject && closestIndex !== -1) {
        this._sceneHierarchy.setSelected(closestIndex)
        this._propertyPanel.show(closestObject.gameObject, closestObject.label, closestObject.properties, closestObject.physicsConfig, closestObject.selectedFbxUrl ?? undefined)
      }
    })
  }
}
