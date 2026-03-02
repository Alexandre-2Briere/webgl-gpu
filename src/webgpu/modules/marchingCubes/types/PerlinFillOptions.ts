export type PerlinFillOptions = {
    scale?: number;       // Voxel frequency. Larger = zoomed out, more features. Default: 0.05
    octaves?: number;     // Layers of noise stacked together. Default: 4
    persistence?: number; // Amplitude multiplier per octave. Default: 0.5
    lacunarity?: number;  // Frequency multiplier per octave. Default: 2.0
    threshold?: number;   // Bias above 0 = more hollow, below 0 = more solid. Default: 0
}
