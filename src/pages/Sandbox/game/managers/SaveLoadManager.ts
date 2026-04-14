import type { Engine, SaveSegments, SceneConstantsSnapshot, GameObjectsSnapshot, LightObjectsSnapshot, GameObjectSnapshot, LightObjectSnapshot, LightSnapshot, DirectionalLightSnapshot } from '@engine';
import { LightGameObject, SaveManager } from '@engine';
import type { Terminal }        from '../../ui/Terminal/Terminal';
import type { PhysicsConfig, PropertyGroup, ItemEntry } from '../../items/types';
import type { SpawnManager }    from './SpawnManager';
import type { PhysicsManager }  from './PhysicsManager';

const LIGHT_KEYS = new Set(['Light', 'DirectionalLight']);

export class SaveLoadManager {
  private readonly _engine:          Engine;
  private readonly _spawnManager:    SpawnManager;
  private readonly _physicsManager:  PhysicsManager;
  private readonly _terminal:        Terminal;
  private readonly _saveManager:     SaveManager;

  constructor(
    engine:          Engine,
    spawnManager:    SpawnManager,
    physicsManager:  PhysicsManager,
    terminal:        Terminal,
  ) {
    this._engine         = engine;
    this._spawnManager   = spawnManager;
    this._physicsManager = physicsManager;
    this._terminal       = terminal;
    this._saveManager    = new SaveManager();
  }

  // ── Save ──────────────────────────────────────────────────────────────────────

  async saveScene(): Promise<string> {
    const segments: SaveSegments = {
      sceneConstants: [this._buildSceneConstants()],
      gameObjects:    [this._buildGameObjects()],
      lightObjects:   [this._buildLightObjects()],
    };
    return this._saveManager.save(segments);
  }

  // ── Load ──────────────────────────────────────────────────────────────────────

  async loadScene(encodedString: string): Promise<boolean> {
    const segments = await this._saveManager.load(encodedString);
    if (segments === null) {
      return false;
    }
    this._applySegments(segments);
    return true;
  }

  // ── Snapshot building ─────────────────────────────────────────────────────────

  private _buildSceneConstants(): SceneConstantsSnapshot {
    const camera = this._engine.camera;
    return {
      version: 1,
      camera: {
        position: [camera.position[0], camera.position[1], camera.position[2]],
        yaw:      camera.yaw,
        pitch:    camera.pitch,
      },
    };
  }

  private _buildGameObjects(): GameObjectsSnapshot {
    const objects: GameObjectSnapshot[] = this._spawnManager.getObjects()
      .filter(spawnedObject => !LIGHT_KEYS.has(spawnedObject.key))
      .map(spawnedObject => {
        const gameObject = spawnedObject.gameObject;
        const baseFields = {
          label:         spawnedObject.label,
          properties:    spawnedObject.properties as string[],
          physicsConfig: { ...spawnedObject.physicsConfig },
          position:      [gameObject.position[0], gameObject.position[1], gameObject.position[2]] as [number, number, number],
          quaternion:    [gameObject.quaternion[0], gameObject.quaternion[1], gameObject.quaternion[2], gameObject.quaternion[3]] as [number, number, number, number],
          scale:         [gameObject.scale[0], gameObject.scale[1], gameObject.scale[2]] as [number, number, number],
          color:         [...gameObject.color] as [number, number, number, number],
        };
        switch (spawnedObject.key) {
          case 'Cube': return { key: 'Cube' as const, ...baseFields };
          case 'Quad': return { key: 'Quad' as const, ...baseFields };
          case 'FBX':  return { key: 'FBX' as const, ...baseFields, assetUrl: spawnedObject.selectedFbxUrl! };
          default:     return { key: 'Cube' as const, ...baseFields };
        }
      });
    return { version: 1, objects };
  }

  private _buildLightObjects(): LightObjectsSnapshot {
    const objects: LightObjectSnapshot[] = this._spawnManager.getObjects()
      .filter(spawnedObject => LIGHT_KEYS.has(spawnedObject.key))
      .map(spawnedObject => {
        const lightObject = spawnedObject.gameObject as LightGameObject;
        const baseFields = {
          label:         spawnedObject.label,
          properties:    spawnedObject.properties as string[],
          physicsConfig: { ...spawnedObject.physicsConfig },
          position:      [lightObject.position[0], lightObject.position[1], lightObject.position[2]] as [number, number, number],
          quaternion:    [lightObject.quaternion[0], lightObject.quaternion[1], lightObject.quaternion[2], lightObject.quaternion[3]] as [number, number, number, number],
          scale:         [lightObject.scale[0], lightObject.scale[1], lightObject.scale[2]] as [number, number, number],
          color:         [...lightObject.color] as [number, number, number, number],
          radius:        lightObject.radius,
          direction:     [lightObject.direction[0], lightObject.direction[1], lightObject.direction[2]] as [number, number, number],
        };
        if (spawnedObject.key === 'DirectionalLight') {
          return { key: 'DirectionalLight' as const, ...baseFields, lightType: 2 as const };
        }
        return { key: 'Light' as const, ...baseFields, lightType: lightObject.lightType as 0 | 1 };
      });
    return { version: 1, objects };
  }

  // ── Segment application ───────────────────────────────────────────────────────

  private _applySegments(segments: SaveSegments): void {
    if (segments.sceneConstants.length > 0) {
      const { camera } = segments.sceneConstants[0];
      const engineCamera = this._engine.camera;
      engineCamera.setPosition(camera.position[0], camera.position[1], camera.position[2]);
      engineCamera.yaw   = camera.yaw;
      engineCamera.pitch = camera.pitch;
    }

    if (segments.gameObjects.length > 0) {
      this._removeObjectsByKeys(key => !LIGHT_KEYS.has(key));
      for (const snapshot of segments.gameObjects) {
        for (const objectRecord of snapshot.objects) {
          this._spawnGameObject(objectRecord);
        }
      }
    }

    if (segments.lightObjects.length > 0) {
      this._removeObjectsByKeys(key => LIGHT_KEYS.has(key));
      for (const snapshot of segments.lightObjects) {
        for (const objectRecord of snapshot.objects) {
          this._spawnLightObject(objectRecord);
        }
      }
    }

    const totalObjects = segments.gameObjects.reduce((sum: number, s: GameObjectsSnapshot) => sum + s.objects.length, 0)
      + segments.lightObjects.reduce((sum: number, s: LightObjectsSnapshot) => sum + s.objects.length, 0);
    this._terminal.print(`Scene loaded: ${totalObjects} object(s) restored.`, 'log');
  }

  private _removeObjectsByKeys(predicate: (key: string) => boolean): void {
    const objects = this._spawnManager.getObjects();
    for (let index = objects.length - 1; index >= 0; index--) {
      if (predicate(objects[index].key)) {
        this._spawnManager.removeObject(index);
      }
    }
  }

  private _spawnGameObject(objectRecord: GameObjectSnapshot): void {
    const itemEntry: ItemEntry = {
      key:        objectRecord.key,
      label:      objectRecord.key,
      isReady:    true,
      properties: objectRecord.properties as PropertyGroup[],
    };
    this._spawnManager.spawn(objectRecord.key, itemEntry);
    const spawnedObjectIndex = this._spawnManager.getObjects().length - 1;
    const spawnedObject = this._spawnManager.getObject(spawnedObjectIndex)!;

    if (objectRecord.key === 'FBX') {
      spawnedObject.selectedFbxUrl = objectRecord.assetUrl;
    }
    this._physicsManager.rebuildObject(spawnedObjectIndex, objectRecord.physicsConfig as PhysicsConfig);
    const rebuiltObject = this._spawnManager.getObject(spawnedObjectIndex)!;
    rebuiltObject.gameObject.setPosition([objectRecord.position[0], objectRecord.position[1], objectRecord.position[2]]);
    rebuiltObject.gameObject.setQuaternion([objectRecord.quaternion[0], objectRecord.quaternion[1], objectRecord.quaternion[2], objectRecord.quaternion[3]]);
    rebuiltObject.gameObject.setScale(objectRecord.scale[0], objectRecord.scale[1], objectRecord.scale[2]);
    rebuiltObject.gameObject.setColor(objectRecord.color[0], objectRecord.color[1], objectRecord.color[2], objectRecord.color[3]);
    this._spawnManager.renameObject(spawnedObjectIndex, objectRecord.label);
  }

  private _spawnLightObject(objectRecord: LightObjectSnapshot): void {
    const itemEntry: ItemEntry = {
      key:        objectRecord.key,
      label:      objectRecord.key,
      isReady:    true,
      properties: objectRecord.properties as PropertyGroup[],
    };
    this._spawnManager.spawn(objectRecord.key, itemEntry);
    const spawnedObjectIndex = this._spawnManager.getObjects().length - 1;
    _applyLightRecord(this._spawnManager.getObject(spawnedObjectIndex)!.gameObject as LightGameObject, objectRecord);
    this._spawnManager.renameObject(spawnedObjectIndex, objectRecord.label);
  }
}

function _applyLightRecord(
  lightObject: LightGameObject,
  objectRecord: LightSnapshot | DirectionalLightSnapshot,
): void {
  lightObject.setPosition([objectRecord.position[0], objectRecord.position[1], objectRecord.position[2]]);
  lightObject.setColor(objectRecord.color[0], objectRecord.color[1], objectRecord.color[2], objectRecord.color[3]);
  lightObject.setLightType(objectRecord.lightType);
  if (objectRecord.lightType !== 0) {
    lightObject.setRadius(objectRecord.radius);
  } else {
    lightObject.setStrength(objectRecord.radius);
  }
  lightObject.setDirection([objectRecord.direction[0], objectRecord.direction[1], objectRecord.direction[2]]);
}
