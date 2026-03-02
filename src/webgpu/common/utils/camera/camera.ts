// src/common/camera.ts

import { CHUNK_SIZE, WORLD_SIZE } from "../../constants/constants";
import { CameraOptions } from "../../types/CameraOptions";

const DEFAULT_OPTIONS: CameraOptions = {
    fieldOfView: Math.PI / 4,
    near: 0.1,
    far: 1000.0,
};

export class Camera {
    public positionX: number;
    public positionY: number;
    public positionZ: number;
    public yaw: number;
    public pitch: number;

    private readonly fieldOfView: number;
    private readonly near: number;
    private readonly far: number;
    private aspectRatio: number;

    constructor(options: CameraOptions = DEFAULT_OPTIONS) {
        // WHY: spawn outside the generated terrain volume.
        // World XZ spans [0, WORLD_SIZE*CHUNK_SIZE]. Y terrain occupies [0, CHUNK_SIZE].
        // Placing the camera at Z = -30 puts it 30 units in front of the Z=0 boundary,
        // safely outside any solid voxels. Yaw = π makes the camera look in the +Z
        // direction, so the terrain is immediately visible on load.
        this.positionX = (WORLD_SIZE * CHUNK_SIZE) / 2;
        this.positionY = CHUNK_SIZE + 20;
        this.positionZ = -30;
        this.yaw = Math.PI;
        this.pitch = 0;
        this.aspectRatio = 1;
        this.fieldOfView = options.fieldOfView;
        this.near = options.near;
        this.far = options.far;
    }

    setAspectRatio(width: number, height: number): void {
        this.aspectRatio = width / height;
    }

    getViewMatrix(): Float32Array {
        // Calculate forward direction from yaw and pitch
        const forwardX = Math.sin(this.yaw) * Math.cos(this.pitch);
        const forwardY = Math.sin(this.pitch);
        const forwardZ = -Math.cos(this.yaw) * Math.cos(this.pitch);

        // Target is the point the camera looks at
        const targetX = this.positionX + forwardX;
        const targetY = this.positionY + forwardY;
        const targetZ = this.positionZ + forwardZ;

        // World up vector
        const worldUpX = 0;
        const worldUpY = 1;
        const worldUpZ = 0;

        // Forward vector (from target back to camera, normalized)
        let zAxisX = this.positionX - targetX;
        let zAxisY = this.positionY - targetY;
        let zAxisZ = this.positionZ - targetZ;
        const zAxisLength = Math.sqrt(zAxisX * zAxisX + zAxisY * zAxisY + zAxisZ * zAxisZ);
        zAxisX /= zAxisLength;
        zAxisY /= zAxisLength;
        zAxisZ /= zAxisLength;

        // Right vector (cross product of world up and forward)
        let xAxisX = worldUpY * zAxisZ - worldUpZ * zAxisY;
        let xAxisY = worldUpZ * zAxisX - worldUpX * zAxisZ;
        let xAxisZ = worldUpX * zAxisY - worldUpY * zAxisX;
        const xAxisLength = Math.sqrt(xAxisX * xAxisX + xAxisY * xAxisY + xAxisZ * xAxisZ);
        xAxisX /= xAxisLength;
        xAxisY /= xAxisLength;
        xAxisZ /= xAxisLength;

        // Up vector (cross product of forward and right)
        const yAxisX = zAxisY * xAxisZ - zAxisZ * xAxisY;
        const yAxisY = zAxisZ * xAxisX - zAxisX * xAxisZ;
        const yAxisZ = zAxisX * xAxisY - zAxisY * xAxisX;

        // Translation
        const translateX = -(xAxisX * this.positionX + xAxisY * this.positionY + xAxisZ * this.positionZ);
        const translateY = -(yAxisX * this.positionX + yAxisY * this.positionY + yAxisZ * this.positionZ);
        const translateZ = -(zAxisX * this.positionX + zAxisY * this.positionY + zAxisZ * this.positionZ);

        return new Float32Array([
            xAxisX, yAxisX, zAxisX, 0,
            xAxisY, yAxisY, zAxisY, 0,
            xAxisZ, yAxisZ, zAxisZ, 0,
            translateX, translateY, translateZ, 1,
        ]);
    }

    getProjectionMatrix(): Float32Array {
        const f = 1.0 / Math.tan(this.fieldOfView / 2);
        const rangeInverse = 1.0 / (this.near - this.far);

        return new Float32Array([
            f / this.aspectRatio, 0, 0, 0,
            0, f, 0, 0,
            0, 0, (this.near + this.far) * rangeInverse, -1,
            0, 0, (2 * this.near * this.far) * rangeInverse, 0,
        ]);
    }
}