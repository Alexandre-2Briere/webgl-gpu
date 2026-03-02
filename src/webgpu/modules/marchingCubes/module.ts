// src/modules/marchingCubes/module.ts

import { MarchingCubesRenderer } from './renderer';
import { CameraController } from '../../common/utils/camera/cameraController';
import { HelpOverlay } from '../../common/utils/helpOverlay';
import { SCULPT_STRENGTH } from './constants/general';

const canvas = document.getElementById('glCanvas') as HTMLCanvasElement;
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

// ── Loading bar overlay ───────────────────────────────────────────────────────
// Positioned fixed over the full viewport (canvas fills the window).
// pointer-events: none so mouse events pass through to the canvas.
const loadingOverlay = document.createElement('div');
Object.assign(loadingOverlay.style, {
    position:       'fixed',
    inset:          '0',
    display:        'flex',
    flexDirection:  'column',
    alignItems:     'center',
    justifyContent: 'flex-end',
    padding:        '48px',
    boxSizing:      'border-box',
    pointerEvents:  'none',
    zIndex:         '10',
});

const loadingBox = document.createElement('div');
Object.assign(loadingBox.style, {
    width:          '480px',
    maxWidth:       '80vw',
    background:     'rgba(0, 0, 0, 0.65)',
    borderRadius:   '8px',
    padding:        '20px 24px',
    backdropFilter: 'blur(4px)',
});

const loadingText = document.createElement('div');
Object.assign(loadingText.style, {
    color:        '#e0e0e0',
    fontFamily:   'monospace',
    fontSize:     '13px',
    marginBottom: '12px',
    textAlign:    'center',
    letterSpacing: '0.04em',
});
loadingText.textContent = 'Generating terrain…';

const loadingTrack = document.createElement('div');
Object.assign(loadingTrack.style, {
    background:   'rgba(255, 255, 255, 0.15)',
    borderRadius: '4px',
    height:       '8px',
    overflow:     'hidden',
});

const loadingFill = document.createElement('div');
Object.assign(loadingFill.style, {
    height:     '100%',
    background: '#44aaff',
    width:      '0%',
    transition: 'width 0.12s ease',
    borderRadius: '4px',
});

loadingTrack.appendChild(loadingFill);
loadingBox.appendChild(loadingText);
loadingBox.appendChild(loadingTrack);
loadingOverlay.appendChild(loadingBox);
document.body.appendChild(loadingOverlay);

function updateLoadingBar(done: number, total: number, isComplete: boolean): void {
    if (isComplete) {
        // Remove rather than hide: once done it is gone for good.
        if (loadingOverlay.parentElement) loadingOverlay.remove();
        return;
    }
    const pct = total > 0 ? (done / total) * 100 : 0;
    loadingFill.style.width = `${pct.toFixed(1)}%`;
    loadingText.textContent =
        total > 0
            ? `Generating terrain… ${done} / ${total} chunks`
            : 'Generating terrain…';
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Help overlay ──────────────────────────────────────────────────────────────
const helpOverlay = new HelpOverlay();
// ─────────────────────────────────────────────────────────────────────────────

// WHY: WebGPU initialization is async, so we wrap the entire bootstrap in an async IIFE.
// This ensures the app is fully initialized before the render loop starts.
(async () => {
    let renderer: MarchingCubesRenderer;

    try {
        renderer = await MarchingCubesRenderer.create(canvas);
    } catch (error) {
        // WebGPU is not available or initialization failed
        console.error('Failed to initialize WebGPU renderer:', error);
        const message =
            error instanceof Error
                ? error.message
                : String(error);
        canvas.parentElement!.innerHTML = `<p style="color:red;font-family:monospace">WebGPU Error: ${message}</p>`;
        return;
    }

    const controller = new CameraController(
        renderer.getCamera(),
        canvas,
        undefined,  // onUpdate removed — RAF loop is sole render trigger
        (minX, minY, minZ, maxX, maxY, maxZ) =>  // triangle-mesh collision
            renderer.collidesWithAABB(minX, minY, minZ, maxX, maxY, maxZ),
        (minX, minY, minZ, maxX, maxY, maxZ) =>  // slope normal for ramp climbing
            renderer.collidesWithAABBNormal(minX, minY, minZ, maxX, maxY, maxZ),
    );

    // WHY: lastTimestamp is initialised in the first RAF callback (before the main
    // loop starts) so the very first deltaTime is 0 ms instead of a large spike.
    let lastTimestamp = 0;
    // Tracks whether we have already notified the controller that chunks are ready.
    let chunksUnlocked = false;

    function loop(timestamp: number): void {
        // WHY: cap deltaTime at 100 ms to prevent a single enormous position jump
        // after the tab is backgrounded and then foregrounded (browsers throttle
        // RAF callbacks when the tab is hidden, so the first frame back can report
        // hundreds of milliseconds of elapsed time).
        const deltaTime = Math.min((timestamp - lastTimestamp) / 1000, 0.1);
        lastTimestamp = timestamp;

        controller.update(deltaTime);
        renderer.render();

        // Update the loading bar after render() so pregen progress is current.
        const { done, total, isComplete } = renderer.getLoadingProgress();
        updateLoadingBar(done, total, isComplete);

        // WHY: unlock movement only once, the first frame isComplete becomes true.
        // This ensures the player cannot move or fall before all initial chunks
        // are loaded and collision geometry is fully in place.
        if (isComplete && !chunksUnlocked) {
            chunksUnlocked = true;
            controller.setChunksLoaded(true);
        }

        requestAnimationFrame(loop);
    }

    requestAnimationFrame((t) => {
        lastTimestamp = t;
        requestAnimationFrame(loop);
    });

    // WHY: mousedown instead of click: 'click' only fires for the primary button.
    // Using 'mousedown' catches both button 0 (left/add) and button 2 (right/remove)
    // in a single listener. The pointer-lock guard ensures sculpting is only
    // active while the player is controlling the camera — the first click that
    // acquires pointer lock does not sculpt because pointerLockElement is null
    // at the time mousedown fires (lock is granted asynchronously after the click).
    canvas.addEventListener('mousedown', (e: MouseEvent) => {
        if (document.pointerLockElement !== canvas) return;
        if (e.button === 0) renderer.sculpt(SCULPT_STRENGTH);
        if (e.button === 2) renderer.sculpt(-SCULPT_STRENGTH);
    });

    // WHY: prevent the browser context menu from appearing on right-click while
    // the canvas is focused, which would break pointer lock and disrupt the session.
    canvas.addEventListener('contextmenu', (e: Event) => e.preventDefault());

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
        renderer.destroy();
        helpOverlay.destroy();
    });
})();
