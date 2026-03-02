// src/common/cameraController.ts

import { Camera } from './camera';
import { CAMERA_HITBOX_WIDTH, CAMERA_HITBOX_DEPTH, CAMERA_HITBOX_HEIGHT } from '../../constants/constants';

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

    private moveForward: boolean = false;
    private moveBackward: boolean = false;
    private moveLeft: boolean = false;
    private moveRight: boolean = false;
    private moveUp: boolean = false;
    private moveDown: boolean = false;
    private yawLeft: boolean = false;
    private yawRight: boolean = false;

    private isPointerLocked: boolean = false;

    // WHY: moveSpeed is now in units/second (not units/frame) so movement is
    // frame-rate independent once multiplied by deltaTime in update(). At 60 fps
    // this equals the old 0.5 * 60 = 30 u/s; 10 u/s feels more controllable for
    // a first-person exploration camera at this voxel scale.
    private readonly moveSpeed: number = 10;
    private readonly mouseSensitivity: number = 0.002;
    // WHY: keyboard yaw speed scaled to match mouse feel (radians/second).
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
    ) {
        this.camera = camera;
        this.canvas = canvas;
        // WHY: _onUpdate is accepted but intentionally unused. Previously it
        // triggered renderer.render() on every mouse move and key press, causing
        // up to 3 renders per RAF cycle (key held + unconditional + mouse event).
        // The RAF loop in module.ts is now the sole render trigger, eliminating
        // mid-frame renders that produced visible jitter.
        this.collidesWithAABB = collidesWithAABB;

        window.addEventListener('keydown', this.handleKeyDown);
        window.addEventListener('keyup', this.handleKeyUp);
        canvas.addEventListener('click', this.handleCanvasClick);
        document.addEventListener('pointerlockchange', this.handlePointerLockChange);
        document.addEventListener('mousemove', this.handleMouseMove);
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

        // Clamp pitch to prevent flipping upside down
        this.camera.pitch = Math.max(-this.pitchLimit, Math.min(this.pitchLimit, this.camera.pitch));

        // WHY: no render call here — the RAF loop renders every frame.
        // Calling render() from a mousemove event fires outside the RAF
        // vsync window, which produces a second render mid-frame and causes
        // the visual jitter the user reported.
    }

    private handleKeyDown = (event: KeyboardEvent): void => {
        switch (event.code) {
            case 'KeyW': this.moveForward = true; break;
            case 'KeyS': this.moveBackward = true; break;
            case 'KeyA': this.moveLeft = true; break;
            case 'KeyD': this.moveRight = true; break;
            case 'KeyQ': this.yawLeft = true; break;
            case 'KeyE': this.yawRight = true; break;
            case 'Space': this.moveUp = true; break;
            case 'ShiftLeft': this.moveDown = true; break;
        }
    }

    private handleKeyUp = (event: KeyboardEvent): void => {
        switch (event.code) {
            case 'KeyW': this.moveForward = false; break;
            case 'KeyS': this.moveBackward = false; break;
            case 'KeyA': this.moveLeft = false; break;
            case 'KeyD': this.moveRight = false; break;
            case 'KeyQ': this.yawLeft = false; break;
            case 'KeyE': this.yawRight = false; break;
            case 'Space': this.moveUp = false; break;
            case 'ShiftLeft': this.moveDown = false; break;
        }
    }

    // WHY: the triangle-level SAT test (TriangleSpatialHash) is the ground
    // truth for what is solid. This method simply expands the camera centre
    // into a world-space AABB using the hitbox constants and delegates to the
    // injected collidesWithAABB callback. No voxel-grid approximation needed.
    private hitboxOverlapsSolid(x: number, y: number, z: number): boolean {
        if (!this.collidesWithAABB) return false;

        const hw = CAMERA_HITBOX_WIDTH  / 2;
        const hh = CAMERA_HITBOX_HEIGHT / 2;
        const hd = CAMERA_HITBOX_DEPTH  / 2;

        return this.collidesWithAABB(x - hw, y - hh, z - hd, x + hw, y + hh, z + hd);
    }

    update(deltaTime: number): void {
        const cosYaw = Math.cos(this.camera.yaw);
        const sinYaw = Math.sin(this.camera.yaw);

        const forwardX = sinYaw;
        const forwardZ = -cosYaw;

        const rightX = cosYaw;
        const rightZ = sinYaw;

        const speed = this.moveSpeed * deltaTime;

        // Accumulate desired displacement per axis.
        let dx = 0, dy = 0, dz = 0;

        if (this.moveForward)  { dx += forwardX * speed; dz += forwardZ * speed; }
        if (this.moveBackward) { dx -= forwardX * speed; dz -= forwardZ * speed; }
        if (this.moveRight)    { dx += rightX   * speed; dz += rightZ   * speed; }
        if (this.moveLeft)     { dx -= rightX   * speed; dz -= rightZ   * speed; }
        if (this.moveUp)       { dy += speed; }
        if (this.moveDown)     { dy -= speed; }
        if (this.yawLeft)      { this.camera.yaw -= this.keyboardYawSpeed * deltaTime; }
        if (this.yawRight)     { this.camera.yaw += this.keyboardYawSpeed * deltaTime; }

        // WHY: apply each axis independently so the player slides along a
        // surface instead of stopping dead when moving diagonally into a wall.
        const cx = this.camera.positionX;
        const cy = this.camera.positionY;
        const cz = this.camera.positionZ;

        if (dx !== 0 && !this.hitboxOverlapsSolid(cx + dx, cy, cz)) {
            this.camera.positionX += dx;
        }
        if (dy !== 0 && !this.hitboxOverlapsSolid(this.camera.positionX, cy + dy, cz)) {
            this.camera.positionY += dy;
        }
        if (dz !== 0 && !this.hitboxOverlapsSolid(this.camera.positionX, this.camera.positionY, cz + dz)) {
            this.camera.positionZ += dz;
        }
    }

    destroy(): void {
        window.removeEventListener('keydown', this.handleKeyDown);
        window.removeEventListener('keyup', this.handleKeyUp);
        this.canvas.removeEventListener('click', this.handleCanvasClick);
        document.removeEventListener('pointerlockchange', this.handlePointerLockChange);
        document.removeEventListener('mousemove', this.handleMouseMove);
    }
}
