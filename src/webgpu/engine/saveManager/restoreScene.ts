import type { Engine } from '../Engine';
import type { IGameObject } from '../gameObject/3D/3DGameObject';
import { LightGameObject } from '../gameObject/Light/LightGameObject';
import { Rigidbody3D } from '../gameObject/3D/rigidbody/Rigidbody3D';
import { CubeHitbox } from '../gameObject/3D/hitbox/CubeHitbox';
import { applyPhysics } from '../gameObject/3D/rigidbody/physicsStep';
import { applyCollisions } from '../gameObject/3D/rigidbody/collisionStep';
import { buildCubeVertices } from '../utils/buildCubeVertices';
import type { SaveSegments, GameObjectSnapshot, LightObjectSnapshot } from './types';

export async function restoreFromSnapshot(engine: Engine, segments: SaveSegments): Promise<void> {
  if (segments.sceneConstants.length > 0) {
    const { camera: cameraData } = segments.sceneConstants[0];
    const camera = engine.createCamera({
      position: cameraData.position,
      yaw:      cameraData.yaw,
      pitch:    cameraData.pitch,
    });
    engine.setCamera(camera);
  }

  const allObjects: (GameObjectSnapshot | LightObjectSnapshot)[] = [
    ...segments.gameObjects.flatMap(snapshot => snapshot.objects),
    ...segments.lightObjects.flatMap(snapshot => snapshot.objects),
  ];

  const objects: IGameObject[] = [];
  const layerMap = new Map<string, Rigidbody3D[]>();
  const fbxCache = new Map<string, Awaited<ReturnType<typeof engine.loadFbx>>>();

  for (const record of allObjects) {
    const spawned = await _spawnFromRecord(engine, record, fbxCache);
    if (spawned === null || spawned instanceof LightGameObject) continue;

    const gameObject = spawned;
    objects.push(gameObject);

    const rigidbody = gameObject.getRigidbody();
    if (rigidbody) {
      const bucket = layerMap.get(rigidbody.layer) ?? [];
      bucket.push(rigidbody);
      layerMap.set(rigidbody.layer, bucket);
    }
  }

  engine.onFrame(deltaTime => {
    applyPhysics(objects, deltaTime);
    applyCollisions(layerMap, objects);
  });
}

async function _spawnFromRecord(
  engine:   Engine,
  record:   GameObjectSnapshot | LightObjectSnapshot,
  fbxCache: Map<string, Awaited<ReturnType<typeof engine.loadFbx>>>,
): Promise<IGameObject | LightGameObject | null> {
  const { position, quaternion, scale, physicsConfig } = record;

  let rigidbody: Rigidbody3D | undefined;
  let hitbox: CubeHitbox | undefined;
  if (physicsConfig.hasRigidbody) {
    rigidbody = new Rigidbody3D({
      layer:    physicsConfig.layer,
      isStatic: physicsConfig.isStatic,
    });
    if (physicsConfig.hasHitbox) {
      hitbox = new CubeHitbox([scale[0] / 2, scale[1] / 2, scale[2] / 2]);
    }
  }

  switch (record.key) {
    case 'Cube': {
      const { vertices, indices } = buildCubeVertices(record.color);
      return engine.createMesh({
        renderable: { vertices, indices },
        position, quaternion, scale, rigidbody, hitbox,
      });
    }

    case 'Quad': {
      return engine.createQuad3D({
        renderable: {
          normal: [0, 1, 0],
          width:  record.scale[0],
          height: record.scale[2],
          color:  record.color,
        },
        position, quaternion,
      });
    }

    case 'FBX': {
      let asset = fbxCache.get(record.assetUrl);
      if (!asset) {
        asset = await engine.loadFbx(record.assetUrl);
        fbxCache.set(record.assetUrl, asset);
      }
      return engine.createFbxModel({
        renderable: { asset },
        position, quaternion, scale, rigidbody, hitbox,
      });
    }

    case 'Light':
    case 'DirectionalLight': {
      let lightObject;
      if (record.lightType === 2) {
        lightObject = engine.createDirectionalLight();
      } else if (record.lightType === 0) {
        lightObject = engine.createAmbientLight();
      } else {
        lightObject = engine.createPointLight({ radius: record.radius });
      }
      lightObject.setPosition(record.position);
      lightObject.setColor(record.color[0], record.color[1], record.color[2], record.color[3]);
      lightObject.setDirection(record.direction);
      return lightObject;
    }

    default:
      return null;
  }
}
