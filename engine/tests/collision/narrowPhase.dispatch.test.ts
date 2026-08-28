import { describe, it, expect } from 'vitest';
import { narrowPhase } from '../../gameObject/3D/rigidbody/narrowPhase';
import { SphereHitbox } from '../../gameObject/3D/hitbox/SphereHitbox';
import { CubeHitbox } from '../../gameObject/3D/hitbox/CubeHitbox';
import { CapsuleHitbox } from '../../gameObject/3D/hitbox/CapsuleHitbox';
import { MeshHitbox } from '../../gameObject/3D/hitbox/MeshHitbox';
import { PlaneHitbox } from '../../gameObject/3D/hitbox/PlaneHitbox';

const IDENTITY: [number, number, number, number] = [0, 0, 0, 1];

// Positioned to overlap so most pairs report a hit
function makeSphere(position: [number, number, number] = [0, 0, 0]): SphereHitbox {
  const sphere = new SphereHitbox(1);
  sphere.updateOrientation(position, IDENTITY);
  return sphere;
}

function makeCube(position: [number, number, number] = [0, 0, 0]): CubeHitbox {
  const cube = new CubeHitbox([1, 1, 1]);
  cube.updateOrientation(position, IDENTITY);
  return cube;
}

function makeCapsule(position: [number, number, number] = [0, 0, 0]): CapsuleHitbox {
  const capsule = new CapsuleHitbox(1, 4);
  capsule.updateOrientation(position, IDENTITY);
  return capsule;
}

function makeMesh(position: [number, number, number] = [0, 0, 0]): MeshHitbox {
  const mesh = new MeshHitbox(new Float32Array(0), 3, undefined, undefined, {
    min: [-1, -1, -1],
    max: [1, 1, 1],
  });
  mesh.updateOrientation(position, IDENTITY);
  return mesh;
}

function makePlane(axis: 'x' | 'y' | 'z' = 'y', offset = 0): PlaneHitbox {
  const plane = new PlaneHitbox(axis);
  const pos: [number, number, number] =
    axis === 'x' ? [offset, 0, 0] : axis === 'y' ? [0, offset, 0] : [0, 0, offset];
  plane.updateOrientation(pos, IDENTITY);
  return plane;
}

// ── Dispatch routing ──────────────────────────────────────────────────────────

describe('narrowPhase — all 16 shape pairs dispatch without throwing', () => {
  const shapes = [makeSphere, makeCube, makeCapsule, makeMesh] as const;
  const names = ['sphere', 'cube', 'capsule', 'mesh'] as const;

  for (let i = 0; i < shapes.length; i++) {
    for (let j = 0; j < shapes.length; j++) {
      it(`${names[i]} vs ${names[j]} does not throw`, () => {
        expect(() => narrowPhase(shapes[i](), shapes[j]())).not.toThrow();
      });

      it(`${names[i]} vs ${names[j]} returns a CollisionResult with a boolean hit field`, () => {
        const result = narrowPhase(shapes[i](), shapes[j]());
        expect(typeof result.hit).toBe('boolean');
      });
    }
  }
});

// ── Specific correctness checks ───────────────────────────────────────────────

describe('narrowPhase — sphere vs sphere hit', () => {
  it('two overlapping spheres produce a hit', () => {
    const result = narrowPhase(makeSphere([0, 0, 0]), makeSphere([1.5, 0, 0]));
    expect(result.hit).toBe(true);
  });

  it('two non-overlapping spheres produce no hit', () => {
    const result = narrowPhase(makeSphere([0, 0, 0]), makeSphere([10, 0, 0]));
    expect(result.hit).toBe(false);
  });
});

describe('narrowPhase — normal symmetry', () => {
  it('sphere(a) vs cube(b) has opposite normal to cube(b) vs sphere(a) when both hit', () => {
    const sphere = makeSphere([0, 0, 0]);
    const cube = makeCube([0, 0, 0]);

    const resultAB = narrowPhase(sphere, cube);
    const resultBA = narrowPhase(cube, sphere);

    if (resultAB.hit && resultBA.hit) {
      expect(resultAB.normal[0]).toBeCloseTo(-resultBA.normal[0], 4);
      expect(resultAB.normal[1]).toBeCloseTo(-resultBA.normal[1], 4);
      expect(resultAB.normal[2]).toBeCloseTo(-resultBA.normal[2], 4);
    }
  });
});

// ── Plane dispatch ────────────────────────────────────────────────────────────

describe('narrowPhase — plane vs all shapes dispatch without throwing', () => {
  const otherShapes = [makeSphere, makeCube, makeCapsule, makeMesh] as const;
  const otherNames = ['sphere', 'cube', 'capsule', 'mesh'] as const;

  for (let i = 0; i < otherShapes.length; i++) {
    it(`plane vs ${otherNames[i]} does not throw`, () => {
      expect(() => narrowPhase(makePlane(), otherShapes[i]())).not.toThrow();
    });

    it(`${otherNames[i]} vs plane does not throw`, () => {
      expect(() => narrowPhase(otherShapes[i](), makePlane())).not.toThrow();
    });

    it(`plane vs ${otherNames[i]} returns a CollisionResult with a boolean hit field`, () => {
      const result = narrowPhase(makePlane(), otherShapes[i]());
      expect(typeof result.hit).toBe('boolean');
    });
  }

  it('plane vs plane does not throw and returns no hit', () => {
    const result = narrowPhase(makePlane(), makePlane());
    expect(result.hit).toBe(false);
  });
});

describe('narrowPhase — plane collision correctness', () => {
  it('sphere overlapping y-plane at y=0: hit', () => {
    // sphere center y=0.5, radius=1 → overlaps
    const result = narrowPhase(makePlane('y', 0), makeSphere([0, 0.5, 0]));
    expect(result.hit).toBe(true);
  });

  it('sphere far above y-plane: no hit', () => {
    const result = narrowPhase(makePlane('y', 0), makeSphere([0, 50, 0]));
    expect(result.hit).toBe(false);
  });

  it('plane(b) vs sphere(a) has opposite normal to plane(a) vs sphere(b)', () => {
    // plane at y=0, sphere center at y=0.5, radius=1 → hit from both orderings
    const sphere = makeSphere([0, 0.5, 0]);
    const plane  = makePlane('y', 0);
    const resultAB = narrowPhase(plane, sphere);
    const resultBA = narrowPhase(sphere, plane);
    if (resultAB.hit && resultBA.hit) {
      expect(resultAB.normal[1]).toBeCloseTo(-resultBA.normal[1], 4);
    }
  });
});

describe('narrowPhase — unknown type returns NO_HIT', () => {
  it('unknown hitbox type returns a non-hit result without throwing', () => {
    const fakeHitbox = { type: 'unknown', worldCenter: [0, 0, 0], orientation: new Float32Array(16), offsetTranslation: [0, 0, 0], offsetRotation: [0, 0], updateOrientation: () => {}, clone: () => fakeHitbox } as unknown as import('../../gameObject/3D/hitbox/Hitbox3D').Hitbox3D;
    const result = narrowPhase(fakeHitbox, makeSphere());
    expect(result.hit).toBe(false);
  });
});
