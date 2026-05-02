import { type Engine, type FbxAssetHandle, type ISceneObject, Rigidbody3D } from '@engine';
import type { ItemEntry, PhysicsConfig, SpawnContext, PrimitiveSpawnContext, FbxSpawnContext, LightSpawnContext, SingletonSpawnContext } from '../../items/types';
import { spawn as spawnQuad } from '../../items/quad';
import { spawn as spawnCube } from '../../items/cube';
import { spawn as spawnFBX, FBX_CATALOG } from '../../items/fbx';
import { spawn as spawnLight } from '../../items/lights';
import { spawn as spawnDirectionalLight } from '../../items/directionalLight';
import { spawn as spawnSkybox } from '../../items/skybox';
import { spawn as spawnInfiniteGround } from '../../items/infiniteGround';
import { spawn as spawnScriptObject } from '../../items/scriptObject';
import {
  SANDBOX_EVENTS,
  type PubSubManager,
  type PropertyScriptChangedPayload,
  type PropertyScriptArgsChangedPayload,
} from '../events';
import type { SpawnedObject } from './SpawnedObject';

export type { SpawnedObject };

const DEFAULT_PHYSICS: PhysicsConfig = {
  hasRigidbody: false,
  isStatic:     false,
  hasHitbox:    false,
  layer:        'default',
};

const SINGLETON_KEYS = new Set(['Skybox', 'InfiniteGround']);

const SPAWN_MAP: Record<string, (engine: Engine, context: SpawnContext) => ISceneObject> = {
  Quad:             (engine, context) => spawnQuad(engine, context as PrimitiveSpawnContext),
  Cube:             (engine, context) => spawnCube(engine, context as PrimitiveSpawnContext),
  FBX:              (engine, context) => spawnFBX(engine, context as FbxSpawnContext),
  Light:            (engine, context) => spawnLight(engine, context as LightSpawnContext),
  DirectionalLight: (engine, context) => spawnDirectionalLight(engine, context as LightSpawnContext),
  Skybox:           (engine, context) => spawnSkybox(engine, context as SingletonSpawnContext),
  InfiniteGround:   (engine, context) => spawnInfiniteGround(engine, context as SingletonSpawnContext),
  ScriptObject:     (engine, _context) => spawnScriptObject(engine),
};


export class SpawnManager {
  private readonly _engine:          Engine;
  private readonly _fbxCache:        Map<string, FbxAssetHandle>;
  private readonly _pubSub:          PubSubManager;
  private readonly _rigidbodyLayerMap: Map<string, Rigidbody3D[]> = new Map();
  private readonly _spawnedObjects:  SpawnedObject[] = [];

  constructor(
    engine:   Engine,
    fbxCache: Map<string, FbxAssetHandle>,
    pubSub:   PubSubManager,
  ) {
    this._engine   = engine;
    this._fbxCache = fbxCache;
    this._pubSub   = pubSub;

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_SCRIPT_CHANGED, (raw) => {
      const payload = raw as unknown as PropertyScriptChangedPayload;
      const object = this._spawnedObjects[payload.objectIndex];
      if (object) object.selectedScript = payload.data.scriptName;
    });

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_SCRIPT_ARGS_CHANGED, (raw) => {
      const payload = raw as unknown as PropertyScriptArgsChangedPayload;
      const object = this._spawnedObjects[payload.objectIndex];
      if (object) object.selectedScriptArgs = payload.data.args;
    });
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  getObjects(): SpawnedObject[] {
    return this._spawnedObjects;
  }

  getObject(index: number): SpawnedObject | undefined {
    return this._spawnedObjects[index];
  }

  getRigidbodyLayerMap(): Map<string, Rigidbody3D[]> {
    return this._rigidbodyLayerMap;
  }

  getFbxCache(): Map<string, FbxAssetHandle> {
    return this._fbxCache;
  }

  // ── Spawn ─────────────────────────────────────────────────────────────────────

  spawn(key: string, entry: ItemEntry): void {
    if (!entry.isReady) {
      this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: `${entry.label} is not yet available.`, level: 'warn' });
      return;
    }

    const spawnFn = SPAWN_MAP[key];
    if (!spawnFn) {
      this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: `No spawn handler registered for: ${key}`, level: 'warn' });
      return;
    }

    const selectedFbxUrl = key === 'FBX' ? FBX_CATALOG[0].url : null;
    const context: SpawnContext = key === 'FBX'
      ? { kind: 'fbx', asset: this._fbxCache.get(selectedFbxUrl!)! }
      : key === 'Light' || key === 'DirectionalLight'
        ? { kind: 'light' }
        : SINGLETON_KEYS.has(key)
          ? { kind: 'singleton' }
          : { kind: 'primitive' };

    let gameObject: ISceneObject;
    try {
      gameObject = spawnFn(this._engine, context);
    } catch {
      this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: `${entry.label} already exists in the scene.`, level: 'warn' });
      return;
    }

    const rb = gameObject.getRigidbody();
    if (rb) {
      let bucket = this._rigidbodyLayerMap.get(rb.layer);
      if (!bucket) { bucket = []; this._rigidbodyLayerMap.set(rb.layer, bucket); }
      bucket.push(rb);
    }

    const label = this._generateUniqueName(entry.label);
    const physicsConfig: PhysicsConfig = { ...DEFAULT_PHYSICS };

    this._spawnedObjects.push({
      gameObject,
      key,
      label,
      properties:     entry.properties,
      physicsConfig,
      selectedFbxUrl,
      playSnapshot:       null,
      selectedScript:     null,
      selectedScriptArgs: {},
      scriptHandle:       null,
    });

    const index = this._spawnedObjects.length - 1;
    this._pubSub.publish(SANDBOX_EVENTS.HIERARCHY_ROW_ADDED, { name: label, key });
    this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: `Spawned ${label} at (0, 0, 0).`, level: 'log' });
    this._pubSub.publish(SANDBOX_EVENTS.OBJECT_SPAWNED, { index });
  }

  // ── Remove ────────────────────────────────────────────────────────────────────

  removeObject(index: number): void {
    const obj = this._spawnedObjects[index];
    if (!obj) return;

    const rb = obj.gameObject.getRigidbody();
    if (rb) {
      const bucket = this._rigidbodyLayerMap.get(rb.layer);
      if (bucket) {
        const bucketIndex = bucket.indexOf(rb);
        if (bucketIndex !== -1) bucket.splice(bucketIndex, 1);
      }
    }

    obj.gameObject.destroy();
    this._spawnedObjects.splice(index, 1);
    this._pubSub.publish(SANDBOX_EVENTS.HIERARCHY_ROW_REMOVED, { index });
    this._pubSub.publish(SANDBOX_EVENTS.TERMINAL_PRINT, { message: `Removed ${obj.label}.`, level: 'log' });
    this._pubSub.publish(SANDBOX_EVENTS.OBJECT_REMOVED, { removedIndex: index });
  }

  // ── Rename ────────────────────────────────────────────────────────────────────

  renameObject(index: number, newName: string): boolean {
    const obj = this._spawnedObjects[index];
    if (!obj) return false;
    obj.label = newName;
    this._pubSub.publish(SANDBOX_EVENTS.HIERARCHY_ROW_RENAMED, { index, name: newName });
    return true;
  }

  // ── Register external objects ─────────────────────────────────────────────────

  addObject(
    gameObject: ISceneObject,
    label:      string,
    key:        string,
    assetUrl:   string | null,
  ): void {
    const uniqueLabel = this._generateUniqueName(label);
    this._spawnedObjects.push({
      gameObject,
      key,
      label:              uniqueLabel,
      properties:         [],
      physicsConfig:      { ...DEFAULT_PHYSICS },
      selectedFbxUrl:     assetUrl,
      playSnapshot:       null,
      selectedScript:     null,
      selectedScriptArgs: {},
      scriptHandle:       null,
    });
    const index = this._spawnedObjects.length - 1;
    this._pubSub.publish(SANDBOX_EVENTS.HIERARCHY_ROW_ADDED, { name: uniqueLabel, key });
    this._pubSub.publish(SANDBOX_EVENTS.OBJECT_SPAWNED, { index });
  }

  // ── Rebuild (used by PhysicsManager) ─────────────────────────────────────────

  registerRigidbody(rigidbody: Rigidbody3D): void {
    let bucket = this._rigidbodyLayerMap.get(rigidbody.layer);
    if (!bucket) { bucket = []; this._rigidbodyLayerMap.set(rigidbody.layer, bucket); }
    bucket.push(rigidbody);
  }

  unregisterRigidbody(rigidbody: Rigidbody3D): void {
    const bucket = this._rigidbodyLayerMap.get(rigidbody.layer);
    if (!bucket) return;
    const bucketIndex = bucket.indexOf(rigidbody);
    if (bucketIndex !== -1) bucket.splice(bucketIndex, 1);
  }

  // ── Private ───────────────────────────────────────────────────────────────────

  private _generateUniqueName(base: string): string {
    const existing = new Set(this._spawnedObjects.map(s => s.label));
    if (!existing.has(base)) return base;
    let counter = 1;
    while (existing.has(`${base} (${counter})`)) counter++;
    return `${base} (${counter})`;
  }
}
