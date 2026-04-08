import type { Engine }           from '../../../../../src/webgpu/engine/index'
import type { SceneSnapshot, ObjectSnapshot, LightSnapshot, DirectionalLightSnapshot } from '../../../../../src/webgpu/engine/index'
import { LightGameObject }      from '../../../../../src/webgpu/engine/gameObject/LightGameObject'
import { SaveManager }          from '../../../../../src/webgpu/engine/index'
import type { Terminal }        from '../../ui/Terminal/Terminal'
import type { PhysicsConfig, PropertyGroup, ItemEntry } from '../../items/types'
import type { SpawnManager }    from './SpawnManager'
import type { PhysicsManager }  from './PhysicsManager'

export class SaveLoadManager {
  private readonly _engine:          Engine
  private readonly _spawnManager:    SpawnManager
  private readonly _physicsManager:  PhysicsManager
  private readonly _terminal:        Terminal
  private readonly _saveManager:     SaveManager

  constructor(
    engine:          Engine,
    spawnManager:    SpawnManager,
    physicsManager:  PhysicsManager,
    terminal:        Terminal,
  ) {
    this._engine         = engine
    this._spawnManager   = spawnManager
    this._physicsManager = physicsManager
    this._terminal       = terminal
    this._saveManager    = new SaveManager()
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async saveScene(): Promise<string> {
    const snapshot = this._buildSnapshot()
    return this._saveManager.save(snapshot)
  }

  // ── Load ──────────────────────────────────────────────────────────────────────

  async loadScene(encodedString: string): Promise<boolean> {
    const snapshot = await this._saveManager.load(encodedString)
    if (snapshot === null) {
      return false
    }
    this._applySnapshot(snapshot)
    return true
  }

  // ── Snapshot building ─────────────────────────────────────────────────────────

  private _buildSnapshot(): SceneSnapshot {
    const camera = this._engine.camera
    const cameraSnapshot = {
      position: [camera.position[0], camera.position[1], camera.position[2]] as [number, number, number],
      yaw:      camera.yaw,
      pitch:    camera.pitch,
    }

    const objectSnapshots: ObjectSnapshot[] = this._spawnManager.getObjects().map(spawnedObject => {
      const gameObject = spawnedObject.gameObject
      const baseFields = {
        label:         spawnedObject.label,
        properties:    spawnedObject.properties as string[],
        physicsConfig: { ...spawnedObject.physicsConfig },
        position:      [gameObject.position[0], gameObject.position[1], gameObject.position[2]] as [number, number, number],
        quaternion:    [gameObject.quaternion[0], gameObject.quaternion[1], gameObject.quaternion[2], gameObject.quaternion[3]] as [number, number, number, number],
        scale:         [gameObject.scale[0], gameObject.scale[1], gameObject.scale[2]] as [number, number, number],
        color:         [...gameObject.color] as [number, number, number, number],
      }

      switch (spawnedObject.key) {
        case 'Cube': {
          return { key: 'Cube', ...baseFields }
        }
        case 'Quad': {
          return { key: 'Quad', ...baseFields }
        }
        case 'FBX': {
          return { key: 'FBX', ...baseFields, assetUrl: spawnedObject.selectedFbxUrl! }
        }
        case 'Light': {
          const lightObject = gameObject as LightGameObject
          return {
            key:       'Light',
            ...baseFields,
            lightType: lightObject.lightType as 0 | 1,
            radius:    lightObject.radius,
            direction: [lightObject.direction[0], lightObject.direction[1], lightObject.direction[2]] as [number, number, number],
          }
        }
        case 'DirectionalLight': {
          const lightObject = gameObject as LightGameObject
          return {
            key:       'DirectionalLight',
            ...baseFields,
            lightType: 2 as const,
            radius:    lightObject.radius,
            direction: [lightObject.direction[0], lightObject.direction[1], lightObject.direction[2]] as [number, number, number],
          }
        }
        default: {
          return { key: 'Cube', ...baseFields }
        }
      }
    })

    return {
      version: 1,
      camera:  cameraSnapshot,
      objects: objectSnapshots,
    }
  }

  // ── Snapshot application ──────────────────────────────────────────────────────

  private _applySnapshot(snapshot: SceneSnapshot): void {
    while (this._spawnManager.getObjects().length > 0) {
      this._spawnManager.removeObject(0, -1)
    }

    const camera = this._engine.camera
    camera.setPosition(snapshot.camera.position[0], snapshot.camera.position[1], snapshot.camera.position[2])
    camera.yaw   = snapshot.camera.yaw
    camera.pitch = snapshot.camera.pitch

    for (const objectRecord of snapshot.objects) {
      const itemEntry: ItemEntry = {
        key:        objectRecord.key,
        label:      objectRecord.key,
        isReady:    true,
        properties: objectRecord.properties as PropertyGroup[],
      }
      this._spawnManager.spawn(objectRecord.key, itemEntry)
      const spawnedObjectIndex = this._spawnManager.getObjects().length - 1
      const spawnedObject = this._spawnManager.getObject(spawnedObjectIndex)!

      if (objectRecord.key === 'Light' || objectRecord.key === 'DirectionalLight') {
        _applyLightRecord(spawnedObject.gameObject as LightGameObject, objectRecord)
      } else {
        if (objectRecord.key === 'FBX') {
          spawnedObject.selectedFbxUrl = objectRecord.assetUrl
        }
        this._physicsManager.rebuildObject(spawnedObjectIndex, objectRecord.physicsConfig as PhysicsConfig)
        const rebuiltObject = this._spawnManager.getObject(spawnedObjectIndex)!
        rebuiltObject.gameObject.setPosition([objectRecord.position[0], objectRecord.position[1], objectRecord.position[2]])
        rebuiltObject.gameObject.setQuaternion([objectRecord.quaternion[0], objectRecord.quaternion[1], objectRecord.quaternion[2], objectRecord.quaternion[3]])
        rebuiltObject.gameObject.setScale(objectRecord.scale[0], objectRecord.scale[1], objectRecord.scale[2])
        rebuiltObject.gameObject.setColor(objectRecord.color[0], objectRecord.color[1], objectRecord.color[2], objectRecord.color[3])
      }

      this._spawnManager.renameObject(spawnedObjectIndex, objectRecord.label)
    }

    this._terminal.print(`Scene loaded: ${snapshot.objects.length} object(s) restored.`, 'log')
  }
}

function _applyLightRecord(
  lightObject: LightGameObject,
  objectRecord: LightSnapshot | DirectionalLightSnapshot,
): void {
  lightObject.setPosition([objectRecord.position[0], objectRecord.position[1], objectRecord.position[2]])
  lightObject.setColor(objectRecord.color[0], objectRecord.color[1], objectRecord.color[2], objectRecord.color[3])
  lightObject.setLightType(objectRecord.lightType)
  if (objectRecord.lightType !== 0) {
    lightObject.setRadius(objectRecord.radius)
  }
  lightObject.setDirection([objectRecord.direction[0], objectRecord.direction[1], objectRecord.direction[2]])
}
