// ── Public types ───────────────────────────────────────────────────────────────

export type Theme = 'forest' | 'rock' | 'sand';

export interface MapParams {
    theme:           Theme;
    scale:           number;
    width:           number;
    depth:           number;
    centerPosition?: [number, number];
}

export interface MapHandle {
    destroy(): void;
}

// ── Internal types ─────────────────────────────────────────────────────────────

export type TileType = keyof typeof mapFragmentMap;
export type Rotation = 0 | 1 | 2 | 3;
export type Socket   = 'north' | 'south' | 'east' | 'west';

export interface TileVariant {
    type:        TileType;
    rotation:    Rotation;
    connections: ReadonlySet<Socket>;
}

export interface Cell {
    possibilities: TileVariant[];
    collapsed:     TileVariant | null;
}

// ── Fragment definitions ───────────────────────────────────────────────────────

export const Direction = {
    Up:    'up',
    Down:  'down',
    Left:  'left',
    Right: 'right',
} as const;

export const mapFragmentMap: Record<string, string[]> = {
    '':  [],
    'A': [Direction.Down],
    'B': [Direction.Down, Direction.Up],
    'C': [Direction.Down, Direction.Right],
    'D': [Direction.Down, Direction.Right, Direction.Left],
    'E': [Direction.Down, Direction.Right, Direction.Left, Direction.Up],
};

// ── Socket lookup tables ───────────────────────────────────────────────────────

export const directionToSocket: Record<string, Socket> = {
    [Direction.Up]:    'north',
    [Direction.Down]:  'south',
    [Direction.Left]:  'west',
    [Direction.Right]: 'east',
};

export const socketOpposite: Record<Socket, Socket> = {
    north: 'south',
    south: 'north',
    east:  'west',
    west:  'east',
};

// 1 step CW from above: Down→Left, Left→Up, Up→Right, Right→Down
// In socket terms:      south→west, west→north, north→east, east→south
export const socketRotateCW: Record<Socket, Socket> = {
    south: 'west',
    west:  'north',
    north: 'east',
    east:  'south',
};

// ── Rotation quaternions (Y-axis, CW from above) ───────────────────────────────

const SQRT2_OVER_2 = Math.SQRT2 / 2;

export const rotationQuaternion: Record<Rotation, [number, number, number, number]> = {
    0: [0, 0,            0, 1],
    1: [0, SQRT2_OVER_2, 0, SQRT2_OVER_2],
    2: [0, 1,            0, 0],
    3: [0, SQRT2_OVER_2, 0, -SQRT2_OVER_2],
};

// ── WFC neighbour offsets ──────────────────────────────────────────────────────

export const NEIGHBOURS: { socket: Socket; deltaRow: number; deltaCol: number }[] = [
    { socket: 'north', deltaRow: -1, deltaCol:  0 },
    { socket: 'south', deltaRow:  1, deltaCol:  0 },
    { socket: 'west',  deltaRow:  0, deltaCol: -1 },
    { socket: 'east',  deltaRow:  0, deltaCol:  1 },
];

// ── Retry limit ────────────────────────────────────────────────────────────────

export const MAX_RETRIES = 10;
