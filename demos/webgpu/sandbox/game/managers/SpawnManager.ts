import type { Engine, FbxAssetHandle } from '../../../../../src/webgpu/engine/index';
import type { ISceneObject } from '../../../../../src/webgpu/engine/index';
import { Rigidbody3D } from '../../../../../src/webgpu/engine/gameObject/rigidbody/Rigidbody3D';
import type { Terminal } from '../../ui/Terminal/Terminal';
import type { PropertyPanel } from '../../ui/PropertyPanel/PropertyPanel';
import type { SceneHierarchy } from '../../ui/SceneHierarchy/SceneHierarchy';
import type { ItemEntry, PropertyGroup, PhysicsConfig, SpawnContext, PrimitiveSpawnContext, FbxSpawnContext, LightSpawnContext } from '../../items/types';
import { spawn as spawnQuad } from '../../items/quad';
import { spawn as spawnCube } from '../../items/cube';
import { spawn as spawnFBX, FBX_CATALOG } from '../../items/fbx';
import { spawn as spawnLight } from '../../items/lights';
import { spawn as spawnDirectionalLight } from '../../items/directionalLight';

const DEFAULT_PHYSICS: PhysicsConfig = {
  hasRigidbody: false,
  isStatic:     false,
  hasHitbox:    false,
  layer:        'default',
};

const SPAWN_MAP: Record<string, (engine: Engine, context: SpawnContext) => ISceneObject> = {
  Quad:             (engine, context) => spawnQuad(engine, context as PrimitiveSpawnContext),
  Cube:             (engine, context) => spawnCube(engine, context as PrimitiveSpawnContext),
  FBX:              (engine, context) => spawnFBX(engine, context as FbxSpawnContext),
  Light:            (engine, context) => spawnLight(engine, context as LightSpawnContext),
  DirectionalLight: (engine, context) => spawnDirectionalLight(engine, context as LightSpawnContext),
};

export interface SpawnedObject {
  gameObject:     ISceneObject
  key:            string
  label:          string
  properties:     PropertyGroup[]
  physicsConfig:  PhysicsConfig
  selectedFbxUrl: string | null
  playSnapshot:   [number, number, number] | null
}

export class SpawnManager {
  private readonly _engine:          Engine;
  private readonly _terminal:        Terminal;
  private readonly _propertyPanel:   PropertyPanel;
  private readonly _sceneHierarchy:  SceneHierarchy;
  private readonly _fbxCache:        Map<string, FbxAssetHandle>;
  private readonly _rigidbodyLayerMap: Map<string, Rigidbody3D[]> = new Map();
  private readonly _spawnedObjects:  SpawnedObject[] = [];

  constructor(
    engine:         Engine,
    terminal:       Terminal,
    propertyPanel:  PropertyPanel,
    sceneHierarchy: SceneHierarchy,
    fbxCache:       Map<string, FbxAssetHandle>,
  ) {
    this._engine         = engine;
    this._terminal       = terminal;
    this._propertyPanel  = propertyPanel;
    this._sceneHierarchy = sceneHierarchy;
    this._fbxCache       = fbxCache;
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
      this._terminal.print(`${entry.label} is not yet available.`, 'warn');
      return;
    }

    const spawnFn = SPAWN_MAP[key];
    if (!spawnFn) {
      this._terminal.print(`No spawn handler registered for: ${key}`, 'warn');
      return;
    }

    const selectedFbxUrl = key === 'FBX' ? FBX_CATALOG[0].url : null;
    const context: SpawnContext = key === 'FBX'
      ? { kind: 'fbx', asset: this._fbxCache.get(selectedFbxUrl!)! }
      : key === 'Light' || key === 'DirectionalLight'
        ? { kind: 'light' }
        : { kind: 'primitive' };

    const gameObject = spawnFn(this._engine, context);

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
      playSnapshot:   null,
    });

    const index = this._spawnedObjects.length - 1;
    this._sceneHierarchy.addObject(label);
    this._sceneHierarchy.setSelected(index);
    this._propertyPanel.show(gameObject, label, entry.properties, physicsConfig, selectedFbxUrl ?? undefined);
    this._terminal.print(`Spawned ${label} at (0, 0, 0).`, 'log');
  }

  // ── Remove ────────────────────────────────────────────────────────────────────

  removeObject(index: number, selectedIndex: number): number {
    const obj = this._spawnedObjects[index];
    if (!obj) return selectedIndex;

    const rb = obj.gameObject.getRigidbody();
    if (rb) {
      const bucket = this._rigidbodyLayerMap.get(rb.layer);
      if (bucket) {
        const bucketIndex = bucket.indexOf(rb);
        if (bucketIndex !== -1) bucket.splice(bucketIndex, 1);
      }
    }

    if (this._propertyPanel.currentObject === obj.gameObject) {
      this._propertyPanel.hide();
    }

    obj.gameObject.destroy();
    this._spawnedObjects.splice(index, 1);
    this._sceneHierarchy.removeRow(index);

    this._terminal.print(`Removed ${obj.label}.`, 'log');

    if (selectedIndex === index) {
      return -1;
    } else if (selectedIndex > index) {
      return selectedIndex - 1;
    }
    return selectedIndex;
  }

  // ── Rename ────────────────────────────────────────────────────────────────────

  renameObject(index: number, newName: string): boolean {
    const obj = this._spawnedObjects[index];
    if (!obj) return false;
    obj.label = newName;
    this._sceneHierarchy.renameRow(index, newName);
    if (this._propertyPanel.currentObject === obj.gameObject) {
      this._propertyPanel.setTitle(newName);
    }
    return true;
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
