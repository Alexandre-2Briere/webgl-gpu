import { type Engine, type FbxAssetHandle, type IGameObject } from '@engine';
import pathJson from './path.json';
import { rotationQuaternion, type TileType, type Rotation } from './MapGeneratorConstants';
import { resolveFbxUrl } from './MapGeneratorHelpers';

const THEME = 'rock' as const;
const CENTER_INDEX = (pathJson.meta.gridWidth - 1) / 2;
const TILE_SIZE = pathJson.meta.tileSize;

export interface PathTile {
  gameObject: IGameObject;
  label:      string;
  assetUrl:   string;
}

export function loadPath(
  engine:   Engine,
  fbxCache: Map<string, FbxAssetHandle>,
): PathTile[] {
  const assetUrls    = new Map<string, string>();
  const firstModels  = new Map<string, IGameObject>();
  const result: PathTile[] = [];

  for (const tile of pathJson.tiles) {
    const type = tile.type as TileType;

    if (!assetUrls.has(type)) {
      assetUrls.set(type, resolveFbxUrl(THEME, type));
    }

    const assetUrl = assetUrls.get(type)!;
    const asset    = fbxCache.get(assetUrl);
    if (!asset) continue;

    const positionX  = (tile.col - CENTER_INDEX) * TILE_SIZE;
    const positionZ  = (tile.row - CENTER_INDEX) * TILE_SIZE;
    const quaternion = rotationQuaternion[tile.rotation as Rotation];

    const existing = firstModels.get(type);
    let gameObject: IGameObject;

    if (!existing) {
      gameObject = engine.createFbxModel({
        renderable: { asset },
        position:   [positionX, 0, positionZ],
        quaternion,
        scale:      [1, 1, 1],
      });
      firstModels.set(type, gameObject);
    } else {
      gameObject = existing.copy();
      gameObject.setPosition([positionX, 0, positionZ]);
      gameObject.setQuaternion(quaternion);
    }

    result.push({ gameObject, label: `Path ${type}`, assetUrl });
  }

  const pathPositions = new Set(pathJson.tiles.map(t => `${t.row},${t.col}`));
  const emptyType     = '' as TileType;
  const emptyAssetUrl = resolveFbxUrl(THEME, emptyType);
  const emptyAsset    = fbxCache.get(emptyAssetUrl);

  if (emptyAsset) {
    let firstEmpty: IGameObject | undefined;
    for (let row = 0; row <= pathJson.meta.gridDepth + 1; row++) {
      for (let col = 0; col <= pathJson.meta.gridWidth + 1; col++) {
        if (pathPositions.has(`${row},${col}`)) continue;
        const positionX  = (col - CENTER_INDEX) * TILE_SIZE;
        const positionZ  = (row - CENTER_INDEX) * TILE_SIZE;
        const quaternion = rotationQuaternion[0];
        let gameObject: IGameObject;
        if (!firstEmpty) {
          gameObject = engine.createFbxModel({
            renderable: { asset: emptyAsset },
            position:   [positionX, 0, positionZ],
            quaternion,
            scale:      [1, 1, 1],
          });
          firstEmpty = gameObject;
        } else {
          gameObject = firstEmpty.copy();
          gameObject.setPosition([positionX, 0, positionZ]);
          gameObject.setQuaternion(quaternion);
        }
        result.push({ gameObject, label: 'Path Empty', assetUrl: emptyAssetUrl });
      }
    }
  }

  return result;
}
