import { type Engine, type FbxAssetHandle, type IGameObject } from '@engine';
import type { GameScript } from './ScriptContract';
import type { Theme, MapParams, MapHandle, TileType, TileVariant, Cell } from './MapGeneratorConstants';
import { rotationQuaternion, MAX_RETRIES } from './MapGeneratorConstants';
import {
    resolveFbxUrl,
    buildVariants,
    collapseCell,
    propagate,
    findLowestEntropy,
    filterAvailableTiles,
    chooseTileVariant,
    postProcessPath,
} from './MapGeneratorHelpers';

export type { Theme, MapParams, MapHandle } from './MapGeneratorConstants';

// ── WFC ────────────────────────────────────────────────────────────────────────

function runWFC(width: number, depth: number, allVariants: TileVariant[]): TileVariant[][] {
    const grid: Cell[][] = Array.from({ length: depth }, (_, row) =>
        Array.from({ length: width }, (_, col) => ({
            possibilities: filterAvailableTiles(row, col, width, depth, allVariants),
            collapsed: null,
        }))
    );

    const centerRow = Math.floor(depth / 2);
    const centerCol = Math.floor(width / 2);

    const aVariants = grid[centerRow][centerCol].possibilities.filter(v => v.type === 'A');

    if (aVariants.length === 0) throw new Error('WFC contradiction');

    collapseCell(grid, centerRow, centerCol, aVariants[Math.floor(Math.random() * aVariants.length)]);
    propagate(grid, width, depth, centerRow, centerCol);

    while (true) {
        const next = findLowestEntropy(grid, width, depth);
        if (!next) break;

        const { row, col } = next;
        const cell = grid[row][col];
        const chosen = chooseTileVariant(cell.possibilities, row, col, width, depth);
        collapseCell(grid, row, col, chosen);
        propagate(grid, width, depth, row, col);
    }

    return postProcessPath(
        grid.map(row => row.map(cell => cell.collapsed!)),
        width,
        depth,
    );
}

// ── Execute ────────────────────────────────────────────────────────────────────

async function _generate(params: MapParams, engine: Engine): Promise<MapHandle> {
    const { theme, scale, width, depth, centerPosition = [0, 0] } = params;
    const [centerX, centerZ] = centerPosition;

    const tileTypes: TileType[] = ['', 'A', 'B', 'C', 'D', 'E'];
    const assets = new Map<TileType, FbxAssetHandle>();
    await Promise.all(
        tileTypes.map(async type => {
            assets.set(type, await engine.loadFbx(resolveFbxUrl(theme, type)));
        })
    );

    const allVariants = buildVariants();
    let collapsed: TileVariant[][] | null = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        try {
            collapsed = runWFC(width, depth, allVariants);
            break;
        } catch {
            // contradiction — retry with a fresh random state
        }
    }

    if (!collapsed) throw new Error('MapGenerator: WFC failed to converge after maximum retries');

    const models: IGameObject[] = [];
    const firstModels = new Map<TileType, IGameObject>();

    for (let row = 0; row < depth; row++) {
        for (let col = 0; col < width; col++) {
            const variant   = collapsed[row][col];
            const asset     = assets.get(variant.type)!;
            const tileSize  = 2;
            const positionX = centerX + (col - (width  - 1)) * scale * tileSize;
            const positionZ = centerZ + (row - (depth  - 1)) * scale * tileSize;
            const quaternion = rotationQuaternion[variant.rotation];
            const existing = firstModels.get(variant.type);
            if (!existing) {
                const model = engine.createFbxModel({
                    renderable: { asset },
                    position:   [positionX, 0, positionZ],
                    quaternion,
                    scale:      [scale, scale, scale],
                });
                firstModels.set(variant.type, model);
                models.push(model);
            } else {
                const model = existing.copy();
                model.setPosition([positionX, 0, positionZ]);
                model.setQuaternion(quaternion);
                model.setScale(scale, scale, scale);
                models.push(model);
            }
        }
    }

    return {
        destroy(): void {
            for (const model of models) model.destroy();
            for (const asset of assets.values()) asset.destroy();
        },
    };
}

// ── Script contract ────────────────────────────────────────────────────────────

export default class MapGenerator implements GameScript {
    private _handle: MapHandle | null = null;

    async execute(
        engine:         Engine,
        theme_string:   string = 'forest',
        scale_number:   number = 1,
        width_number:   number = 30,
        depth_number:   number = 30,
        centerX_number: number = 0,
        centerZ_number: number = 0,
    ): Promise<void> {
        this._handle = await _generate(
            {
                theme:          (theme_string as Theme) || 'forest',
                scale:          scale_number || 1,
                width:          width_number || 30,
                depth:          depth_number || 30,
                centerPosition: [centerX_number, centerZ_number],
            },
            engine,
        );
    }

    update(_deltaTime_number: number): void {}

    destroy(): void {
        this._handle?.destroy();
        this._handle = null;
    }
}
