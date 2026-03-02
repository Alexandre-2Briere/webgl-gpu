// WHY: In WebGPU, limits are queried at init time from device.limits.
// We don't typically check these at runtime since the API throws on violation.
// This stub exists for API compatibility with code that might reference GPU limits.
// Call populateLimits(device) once at renderer init to cache the actual device limits.

let cachedLimits: Partial<GPUSupportedLimits> = {};

export function populateLimits(device: GPUDevice): void {
    cachedLimits = { ...device.limits };
}

export function getGPULimit(limitName: keyof GPUSupportedLimits): number | undefined {
    return (cachedLimits as any)[limitName];
}

export const GPU_LIMITS = {
    // Recommended conservative values; actual limits come from device.limits
    MAX_TEXTURE_SIZE: 4096,
    MAX_BUFFER_SIZE: 268435456, // 256 MB (typical WebGPU limit)
    MAX_UNIFORM_BUFFER_SIZE: 65536, // 64 KB (typical per uniform buffer)
} as const;