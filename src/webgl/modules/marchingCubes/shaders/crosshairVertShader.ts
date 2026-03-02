// src/modules/marchingCubes/shaders/crosshairVertShader.ts

// WHY: the crosshair position is fixed at clip-space centre (0,0,0,1) so no
// vertex attributes or uniforms are needed. gl_PointSize must be set in the
// vertex shader for gl.POINTS draw mode; the fragment shader then uses
// gl_PointCoord to carve a cross shape out of the square point sprite.
// Use an odd number so there is a perfectly centred pixel.
export const CROSSHAIR_VERT_SOURCE = /* glsl */`#version 300 es

void main() {
    gl_Position  = vec4(0.0, 0.0, 0.0, 1.0);
    gl_PointSize = 15.0; // total span in pixels; adjust in crosshairVertShader.ts
}
`;
