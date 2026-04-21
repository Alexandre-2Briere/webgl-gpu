import type { Engine, ISceneObject, IGameObject, Vec3 } from '@engine';
import { LightGameObject, applyPhysics, applyCollisions, Rigidbody3D, CubeHitbox } from '@engine';
import type { SpawnManager } from './SpawnManager';
import type { SpawnContext, PhysicsConfig } from '../../items/types';
import { SANDBOX_EVENTS } from '../events';
import type {
  PubSubManager,
  PropertyPhysicsChangedPayload,
  PropertyScaleChangedPayload,
  PropertyRadiusChangedPayload,
  PropertyLightTypeChangedPayload,
  PropertyAssetChangedPayload,
} from '../events';
import { spawn as spawnQuad } from '../../items/quad';
import { spawn as spawnCube } from '../../items/cube';
import { spawn as spawnFBX } from '../../items/fbx';
import { spawn as spawnLight } from '../../items/lights';
import { spawn as spawnDirectionalLight } from '../../items/directionalLight';
import type { PrimitiveSpawnContext, FbxSpawnContext, LightSpawnContext } from '../../items/types';

const REBUILD_MAP: Record<string, (engine: Engine, context: SpawnContext) => ISceneObject> = {
  Quad:             (engine, context) => spawnQuad(engine, context as PrimitiveSpawnContext),
  Cube:             (engine, context) => spawnCube(engine, context as PrimitiveSpawnContext),
  FBX:              (engine, context) => spawnFBX(engine, context as FbxSpawnContext),
  Light:            (engine, context) => spawnLight(engine, context as LightSpawnContext),
  DirectionalLight: (engine, context) => spawnDirectionalLight(engine, context as LightSpawnContext),
};

function isGameObject(object: ISceneObject): object is IGameObject {
  return 'renderable' in object;
}

function makeHitbox(key: string, scale: Vec3): CubeHitbox {
  if (key === 'Quad') return new CubeHitbox([scale[0] * 0.5, 0.01, scale[2] * 0.5]);
  return new CubeHitbox([scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5]);
}

export class PhysicsManager {
  private readonly _engine:       Engine;
  private readonly _spawnManager: SpawnManager;

  constructor(engine: Engine, spawnManager: SpawnManager, pubSub: PubSubManager) {
    this._engine       = engine;
    this._spawnManager = spawnManager;

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_PHYSICS_CHANGED, (data: unknown) => {
      const { objectIndex, data: { config } } = data as PropertyPhysicsChangedPayload;
      this.rebuildObject(objectIndex, config);
      pubSub.publish(SANDBOX_EVENTS.OBJECT_REBUILT, { objectIndex });
    });

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_ASSET_CHANGED, (data: unknown) => {
      const { objectIndex, data: { url } } = data as PropertyAssetChangedPayload;
      const obj = this._spawnManager.getObject(objectIndex);
      if (!obj) return;
      obj.selectedFbxUrl = url;
      this.rebuildObject(objectIndex, obj.physicsConfig);
      pubSub.publish(SANDBOX_EVENTS.OBJECT_REBUILT, { objectIndex });
    });

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_SCALE_CHANGED, (data: unknown) => {
      const { objectIndex, data: { x, y, z } } = data as PropertyScaleChangedPayload;
      const obj = this._spawnManager.getObject(objectIndex);
      if (!obj || !isGameObject(obj.gameObject)) return;
      const hitbox = obj.gameObject.hitbox;
      if (hitbox?.type === 'cube') {
        const halfY = obj.key === 'Quad' ? 0.01 : y * 0.5;
        (hitbox as CubeHitbox).halfExtents = [x * 0.5, halfY, z * 0.5];
      }
    });

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_RADIUS_CHANGED, (data: unknown) => {
      const { objectIndex, data: { radius } } = data as PropertyRadiusChangedPayload;
      const obj = this._spawnManager.getObject(objectIndex);
      if (obj?.gameObject instanceof LightGameObject) {
        obj.gameObject.setRadius(radius);
      }
    });

    pubSub.subscribe(SANDBOX_EVENTS.PROPERTY_LIGHT_TYPE_CHANGED, (data: unknown) => {
      const { objectIndex, data: { lightType } } = data as PropertyLightTypeChangedPayload;
      const obj = this._spawnManager.getObject(objectIndex);
      if (obj?.gameObject instanceof LightGameObject) {
        obj.gameObject.setLightType(lightType);
      }
    });
  }

  // ── Per-frame tick ────────────────────────────────────────────────────────────

  tick(deltaTime: number): void {
    const objects = this._spawnManager.getObjects();
    const gameObjects = objects.map(s => s.gameObject).filter(isGameObject);
    applyPhysics(gameObjects, deltaTime);
    applyCollisions(this._spawnManager.getRigidbodyLayerMap(), gameObjects);
  }

  // ── Object rebuild (physics config change) ────────────────────────────────────

  rebuildObject(index: number, config: PhysicsConfig): void {
    const obj = this._spawnManager.getObject(index);
    if (!obj || !isGameObject(obj.gameObject)) return;
    const oldGameObject = obj.gameObject;

    const position = [...oldGameObject.position] as [number, number, number];
    const quaternion = [...oldGameObject.quaternion] as [number, number, number, number];
    const scale = [...oldGameObject.scale] as Vec3;
    const color = [...oldGameObject.color] as [number, number, number, number];

    const oldRigidbody = oldGameObject.getRigidbody();
    if (oldRigidbody) this._spawnManager.unregisterRigidbody(oldRigidbody);

    oldGameObject.destroy();

    const hitbox    = config.hasHitbox    ? makeHitbox(obj.key, scale) : undefined;
    const rigidbody = config.hasRigidbody
      ? new Rigidbody3D({ layer: config.layer, isStatic: config.isStatic, hitbox })
      : undefined;

    const context: SpawnContext = obj.key === 'FBX'
      ? { kind: 'fbx', asset: this._spawnManager.getFbxCache().get(obj.selectedFbxUrl!)!, rigidbody, hitbox }
      : { kind: 'primitive', rigidbody, hitbox };

    const spawnFn = REBUILD_MAP[obj.key];
    const newGameObject = spawnFn(this._engine, context);
    newGameObject.setPosition(position);
    newGameObject.setQuaternion(quaternion);
    newGameObject.setScale(scale[0], scale[1], scale[2]);
    newGameObject.setColor(color[0], color[1], color[2], color[3]);

    const newRigidbody = newGameObject.getRigidbody();
    if (newRigidbody) this._spawnManager.registerRigidbody(newRigidbody);

    obj.gameObject   = newGameObject;
    obj.physicsConfig = config;
  }

  // ── Snapshot reset (on stop) ──────────────────────────────────────────────────

  resetToSnapshots(): void {
    for (const spawnedObject of this._spawnManager.getObjects()) {
      const { gameObject, playSnapshot } = spawnedObject;
      if (playSnapshot) {
        gameObject.setPosition([playSnapshot[0], playSnapshot[1], playSnapshot[2]]);
      }
      const rigidbody = gameObject.getRigidbody();
      if (rigidbody) {
        rigidbody.velocity[0] = 0;
        rigidbody.velocity[1] = 0;
        rigidbody.velocity[2] = 0;
      }
    }
  }
}
