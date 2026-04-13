import { useEffect, useRef } from 'react';
import { Toolbar }                  from './ui/Toolbar/Toolbar';
import type { ToolbarHandle }       from './ui/Toolbar/Toolbar';
import { ItemMenu }                 from './ui/ItemMenu/ItemMenu';
import type { ItemMenuHandle }      from './ui/ItemMenu/ItemMenu';
import { LoadModal }                from './ui/LoadModal/LoadModal';
import type { LoadModalHandle }     from './ui/LoadModal/LoadModal';
import { TerminalComponent }        from './ui/Terminal/Terminal';
import type { Terminal }            from './ui/Terminal/Terminal';
import { SceneHierarchyComponent }  from './ui/SceneHierarchy/SceneHierarchy';
import type { SceneHierarchy }      from './ui/SceneHierarchy/SceneHierarchy';
import { PropertyPanelComponent }   from './ui/PropertyPanel/PropertyPanel';
import type { PropertyPanel }       from './ui/PropertyPanel/PropertyPanel';
import { SceneManager }             from './game/SceneManager';
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

    const stopHandler = () => toolbar.setPlaying(false);
    document.addEventListener('sandbox:stopped', stopHandler);

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
      document.removeEventListener('sandbox:stopped', stopHandler);
      terminal.restoreConsole();
    };
  }, []);

  return (
    <div id="app">
      <Toolbar ref={toolbarRef} />
      <div id="main-area">
        <div id="left-sidebar">
          <ItemMenu
            ref={itemMenuRef}
            registry={registry}
            onSpawn={(key: string, entry: ItemEntry) => controllerRef.current?.spawn(key, entry)}
          />
          <SceneHierarchyComponent
            ref={hierarchyRef}
            onSelect={(index) => controllerRef.current?.selectObject(index)}
            onRename={(index, newName) => controllerRef.current?.renameObject(index, newName) ?? false}
            onRemove={(index) => controllerRef.current?.removeObject(index)}
            onDeselect={() => controllerRef.current?.deselectObject()}
          />
        </div>
        <div id="canvas-wrapper">
          <canvas ref={canvasRef} id="webgpu-canvas" />
        </div>
        <PropertyPanelComponent ref={propertyPanelRef} />
      </div>
      <TerminalComponent ref={terminalRef} />
      <LoadModal ref={loadModalRef} />
    </div>
  );
}
