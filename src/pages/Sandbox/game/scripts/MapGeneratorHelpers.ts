import type { Theme, TileType, Rotation, Socket, TileVariant, Cell } from './MapGeneratorConstants';
import {
    mapFragmentMap,
    directionToSocket,
    socketOpposite,
    socketRotateCW,
    NEIGHBOURS,
} from './MapGeneratorConstants';

// ── FBX URL resolution ─────────────────────────────────────────────────────────

const allFbxUrls = import.meta.glob(
    '../../../../../src/assets/fbx/*.fbx',
    { query: '?url', import: 'default', eager: true },
) as Record<string, string>;

export function resolveFbxUrl(theme: Theme, type: TileType): string {
    const filename = type === ''
        ? `square_${theme}_detail.fbx`
        : `square_${theme}_road${type}_detail.fbx`;
    const entry = Object.entries(allFbxUrls).find(([path]) => path.endsWith(filename));
    if (!entry) throw new Error(`MapGenerator: FBX not found: ${filename}`);
    return entry[1];
}

// ── Socket utilities ───────────────────────────────────────────────────────────

export function rotateConnections(connections: ReadonlySet<Socket>, steps: Rotation): ReadonlySet<Socket> {
    let current = new Set(connections);
    for (let step = 0; step < 4 - steps; step++) {
        const next = new Set<Socket>();
        for (const socket of current) {
            next.add(socketRotateCW[socket]);
        }
        current = next;
    }
    return current;
}

// ── Variant generation ─────────────────────────────────────────────────────────

export function buildVariants(): TileVariant[] {
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

// ── Tile filtering ─────────────────────────────────────────────────────────────

/** Returns the variants that may be placed at (row, col) during WFC.
 *  Edit `excludedTypes` below to control which tile types the algorithm can pick. */
export function filterAvailableTiles(
    _row:        number,
    _col:        number,
    _width:      number,
    _depth:      number,
    allVariants: TileVariant[],
): TileVariant[] {
    // ── Edit: remove type keys from this list to re-enable them during WFC ───────
    const excludedTypes: TileType[] = [''];
    // ────────────────────────────────────────────────────────────────────────────
    return allVariants.filter(v => !excludedTypes.includes(v.type));
}

// ── Tile selection ─────────────────────────────────────────────────────────────

/** Picks one variant from `possibilities` for the cell at (row, col).
 *  Edit the splitting logic below — splitProbability is 0 at the centre and
 *  1 at the farthest corner (linear, 1 % per 1 % of max distance). */
export function chooseTileVariant(
    possibilities: TileVariant[],
    row:           number,
    col:           number,
    width:         number,
    depth:         number,
): TileVariant {
    const centerRow       = (depth - 1) / 2;
    const centerCol       = (width  - 1) / 2;
    const maxDistance     = Math.sqrt(centerRow ** 2 + centerCol ** 2);
    const distance        = Math.sqrt((row - centerRow) ** 2 + (col - centerCol) ** 2);
    const splitProbability = maxDistance > 0 ? (distance / maxDistance) * 0.1 : 0;

    // ── Edit: 'D' (T-junction) and 'E' (cross) are the splitting tiles. ─────────
    // ── At splitProbability=0 (centre) non-splitting tiles are preferred.  ──────
    // ── At splitProbability=1 (far edge) splitting tiles are preferred.    ──────
    // ────────────────────────────────────────────────────────────────────────────
    const nonDeadEndPool   = possibilities.filter(v => v.type !== 'A');
    const workingPool      = nonDeadEndPool.length > 0 ? nonDeadEndPool : possibilities;
    const nonSplittingPool = workingPool.filter(v => v.type !== 'D' && v.type !== 'E');
    let pool: TileVariant[];
    if (nonSplittingPool.length > 0) {
        pool = Math.random() < splitProbability ? workingPool : nonSplittingPool;
    } else {
        pool = workingPool;
    }
    return pool[Math.floor(Math.random() * pool.length)];
}

// ── Path connectivity ──────────────────────────────────────────────────────────

export function findReachableCells(
    grid:  TileVariant[][],
    width: number,
    depth: number,
): Set<string> {
    const centerRow = Math.floor(depth / 2);
    const centerCol = Math.floor(width  / 2);
    const reachable = new Set<string>();
    const queue: [number, number][] = [[centerRow, centerCol]];
    reachable.add(`${centerRow},${centerCol}`);

    while (queue.length > 0) {
        const [row, col] = queue.shift()!;
        const variant = grid[row][col];
        for (const { socket, deltaRow, deltaCol } of NEIGHBOURS) {
            const nextRow = row + deltaRow;
            const nextCol = col + deltaCol;
            if (nextRow < 0 || nextRow >= depth) continue;
            if (nextCol < 0 || nextCol >= width)  continue;
            const key = `${nextRow},${nextCol}`;
            if (reachable.has(key)) continue;
            const neighbour = grid[nextRow][nextCol];
            if (variant.connections.has(socket) && neighbour.connections.has(socketOpposite[socket])) {
                reachable.add(key);
                queue.push([nextRow, nextCol]);
            }
        }
    }
    return reachable;
}

export function postProcessPath(
    grid:  TileVariant[][],
    width: number,
    depth: number,
): TileVariant[][] {
    const reachable    = findReachableCells(grid, width, depth);
    const allVariants  = buildVariants();
    const emptyVariant = allVariants.find(v => v.type === '')!;

    return grid.map((rowArray, row) =>
        rowArray.map((variant, col) => {
            if (!reachable.has(`${row},${col}`)) return emptyVariant;

            const outboundNorth = row === 0         && variant.connections.has('north');
            const outboundSouth = row === depth - 1 && variant.connections.has('south');
            const outboundWest  = col === 0         && variant.connections.has('west');
            const outboundEast  = col === width - 1 && variant.connections.has('east');

            if (!outboundNorth && !outboundSouth && !outboundWest && !outboundEast) return variant;

            let inwardSocket: Socket | null = null;
            if      (outboundNorth) inwardSocket = 'south';
            else if (outboundSouth) inwardSocket = 'north';
            else if (outboundWest)  inwardSocket = 'east';
            else if (outboundEast)  inwardSocket = 'west';

            if (!inwardSocket) return emptyVariant;

            return allVariants.find(
                v => v.type === 'A' && v.connections.size === 1 && v.connections.has(inwardSocket!),
            ) ?? emptyVariant;
        })
    );
}

// ── WFC helpers ────────────────────────────────────────────────────────────────

export function isCompatible(variantA: TileVariant, variantB: TileVariant, direction: Socket): boolean {
    return variantA.connections.has(direction) === variantB.connections.has(socketOpposite[direction]);
}

export function collapseCell(grid: Cell[][], row: number, col: number, variant: TileVariant): void {
    grid[row][col].collapsed    = variant;
    grid[row][col].possibilities = [variant];
}

export function propagate(grid: Cell[][], width: number, depth: number, startRow: number, startCol: number): void {
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

export function findLowestEntropy(grid: Cell[][], width: number, depth: number): { row: number; col: number } | null {
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
