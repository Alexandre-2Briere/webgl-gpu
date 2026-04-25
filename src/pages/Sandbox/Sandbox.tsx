import { useEffect, useRef, useState } from 'react';
import { Toolbar } from './ui/components/Toolbar/Toolbar';
import { ItemMenu } from './ui/components/ItemMenu/ItemMenu';
import { LoadModal } from './ui/LoadModal/LoadModal';
import { TerminalComponent } from './ui/components/Terminal/Terminal';
import { SceneHierarchyComponent } from './ui/components/SceneHierarchy/SceneHierarchy';
import { PropertyPanelComponent } from './ui/components/PropertyPanel/PropertyPanel';
import { ResizeDivider } from './ui/ResizeDivider/ResizeDivider';
import { SceneManager } from './game/SceneManager';
import { getStoredNumber, setStoredNumber } from '@lib/storage';
import registryJson from './items/registry.json';
import type { ItemRegistry } from './items/types';
import type { PubSubManager } from './game/events';
import './Sandbox.css';

const registry = registryJson as ItemRegistry;

export default function Sandbox() {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneManager | null>(null);
  const [pubSub, setPubSub] = useState<PubSubManager | null>(null);

  const [terminalHeight, setTerminalHeight] = useState(() =>
    getStoredNumber('sandbox.panel.terminalHeight', 12.5)
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    getStoredNumber('sandbox.panel.sidebarWidth', 13.75)
  );
  const [itemMenuHeight, setItemMenuHeight] = useState(() =>
    getStoredNumber('sandbox.panel.itemMenuHeight', 10)
  );

  function pixelsToRem(pixels: number): number {
    return pixels / parseFloat(getComputedStyle(document.documentElement).fontSize);
  }

  function handleTerminalResize(deltaInPixels: number): void {
    setTerminalHeight((previous) => {
      const next = Math.min(37.5, Math.max(5, previous - pixelsToRem(deltaInPixels)));
      setStoredNumber('sandbox.panel.terminalHeight', next);
      return next;
    });
  }

  function handleSidebarResize(deltaInPixels: number): void {
    setSidebarWidth((previous) => {
      const next = Math.min(25, Math.max(9.375, previous + pixelsToRem(deltaInPixels)));
      setStoredNumber('sandbox.panel.sidebarWidth', next);
      return next;
    });
  }

  function handleItemMenuResize(deltaInPixels: number): void {
    setItemMenuHeight((previous) => {
      const next = Math.min(31.25, Math.max(5, previous + pixelsToRem(deltaInPixels)));
      setStoredNumber('sandbox.panel.itemMenuHeight', next);
      return next;
    });
  }

  // Phase 1 — create engine and expose its pubSub to sections
  useEffect(() => {
    const controller = new SceneManager(canvasRef.current!);
    controllerRef.current = controller;
    controller.createEngine().then(enginePubSub => setPubSub(enginePubSub));
  }, []);

  // Phase 2 — sections have mounted and subscribed; run setup
  useEffect(() => {
    if (!pubSub) return;
    controllerRef.current!.setup()
      .then(() => controllerRef.current!.startLoop())
      .catch((error: unknown) =>
        pubSub.publish('terminal:print', { message: `Engine setup failed: ${error}`, level: 'error' })
      );
  }, [pubSub]);

  return (
    <div
      id="app"
      style={{
        '--terminal-height':  `${terminalHeight}rem`,
        '--left-panel-width': `${sidebarWidth}rem`,
        '--item-menu-height': `${itemMenuHeight}rem`,
      } as React.CSSProperties}
    >
      {pubSub && <Toolbar pubSub={pubSub} />}
      <div id="main-area">
        <div id="left-sidebar">
          {pubSub && (
            <>
              <ItemMenu pubSub={pubSub} registry={registry} />
              <ResizeDivider
                direction="horizontal"
                onResize={handleItemMenuResize}
                pubSub={pubSub}
              />
              <SceneHierarchyComponent pubSub={pubSub} />
            </>
          )}
        </div>
        {pubSub && (
          <ResizeDivider
            direction="vertical"
            onResize={handleSidebarResize}
            pubSub={pubSub}
          />
        )}
        <div id="canvas-wrapper">
          <canvas ref={canvasRef} id="webgpu-canvas" />
        </div>
        {pubSub && <PropertyPanelComponent pubSub={pubSub} />}
      </div>
      <div id="terminal-area">
        {pubSub && (
          <>
            <ResizeDivider
              direction="horizontal"
              onResize={handleTerminalResize}
              pubSub={pubSub}
            />
            <TerminalComponent pubSub={pubSub} />
          </>
        )}
      </div>
      {pubSub && <LoadModal pubSub={pubSub} />}
    </div>
  );
}
