import { useEffect, useRef, useState } from 'react';
import { type ToolbarHandle, Toolbar } from './ui/components/Toolbar/Toolbar';
import { type ItemMenuHandle, ItemMenu } from './ui/components/ItemMenu/ItemMenu';
import { type LoadModalHandle, LoadModal } from './ui/LoadModal/LoadModal';
import { type Terminal, TerminalComponent } from './ui/components/Terminal/Terminal';
import { type SceneHierarchy, SceneHierarchyComponent } from './ui/components/SceneHierarchy/SceneHierarchy';
import {type PropertyPanel, PropertyPanelComponent }   from './ui/components/PropertyPanel/PropertyPanel';
import { ResizeDivider }            from './ui/ResizeDivider/ResizeDivider';
import { SceneManager }             from './game/SceneManager';
import { getStoredNumber, setStoredNumber } from '@lib/storage';
import registryJson                 from './items/registry.json';
import type { ItemRegistry, ItemEntry } from './items/types';
import './Sandbox.css';

const registry = registryJson as ItemRegistry;

export default function Sandbox() {
  const canvasRef        = useRef<HTMLCanvasElement>(null);
  const toolbarRef       = useRef<ToolbarHandle>(null);
  const terminalRef      = useRef<Terminal>(null);
  const propertyPanelRef = useRef<PropertyPanel>(null);
  const hierarchyRef     = useRef<SceneHierarchy>(null);
  const itemMenuRef      = useRef<ItemMenuHandle>(null);
  const loadModalRef     = useRef<LoadModalHandle>(null);
  const controllerRef    = useRef<SceneManager | null>(null);

  const [terminalHeight, setTerminalHeight] = useState(() =>
    getStoredNumber('sandbox.panel.terminalHeight', 12.5)
  );
  const [sidebarWidth, setSidebarWidth] = useState(() =>
    getStoredNumber('sandbox.panel.sidebarWidth', 13.75)
  );
  const [itemMenuHeight, setItemMenuHeight] = useState(() =>
    getStoredNumber('sandbox.panel.itemMenuHeight', 10)
  );
  const [isCameraDragging, setIsCameraDragging] = useState(false);

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

  useEffect(() => {
    const terminal      = terminalRef.current!;
    const propertyPanel = propertyPanelRef.current!;
    const hierarchy     = hierarchyRef.current!;
    const toolbar       = toolbarRef.current!;

    const controller = new SceneManager(canvasRef.current!, terminal, propertyPanel, hierarchy);
    controllerRef.current = controller;

    toolbar.setOnPlay(() => controller.play());
    toolbar.setOnStop(() => controller.stop());
    toolbar.setOnSave(async () => {
      const encodedString = await controller.saveScene();
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(encodedString);
        terminal.print('Scene saved — string copied to clipboard.', 'log');
      } else {
        terminal.print('Scene saved (see console for string).', 'log');
        console.log(encodedString);
      }
    });
    toolbar.setOnLoad(() => {
      loadModalRef.current!.open(async (encodedString) => {
        const success = await controller.loadScene(encodedString);
        if (!success) {
          terminal.print('Failed to load scene — invalid or corrupted data.', 'error');
        }
      });
    });

    const stopHandler          = () => toolbar.setPlaying(false);
    const cameraDragStartHandler = () => setIsCameraDragging(true);
    const cameraDragEndHandler   = () => setIsCameraDragging(false);
    document.addEventListener('sandbox:stopped',   stopHandler);
    document.addEventListener('camera:dragStarted', cameraDragStartHandler);
    document.addEventListener('camera:dragEnded',   cameraDragEndHandler);

    controller.init()
      .then(() => {
        controller.startLoop();
        itemMenuRef.current!.setEnabled(true);
        toolbar.setEnabled(true);
      })
      .catch((error: unknown) => {
        terminal.print(`Engine initialisation failed: ${error}`, 'error');
      });

    return () => {
      document.removeEventListener('sandbox:stopped',   stopHandler);
      document.removeEventListener('camera:dragStarted', cameraDragStartHandler);
      document.removeEventListener('camera:dragEnded',   cameraDragEndHandler);
      terminal.restoreConsole();
    };
  }, []);

  return (
    <div
      id="app"
      style={{
        '--terminal-height':  `${terminalHeight}rem`,
        '--left-panel-width': `${sidebarWidth}rem`,
        '--item-menu-height': `${itemMenuHeight}rem`,
      } as React.CSSProperties}
    >
      <Toolbar ref={toolbarRef} />
      <div id="main-area">
        <div id="left-sidebar">
          <ItemMenu
            ref={itemMenuRef}
            registry={registry}
            onSpawn={(key: string, entry: ItemEntry) => controllerRef.current?.spawn(key, entry)}
          />
          <ResizeDivider
            direction="horizontal"
            onResize={handleItemMenuResize}
            disabled={isCameraDragging}
            onDragStart={() => controllerRef.current?.notifyResizeDragStart()}
            onDragEnd={() => controllerRef.current?.notifyResizeDragEnd()}
          />
          <SceneHierarchyComponent
            ref={hierarchyRef}
            onSelect={(index) => controllerRef.current?.selectObject(index)}
            onRename={(index, newName) => controllerRef.current?.renameObject(index, newName) ?? false}
            onRemove={(index) => controllerRef.current?.removeObject(index)}
            onDeselect={() => controllerRef.current?.deselectObject()}
          />
        </div>
        <ResizeDivider
          direction="vertical"
          onResize={handleSidebarResize}
          disabled={isCameraDragging}
          onDragStart={() => controllerRef.current?.notifyResizeDragStart()}
          onDragEnd={() => controllerRef.current?.notifyResizeDragEnd()}
        />
        <div id="canvas-wrapper">
          <canvas ref={canvasRef} id="webgpu-canvas" />
        </div>
        <PropertyPanelComponent ref={propertyPanelRef} />
      </div>
      <div id="terminal-area">
        <ResizeDivider
          direction="horizontal"
          onResize={handleTerminalResize}
          disabled={isCameraDragging}
          onDragStart={() => controllerRef.current?.notifyResizeDragStart()}
          onDragEnd={() => controllerRef.current?.notifyResizeDragEnd()}
        />
        <TerminalComponent ref={terminalRef} />
      </div>
      <LoadModal ref={loadModalRef} />
    </div>
  );
}
