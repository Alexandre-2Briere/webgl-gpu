export const ISO_LEVEL = 0.3;
export const RANDOM_FACTOR = 2;
export const UNIFORM_VECTOR4 = new Float32Array([1.0, 1.0, 1.0, 1.0]);
export const UNIFORM_VECTOR3 = new Float32Array([1.0, 1.0, 1.0]);
export const UNIFORM_VECTOR2 = new Float32Array([1.0, 1.0]);

// Sculpting brush: how far from the ray-triangle hit point corners are affected,
// and how much scalar value is added (left click) or removed (right click) at
// the centre of the brush (falls off linearly to 0 at the edge of the radius).
export const SCULPT_RADIUS = 3.0;   // world units
export const SCULPT_STRENGTH = 0.2;   // field delta at brush centre per click