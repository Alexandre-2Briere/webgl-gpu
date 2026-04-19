import type { SpawnManager } from './SpawnManager';
import type { PropertyPanel } from '../../ui/PropertyPanel/PropertyPanel';
import type { SceneHierarchy } from '../../ui/SceneHierarchy/SceneHierarchy';
import type { ArrowGizmo } from '@engine';
import { SANDBOX_EVENTS } from '../events';
import type { PubSubManager, ObjectSpawnedPayload, ObjectRemovedPayload } from '../events';

export class SelectionManager {
  private readonly _spawnManager:   SpawnManager;
  private readonly _propertyPanel:  PropertyPanel;
  private readonly _sceneHierarchy: SceneHierarchy;
  private readonly _canvas:         HTMLCanvasElement;

  private _selectedIndex = -1;
  private _gizmo: ArrowGizmo | null = null;

  constructor(
    spawnManager:   SpawnManager,
    propertyPanel:  PropertyPanel,
    sceneHierarchy: SceneHierarchy,
    canvas:         HTMLCanvasElement,
    pubSub:         PubSubManager,
  ) {
    this._spawnManager   = spawnManager;
    this._propertyPanel  = propertyPanel;
    this._sceneHierarchy = sceneHierarchy;
    this._canvas         = canvas;

    pubSub.subscribe(SANDBOX_EVENTS.OBJECT_SPAWNED, (data: unknown) => {
      const { index } = data as ObjectSpawnedPayload;
      this.select(index, false);
    });

    pubSub.subscribe(SANDBOX_EVENTS.OBJECT_REMOVED, (data: unknown) => {
      const { removedIndex } = data as ObjectRemovedPayload;
      if (this._selectedIndex === removedIndex) {
        this._selectedIndex = -1;
        if (this._gizmo) this._gizmo.visible = false;
      } else if (this._selectedIndex > removedIndex) {
        this._selectedIndex--;
      }
    });

    pubSub.subscribe(SANDBOX_EVENTS.PLAY_STARTED, () => {
      this.deselect();
    });

    this._attachClickPicker();
  }

  // ── Public API ────────────────────────────────────────────────────────────────

  setGizmo(gizmo: ArrowGizmo): void {
    this._gizmo = gizmo;
  }

  getSelectedIndex(): number {
    return this._selectedIndex;
  }

  select(index: number, isPlaying: boolean): void {
    const obj = this._spawnManager.getObject(index);
    if (!obj) return;
    this._selectedIndex = index;
    this._sceneHierarchy.setSelected(index);
    this._propertyPanel.show(
      obj.gameObject,
      obj.label,
      obj.properties,
      obj.physicsConfig,
      obj.selectedFbxUrl ?? undefined,
    );

    if (this._gizmo && !isPlaying) {
      const position   = obj.gameObject.position;
      const quaternion = obj.gameObject.quaternion;
      if(obj.key !== "InfiniteGround") {
        this._gizmo.setPosition([position[0], position[1], position[2]]);
        this._gizmo.setQuaternion([quaternion[0], quaternion[1], quaternion[2], quaternion[3]]);
        this._gizmo.setScale(1, 1, 1);
        this._gizmo.visible = true;
      }
    }
  }

  deselect(): void {
    this._selectedIndex = -1;
    this._sceneHierarchy.setSelected(-1);
    this._propertyPanel.hide();
    if (this._gizmo) this._gizmo.visible = false;
  }

  // ── Screen-space object picking ───────────────────────────────────────────────

  private _attachClickPicker(): void {
    this._canvas.addEventListener('click', (event: MouseEvent) => {
      if (this._pickingDisabled?.()) return;

      const canvasRect = this._canvas.getBoundingClientRect();
      const clickNdcX  = ((event.clientX - canvasRect.left) / canvasRect.width)  * 2 - 1;
      const clickNdcY  = 1 - ((event.clientY - canvasRect.top) / canvasRect.height) * 2;

      const cameraData = this._cameraDataGetter?.();
      if (!cameraData) return;

      const spawnedObjects = this._spawnManager.getObjects();
      let closestIndex    = -1;
      let closestDistance = 0.08;

      for (let objectIndex = 0; objectIndex < spawnedObjects.length; objectIndex++) {
        const spawnedObject = spawnedObjects[objectIndex];
        const [worldX, worldY, worldZ] = spawnedObject.gameObject.position;
        const clipX = cameraData[0]*worldX + cameraData[4]*worldY + cameraData[8]*worldZ  + cameraData[12];
        const clipY = cameraData[1]*worldX + cameraData[5]*worldY + cameraData[9]*worldZ  + cameraData[13];
        const clipW = cameraData[3]*worldX + cameraData[7]*worldY + cameraData[11]*worldZ + cameraData[15];
        if (clipW <= 0) continue;

        const distance = Math.hypot(clipX / clipW - clickNdcX, clipY / clipW - clickNdcY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex    = objectIndex;
        }
      }

      if (closestIndex !== -1) {
        this.select(closestIndex, false);
      }
    });
  }

  // ── Callbacks set by SceneManager after init ──────────────────────────────────

  private _pickingDisabled: (() => boolean) | null = null;
  private _cameraDataGetter: (() => Float32Array) | null = null;

  setPickingDisabled(callback: () => boolean): void {
    this._pickingDisabled = callback;
  }

  setCameraDataGetter(getter: () => Float32Array): void {
    this._cameraDataGetter = getter;
  }
}
