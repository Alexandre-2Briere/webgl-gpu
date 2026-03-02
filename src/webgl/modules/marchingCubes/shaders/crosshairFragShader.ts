// src/modules/marchingCubes/shaders/crosshairFragShader.ts

export const CROSSHAIR_FRAG_SOURCE = /* glsl */`#version 300 es

precision mediump float;

out vec4 fragColor;

void main() {
    // WHY: gl_PointCoord is [0,1]² over the point sprite. Recentre to [-0.5,0.5]
    // so the maths is symmetric. A cross is the union of a horizontal bar
    // (|y| < thickness) and a vertical bar (|x| < thickness); we keep a fragment
    // if it belongs to either bar and discard everything else.
    vec2 uv = gl_PointCoord - vec2(0.5);
    float thickness = 0.1; // arm half-width as a fraction of gl_PointSize
    if (abs(uv.x) > thickness && abs(uv.y) > thickness) discard;
    fragColor = vec4(1.0, 1.0, 1.0, 1.0); // solid white
}
`;
