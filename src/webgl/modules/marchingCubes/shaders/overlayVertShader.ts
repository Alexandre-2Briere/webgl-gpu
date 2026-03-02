// src/modules/marchingCubes/shaders/overlayVertShader.ts

export const OVERLAY_VERT_SOURCE = /* glsl */`#version 300 es

precision highp float;

in vec3 aPosition;              // World-space vertex position (no chunk offset needed)

uniform mat4 uViewMatrix;       // World → camera
uniform mat4 uProjectionMatrix; // Camera → clip

void main() {
    gl_Position = uProjectionMatrix * uViewMatrix * vec4(aPosition, 1.0);
}
`;
