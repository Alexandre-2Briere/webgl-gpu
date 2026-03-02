// src/modules/marchingCubes/shaders/overlayFragShader.ts

export const OVERLAY_FRAG_SOURCE = /* glsl */`#version 300 es

precision mediump float;

uniform vec4 uColor; // RGBA, linear colour space

out vec4 fragColor;

void main() {
    fragColor = uColor;
}
`;
