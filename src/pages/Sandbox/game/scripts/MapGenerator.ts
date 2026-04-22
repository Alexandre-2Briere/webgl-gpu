import { type Engine, type FbxAssetHandle, type IGameObject } from '@engine';
import type { ScriptContext, ScriptHandle } from './ScriptContract';

// ── Fragment definitions ───────────────────────────────────────────────────────

const Direction = {
    Up:    'up',
    Down:  'down',
    Left:  'left',
    Right: 'right',
} as const;

const mapFragmentMap: Record<string, string[]> = {
    '':  [],
    'A': [Direction.Down],
    'B': [Direction.Down, Direction.Up],
    'C': [Direction.Down, Direction.Right],
    'D': [Direction.Down, Direction.Right, Direction.Left],
    'E': [Direction.Down, Direction.Right, Direction.Left, Direction.Up],
};

// ── Script defaults (edit these to configure the map) ──────────────────────────

const DEFAULT_THEME: Theme = 'forest';
const DEFAULT_WIDTH         = 30;
const DEFAULT_DEPTH         = 30;

// ── Public types ───────────────────────────────────────────────────────────────

export type Theme = 'forest' | 'rock' | 'sand';

export interface MapParams {
    theme:           Theme;
    /** FBX model scale and tile grid spacing (assumes native FBX tile size = 1 unit). */
    scale:           number;
    /** Number of tiles along the X axis. */
    width:           number;
    /** Number of tiles along the Z axis. */
    depth:           number;
    /** World-space [X, Z] of the map center. Defaults to [0, 0]. */
    centerPosition?: [number, number];
}

export interface MapHandle {
    destroy(): void;
}

// ── Internal types ─────────────────────────────────────────────────────────────

type TileType = keyof typeof mapFragmentMap;
type Rotation = 0 | 1 | 2 | 3;
type Socket   = 'north' | 'south' | 'east' | 'west';

interface TileVariant {
    type:        TileType;
    rotation:    Rotation;
    connections: ReadonlySet<Socket>;
}

interface Cell {
    possibilities: TileVariant[];
    collapsed:     TileVariant | null;
}

// ── FBX URL resolution ─────────────────────────────────────────────────────────

const allFbxUrls = import.meta.glob(
    '../../../../../src/assets/fbx/*.fbx',
    { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

function resolveFbxUrl(theme: Theme, type: TileType): string {
    const filename = type === ''
        ? `square_${theme}_detail.fbx`
        : `square_${theme}_road${type}_detail.fbx`;
    const entry = Object.entries(allFbxUrls).find(([path]) => path.endsWith(filename));
    if (!entry) throw new Error(`MapGenerator: FBX not found: ${filename}`);
    return entry[1];
}

// ── Socket utilities ───────────────────────────────────────────────────────────

const directionToSocket: Record<string, Socket> = {
    [Direction.Up]:    'north',
    [Direction.Down]:  'south',
    [Direction.Left]:  'west',
    [Direction.Right]: 'east',
};

const socketOpposite: Record<Socket, Socket> = {
    north: 'south',
    south: 'north',
    east:  'west',
    west:  'east',
};

// 1 step CW from above: Down→Left, Left→Up, Up→Right, Right→Down
// In socket terms:      south→west, west→north, north→east, east→south
const socketRotateCW: Record<Socket, Socket> = {
    south: 'west',
    west:  'north',
    north: 'east',
    east:  'south',
};

function rotateConnections(connections: ReadonlySet<Socket>, steps: Rotation): ReadonlySet<Socket> {
    let current = new Set(connections);
    for (let step = 0; step < steps; step++) {
        const next = new Set<Socket>();
        for (const socket of current) next.add(socketRotateCW[socket]);
        current = next;
    }
    return current;
}

// ── Rotation quaternions (Y-axis, CW from above) ───────────────────────────────

const SQRT2_OVER_2 = Math.SQRT2 / 2;

const rotationQuaternion: Record<Rotation, [number, number, number, number]> = {
    0: [0, 0,            0, 1],
    1: [0, SQRT2_OVER_2, 0, SQRT2_OVER_2],
    2: [0, 1,            0, 0],
    3: [0, SQRT2_OVER_2, 0, -SQRT2_OVER_2],
};

// ── Variant generation ─────────────────────────────────────────────────────────

function buildVariants(): TileVariant[] {
    const variants: TileVariant[] = [];

    for (const [typeString, directions] of Object.entries(mapFragmentMap)) {
        const type = typeString as TileType;
        const baseSockets = new Set<Socket>(directions.map(direction => directionToSocket[direction]));
        const seen = new Set<string>();

        for (let rotation = 0; rotation < 4; rotation++) {
            const connections = rotateConnections(baseSockets, rotation as Rotation);
            const key = [...connections].sort().join(',');
            if (seen.has(key)) continue;
            seen.add(key);
            variants.push({ type, rotation: rotation as Rotation, connections });
        }
    }

    return variants;
}

// ── WFC ───────────────────────────────────────────────────────────────────────

const NEIGHBOURS: { socket: Socket; deltaRow: number; deltaCol: number }[] = [
    { socket: 'north', deltaRow: -1, deltaCol:  0 },
    { socket: 'south', deltaRow:  1, deltaCol:  0 },
    { socket: 'west',  deltaRow:  0, deltaCol: -1 },
    { socket: 'east',  deltaRow:  0, deltaCol:  1 },
];

function isCompatible(variantA: TileVariant, variantB: TileVariant, direction: Socket): boolean {
    return variantA.connections.has(direction) === variantB.connections.has(socketOpposite[direction]);
}

function collapseCell(grid: Cell[][], row: number, col: number, variant: TileVariant): void {
    grid[row][col].collapsed    = variant;
    grid[row][col].possibilities = [variant];
}

function propagate(grid: Cell[][], width: number, depth: number, startRow: number, startCol: number): void {
    const queue: [number, number][] = [[startRow, startCol]];

    while (queue.length > 0) {
        const [row, col] = queue.shift()!;
        const cell = grid[row][col];

        for (const { socket, deltaRow, deltaCol } of NEIGHBOURS) {
            const neighbourRow = row + deltaRow;
            const neighbourCol = col + deltaCol;

            if (neighbourRow < 0 || neighbourRow >= depth) continue;
            if (neighbourCol < 0 || neighbourCol >= width)  continue;

            const neighbour = grid[neighbourRow][neighbourCol];
            if (neighbour.collapsed) continue;

            const countBefore = neighbour.possibilities.length;
            neighbour.possibilities = neighbour.possibilities.filter(neighbourVariant =>
                cell.possibilities.some(cellVariant => isCompatible(cellVariant, neighbourVariant, socket))
            );

            if (neighbour.possibilities.length === 0) throw new Error('WFC contradiction');
            if (neighbour.possibilities.length < countBefore) queue.push([neighbourRow, neighbourCol]);
        }
    }
}

function findLowestEntropy(grid: Cell[][], width: number, depth: number): { row: number; col: number } | null {
    let minEntropy = Infinity;
    let result: { row: number; col: number } | null = null;

    for (let row = 0; row < depth; row++) {
        for (let col = 0; col < width; col++) {
            const cell = grid[row][col];
            if (cell.collapsed) continue;
            if (cell.possibilities.length < minEntropy) {
                minEntropy = cell.possibilities.length;
                result = { row, col };
            }
        }
    }

    return result;
}

function runWFC(width: number, depth: number, allVariants: TileVariant[]): TileVariant[][] {
    const grid: Cell[][] = Array.from({ length: depth }, (_, row) =>
        Array.from({ length: width }, (_, col) => {
            let possibilities = allVariants.slice();
            if (row === 0)         possibilities = possibilities.filter(v => !v.connections.has('north'));
            if (row === depth - 1) possibilities = possibilities.filter(v => !v.connections.has('south'));
            if (col === 0)         possibilities = possibilities.filter(v => !v.connections.has('west'));
            if (col === width - 1) possibilities = possibilities.filter(v => !v.connections.has('east'));
            return { possibilities, collapsed: null };
        })
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
        const chosen = cell.possibilities[Math.floor(Math.random() * cell.possibilities.length)];
        collapseCell(grid, row, col, chosen);
        propagate(grid, width, depth, row, col);
    }

    return grid.map(row => row.map(cell => cell.collapsed!));
}

// ── Execute ────────────────────────────────────────────────────────────────────

const MAX_RETRIES = 10;

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
            console.log(`Placing tile at row ${row}, col ${col}: type=${variant.type}, rotation=${variant.rotation * 90}°`);
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

// ── Script contract entry point ────────────────────────────────────────────────

export async function execute(context: ScriptContext, engine: Engine): Promise<ScriptHandle> {
    return _generate(
        {
            theme:          DEFAULT_THEME,
            scale:          context.scale[0],
            width:          DEFAULT_WIDTH,
            depth:          DEFAULT_DEPTH,
            centerPosition: [context.position[0], context.position[2]],
        },
        engine,
    );
}
