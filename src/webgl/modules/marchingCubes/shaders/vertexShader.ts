export const VERTEX_SOURCE = /* glsl */`#version 300 es

precision highp float;

in vec3 aPosition;              // Object-space vertex position, metres

uniform mat4 uModelMatrix;      // Model → world transform
uniform mat4 uViewMatrix;       // World → camera (view) transform
uniform mat4 uProjectionMatrix; // Camera → clip space, perspective projection
uniform vec3 uChunkOffset;      // World-space origin offset of this chunk, metres

out vec3 vWorldPosition;        // World-space position passed to fragment shader

void main() {
    vec3 offsetPosition = aPosition + uChunkOffset;
    vec4 worldPosition = uModelMatrix * vec4(offsetPosition, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = uProjectionMatrix * uViewMatrix * worldPosition;
}`;