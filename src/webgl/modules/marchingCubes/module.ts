// src/modules/marchingCubes/marchingCubesModule.ts

import { MarchingCubesRenderer } from './renderer';
import { CameraController } from '../../common/utils/camera/cameraController';
import { SCULPT_STRENGTH } from './constants/general';

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const renderer = new MarchingCubesRenderer(canvas);
const controller = new CameraController(
    renderer.getCamera(),
    canvas,
    undefined,                                                                    // onUpdate removed — RAF loop is sole render trigger
    (minX, minY, minZ, maxX, maxY, maxZ) =>                                       // triangle-mesh collision
        renderer.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ),
);

// WHY: lastTimestamp is initialised in the first RAF callback (before the main
// loop starts) so the very first deltaTime is 0 ms instead of a large spike
// equal to the time between page load and first paint.
let lastTimestamp = 0;

function loop(timestamp: number): void {
    // WHY: cap deltaTime at 100 ms to prevent a single enormous position jump
    // after the tab is backgrounded and then foregrounded (browsers throttle
    // RAF callbacks when the tab is hidden, so the first frame back can report
    // hundreds of milliseconds of elapsed time).
    const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
    lastTimestamp = timestamp;

    controller.update(deltaTime);
    renderer.render();
    requestAnimationFrame(loop);
}

requestAnimationFrame((t) => { lastTimestamp = t; requestAnimationFrame(loop); });

// WHY mousedown instead of click: 'click' only fires for the primary button.
// Using 'mousedown' catches both button 0 (left/add) and button 2 (right/remove)
// in a single listener. The pointer-lock guard ensures sculpting is only
// active while the player is controlling the camera — the first click that
// acquires pointer lock does not sculpt because pointerLockElement is null
// at the time mousedown fires (lock is granted asynchronously after the click).
canvas.addEventListener('mousedown', (e: MouseEvent) => {
    if (document.pointerLockElement !== canvas) return;
    if (e.button === 0) renderer.sculpt( SCULPT_STRENGTH);
    if (e.button === 2) renderer.sculpt(-SCULPT_STRENGTH);
});

// WHY: prevent the browser context menu from appearing on right-click while
// the canvas is focused, which would break pointer lock and disrupt the session.
canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());
