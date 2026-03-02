export const FRAGMENT_SOURCE = /* glsl */`#version 300 es

precision mediump float;

in vec3 vWorldPosition;       // World-space position from vertex shader

uniform vec3 uLightDirection; // World-space light direction, normalized, range [-1, 1]

out vec4 fragColor;

void main() {
    vec3 normal = normalize(cross(dFdx(vWorldPosition), dFdy(vWorldPosition)));

    float diffuse = max(dot(normal, normalize(uLightDirection)), 0.0);
    float ambient = 0.4;
    float light = ambient + diffuse;

    fragColor = vec4(vec3(light), 1.0);
}`;