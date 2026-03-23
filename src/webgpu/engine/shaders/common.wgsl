// Shared structs and bind group declarations used by all engine shaders.
// Prepend this source to every shader before creating a GPUShaderModule.

// ── Camera (group 0, binding 0) ─────────────────────────────────────────────

struct CameraUniforms {
  viewProj : mat4x4f,  // offset   0 — 64 bytes
  view     : mat4x4f,  // offset  64 — 64 bytes (for billboard use)
  position : vec3f,    // offset 128 — 12 bytes
  _pad     : f32,      // offset 140 —  4 bytes
}

@group(0) @binding(0) var<uniform> camera : CameraUniforms;

// ── Object (group 1, binding 0) ─────────────────────────────────────────────

struct ObjectUniforms {
  model : mat4x4f,  // offset  0 — 64 bytes
  tint  : vec4f,    // offset 64 — 16 bytes
}

@group(1) @binding(0) var<uniform> object : ObjectUniforms;

// ── Vertex struct (used by compute output and mesh vertex buffers) ───────────
// 48 bytes, 16-byte aligned.

struct Vertex {
  position : vec3f,
  _pad0    : f32,
  normal   : vec3f,
  _pad1    : f32,
  color    : vec4f,
}

// ── Indirect draw args (written by compute shader) ───────────────────────────

struct DrawIndirect {
  vertexCount   : u32,
  instanceCount : u32,
  firstVertex   : u32,
  firstInstance : u32,
}

// ── Chunk uniforms (compute shader input) ────────────────────────────────────

struct ChunkUniforms {
  origin   : vec3f,
  isoLevel : f32,
  gridDims : vec3u,
  _pad     : u32,
}
