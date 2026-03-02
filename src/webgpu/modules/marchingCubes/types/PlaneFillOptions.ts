export type PlaneFillOptions = {
    surfaceY?: number;       // World Y voxel coordinate of the flat surface. Default: 0
    noiseScale?: number;     // XZ frequency of surface bumps. Larger = more frequent. Default: 0.03
    noiseAmplitude?: number; // Max surface bump height in voxels. Default: 2.0
    octaves?: number;        // fBm layers stacked on top of each other. Default: 3
    persistence?: number;    // Amplitude multiplier per octave. Default: 0.5
    lacunarity?: number;     // Frequency multiplier per octave. Default: 2.0
};
