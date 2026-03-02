// src/common/cameraController.ts

import { Camera } from './camera';
import { Vertex3 } from '../../types/Vertex';
import {
    CAMERA_HITBOX_WIDTH,
    CAMERA_HITBOX_DEPTH,
    CAMERA_HITBOX_HEIGHT,
    GRAVITY,
    JUMP_FORCE,
    TERMINAL_VELOCITY,
    MAX_WALKABLE_SLOPE_DEG,
    GROUND_CHECK_EPSILON,
} from '../../constants/constants';
import keybindings from '../../constants/cameraKeybindings.json';

const KEYS = Object.fromEntries(keybindings.map(b => [b.action, b.key])) as Record<string, string>;

export class CameraController {
    private readonly camera: Camera;
    private readonly canvas: HTMLCanvasElement;
    // WHY: collidesWithAABB is an optional callback injected by the module layer
    // so that this common/ class never imports from modules/. The controller
    // describes *what* to check (camera AABB extents); the caller decides *how*
    // to check it (triangle mesh SAT via TriangleSpatialHash).
    private readonly collidesWithAABB:
        | ((minX: number, minY: number, minZ: number,
            maxX: number, maxY: number, maxZ: number) => boolean)
        | undefined;

    // WHY: the normal callback lets the controller detect walkable slopes without
    // importing anything from the modules/ layer. A null return means no collision
    // at that position, identical to collidesWithAABB returning false.
    private readonly collidesWithAABBNormal:
        | ((minX: number, minY: number, minZ: number,
            maxX: number, maxY: number, maxZ: number) => Vertex3 | null)
        | undefined;

    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private yawLeft: boolean = false;
    private yawRight: boolean = false;

    // WHY: jumpPressed is a one-shot flag set by the keydown handler and consumed
    // in update(). It is always cleared at the end of update() so a held Space key
    // triggers at most one jump per landing — no auto-repeat jumping.
    private jumpPressed: boolean = false;

    private isSprinting: boolean = false;

    // Vertical velocity in world units per second (positive = upward).
    private verticalVelocity: number = 0;
    // True when the player's AABB is resting on a solid surface.
    private isGrounded: boolean = false;
    // Movement and physics are gated behind this flag until all initial chunks load.
    private chunksLoaded: boolean = false;

    private isPointerLocked: boolean = false;

    // WHY: moveSpeed is in units/second (not units/frame) so movement is
    // frame-rate independent once multiplied by deltaTime in update().
    private readonly moveSpeed: number = 10;
    private readonly mouseSensitivity: number = 0.002;
    private readonly keyboardYawSpeed: number = 1.5;
    private readonly pitchLimit: number = Math.PI / 2 - 0.01;

    constructor(
        camera: Camera,
        canvas: HTMLCanvasElement,
        _onUpdate?: () => void,
        collidesWithAABB?: (
            minX: number, minY: number, minZ: number,
            maxX: number, maxY: number, maxZ: number,
        ) => boolean,
        collidesWithAABBNormal?: (
            minX: number, minY: number, minZ: number,
            maxX: number, maxY: number, maxZ: number,
        ) => Vertex3 | null,
    ) {
        this.camera = camera;
        this.canvas = canvas;
        this.collidesWithAABB = collidesWithAABB;
        this.collidesWithAABBNormal = collidesWithAABBNormal;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        canvas.addEventListener('click', this.handleCanvasClick);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('mousemove', this.handleMouseMove);
    }

    /** Call once all initial terrain chunks are loaded to enable movement. */
    setChunksLoaded(loaded: boolean): void {
        this.chunksLoaded = loaded;
    }

    private handleCanvasClick = (): void => {
        this.canvas.requestPointerLock();
    }

    private handlePointerLockChange = (): void => {
        this.isPointerLocked = document.pointerLockElement === this.canvas;
    }

    private handleMouseMove = (event: MouseEvent): void => {
        if (!this.isPointerLocked) return;

        this.camera.yaw += event.movementX * this.mouseSensitivity;
        this.camera.pitch -= event.movementY * this.mouseSensitivity;
        this.camera.pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this.camera.pitch));
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        switch (event.code) {
            case KEYS['moveForward']:  this.moveForward  = true; break;
            case KEYS['moveBackward']: this.moveBackward = true; break;
            case KEYS['moveLeft']:     this.moveLeft     = true; break;
            case KEYS['moveRight']:    this.moveRight    = true; break;
            case KEYS['yawLeft']:      this.yawLeft      = true; break;
            case KEYS['yawRight']:     this.yawRight     = true; break;
            // WHY: jump is a one-shot action — set a flag rather than tracking
            // the key as held. Prevents auto-repeat from spamming jumps.
            case KEYS['jump']:         this.jumpPressed  = true; break;
            case 'ShiftLeft':
            case 'ShiftRight':         this.isSprinting  = true; break;
        }
    }

    private handleKeyUp = (event: KeyboardEvent): void => {
        switch (event.code) {
            case KEYS['moveForward']:  this.moveForward  = false; break;
            case KEYS['moveBackward']: this.moveBackward = false; break;
            case KEYS['moveLeft']:     this.moveLeft     = false; break;
            case KEYS['moveRight']:    this.moveRight    = false; break;
            case KEYS['yawLeft']:      this.yawLeft      = false; break;
            case KEYS['yawRight']:     this.yawRight     = false; break;
            case 'ShiftLeft':
            case 'ShiftRight':         this.isSprinting  = false; break;
        }
    }

    // ── Collision helpers ─────────────────────────────────────────────────────

    private hitboxOverlapsSolid(x: number, y: number, z: number): boolean {
        if (!this.collidesWithAABB) return false;
        const hw = CAMERA_HITBOX_WIDTH  / 2;
        const hh = CAMERA_HITBOX_HEIGHT / 2;
        const hd = CAMERA_HITBOX_DEPTH  / 2;
        return this.collidesWithAABB(x - hw, y - hh, z - hd, x + hw, y + hh, z + hd);
    }

    private getNormalAtPosition(x: number, y: number, z: number): Vertex3 | null {
        if (!this.collidesWithAABBNormal) return null;
        const hw = CAMERA_HITBOX_WIDTH  / 2;
        const hh = CAMERA_HITBOX_HEIGHT / 2;
        const hd = CAMERA_HITBOX_DEPTH  / 2;
        return this.collidesWithAABBNormal(x - hw, y - hh, z - hd, x + hw, y + hh, z + hd);
    }

    // ── Slope sliding ─────────────────────────────────────────────────────────

    /**
     * When horizontal movement is blocked at (testX, testY, testZ), check
     * whether the blocking surface is a walkable slope. If so, return a
     * projected movement delta that slides the player along the slope surface
     * (including the upward Y component), or null if the surface is too steep.
     *
     * @param testX,testY,testZ  Position that produced a collision.
     * @param inputDx,inputDz    Original horizontal movement intent.
     */
    private trySlopeSlide(
        testX: number, testY: number, testZ: number,
        inputDx: number, inputDz: number,
    ): Vertex3 | null {
        const normal = this.getNormalAtPosition(testX, testY, testZ);
        if (!normal) return null;

        const { x: nx, y: ny, z: nz } = normal;

        // WHY: acos(ny) gives the surface inclination from horizontal because ny
        // is the Y component of the already-upward-facing unit normal.
        // A flat floor has ny=1 → 0°. A 45° ramp has ny≈0.707 → 45°.
        const slopeAngleDeg = Math.acos(ny) * (180 / Math.PI);
        if (slopeAngleDeg >= MAX_WALKABLE_SLOPE_DEG) return null;

        // Project the horizontal input (dx, 0, dz) onto the slope plane.
        // dot = d · n  (the component of d along the normal, to be subtracted)
        const dot = inputDx * nx + inputDz * nz; // dy=0, so ny term is 0
        const projDx = inputDx - dot * nx;
        const projDy =         - dot * ny;  // positive when climbing the slope
        const projDz = inputDz - dot * nz;

        return new Vertex3(projDx, projDy, projDz);
    }

    // ── Main update ───────────────────────────────────────────────────────────

    update(deltaTime: number): void {
        // Block all movement and physics until the terrain has finished loading.
        if (!this.chunksLoaded) return;

        // --- Yaw rotation ---
        if (this.yawLeft)  this.camera.yaw -= this.keyboardYawSpeed * deltaTime;
        if (this.yawRight) this.camera.yaw += this.keyboardYawSpeed * deltaTime;

        const cosYaw = Math.cos(this.camera.yaw);
        const sinYaw = Math.sin(this.camera.yaw);
        const forwardX = sinYaw,  forwardZ = -cosYaw;
        const rightX   = cosYaw,  rightZ   =  sinYaw;
        const speed    = this.moveSpeed * deltaTime * (this.isSprinting ? 2 : 1);

        let dx = 0, dz = 0;
        if (this.moveForward)  { dx += forwardX * speed; dz += forwardZ * speed; }
        if (this.moveBackward) { dx -= forwardX * speed; dz -= forwardZ * speed; }
        if (this.moveRight)    { dx += rightX   * speed; dz += rightZ   * speed; }
        if (this.moveLeft)     { dx -= rightX   * speed; dz -= rightZ   * speed; }

        let cx = this.camera.positionX;
        let cy = this.camera.positionY;
        let cz = this.camera.positionZ;

        // --- Horizontal movement with slope climbing ---
        // WHY per-axis: applying X and Z independently lets the player slide
        // along a wall instead of stopping dead when moving diagonally into it.
        // For each blocked axis, trySlopeSlide() checks whether the surface is
        // a walkable ramp (angle < MAX_WALKABLE_SLOPE_DEG) and, if so, returns
        // a projection of the intended movement onto the slope plane — which
        // includes a positive Y component that lifts the player up the ramp.
        if (dx !== 0 || dz !== 0) {
            if (!this.hitboxOverlapsSolid(cx + dx, cy, cz + dz)) {
                // Common case: clear path, move directly.
                cx += dx; cz += dz;
            } else {
                // Blocked diagonally — try each axis individually.
                if (dx !== 0) {
                    if (!this.hitboxOverlapsSolid(cx + dx, cy, cz)) {
                        cx += dx;
                    } else {
                        const slide = this.trySlopeSlide(cx + dx, cy, cz, dx, 0);
                        if (slide !== null) {
                            const { x: sdx, y: sdy, z: sdz } = slide;
                            if (!this.hitboxOverlapsSolid(cx + sdx, cy + sdy, cz + sdz)) {
                                cx += sdx; cy += sdy; cz += sdz;
                            }
                        }
                    }
                }
                if (dz !== 0) {
                    if (!this.hitboxOverlapsSolid(cx, cy, cz + dz)) {
                        cz += dz;
                    } else {
                        const slide = this.trySlopeSlide(cx, cy, cz + dz, 0, dz);
                        if (slide !== null) {
                            const { x: sdx, y: sdy, z: sdz } = slide;
                            if (!this.hitboxOverlapsSolid(cx + sdx, cy + sdy, cz + sdz)) {
                                cx += sdx; cy += sdy; cz += sdz;
                            }
                        }
                    }
                }
            }
        }

        // --- Vertical physics (gravity acts straight down only) ---
        // WHY: gravity is applied as a pure -Y acceleration and is independent of
        // horizontal movement. A player on a slope is held up by the collision
        // response (downward movement blocked), not by sliding down the slope.
        this.verticalVelocity -= GRAVITY * deltaTime;
        if (this.verticalVelocity < -TERMINAL_VELOCITY) {
            this.verticalVelocity = -TERMINAL_VELOCITY;
        }

        const dy = this.verticalVelocity * deltaTime;
        if (!this.hitboxOverlapsSolid(cx, cy + dy, cz)) {
            cy += dy;
        } else {
            if (dy < 0) this.isGrounded = true;  // landed on solid surface
            this.verticalVelocity = 0;
        }

        // WHY: re-check grounded after horizontal movement. Walking off a ledge
        // clears the flag so gravity resumes on the next frame.
        if (this.isGrounded && !this.hitboxOverlapsSolid(cx, cy - GROUND_CHECK_EPSILON, cz)) {
            this.isGrounded = false;
        }

        // --- Jump ---
        if (this.jumpPressed && this.isGrounded) {
            this.verticalVelocity = JUMP_FORCE;
            this.isGrounded = false;
        }
        // WHY: always clear after each update so a held Space key doesn't
        // trigger another jump the moment the player lands.
        this.jumpPressed = false;

        this.camera.positionX = cx;
        this.camera.positionY = cy;
        this.camera.positionZ = cz;
    }

    destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('click', this.handleCanvasClick);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('mousemove', this.handleMouseMove);
    }
}
