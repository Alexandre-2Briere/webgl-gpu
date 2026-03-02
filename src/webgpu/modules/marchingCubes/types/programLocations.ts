// WHY: WebGPU doesn't use location-based uniforms or attributes.
// Instead, bind groups and pipeline layouts are used. This file is deprecated
// for WebGPU; it's kept for compatibility during migration only.
// The shaderCompiler.ts now exports PipelineBundle instead.

export type ProgramLocations = Record<string, never>;