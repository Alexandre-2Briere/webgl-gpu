import type { PubSubManager, LightType, ISceneObject } from '@engine';
import type { PhysicsConfig, PropertyGroup } from '../items/types';
import type { ScriptArgValues } from './scripts/ScriptContract';
import type { ItemEntry } from '../items/types';

export type LogLevel = 'log' | 'warn' | 'error';

export const SANDBOX_EVENTS = {
  // Engine internal
  OBJECT_SPAWNED:              'object:spawned',
  OBJECT_REMOVED:              'object:removed',
  OBJECT_REBUILT:              'object:rebuilt',
  PLAY_STARTED:                'play:started',
  PLAY_STOPPED:                'play:stopped',
  INPUT_POINTER_LOCK_RELEASED: 'input:pointerLockReleased',
  PROPERTY_PHYSICS_CHANGED:    'property:physicsChanged',
  PROPERTY_SCALE_CHANGED:      'property:scaleChanged',
  PROPERTY_RADIUS_CHANGED:     'property:radiusChanged',
  PROPERTY_LIGHT_TYPE_CHANGED: 'property:lightTypeChanged',
  PROPERTY_ASSET_CHANGED:      'property:assetChanged',
  PROPERTY_SCRIPT_CHANGED:     'property:scriptChanged',
  PROPERTY_SCRIPT_ARGS_CHANGED: 'property:scriptArgsChanged',
  UI_RESIZE_STARTED:           'ui:resizeDragStarted',
  UI_RESIZE_ENDED:             'ui:resizeDragEnded',
  CAMERA_DRAG_STARTED:         'camera:dragStarted',
  CAMERA_DRAG_ENDED:           'camera:dragEnded',
  // UI → game
  TOOLBAR_PLAY:                'toolbar:play',
  TOOLBAR_STOP:                'toolbar:stop',
  TOOLBAR_SAVE:                'toolbar:save',
  TOOLBAR_LOAD:                'toolbar:load',
  ITEM_SPAWN:                  'item:spawn',
  HIERARCHY_OBJECT_SELECTED:   'hierarchy:objectSelected',
  HIERARCHY_OBJECT_DESELECTED: 'hierarchy:objectDeselected',
  HIERARCHY_OBJECT_REMOVED:    'hierarchy:objectRemoved',
  HIERARCHY_OBJECT_RENAMED:    'hierarchy:objectRenamed',
  HIERARCHY_OBJECT_DUPLICATE:  'hierarchy:objectDuplicate',
  SCENE_LOAD_REQUESTED:        'scene:loadRequested',
  // game → UI
  ENGINE_INITIALIZED:          'engine:initialized',
  SCENE_SAVED:                 'scene:saved',
  TERMINAL_PRINT:              'terminal:print',
  HIERARCHY_ROW_ADDED:         'hierarchy:rowAdded',
  HIERARCHY_ROW_REMOVED:       'hierarchy:rowRemoved',
  HIERARCHY_ROW_SELECTED:      'hierarchy:rowSelected',
  HIERARCHY_ROW_RENAMED:       'hierarchy:rowRenamed',
  PROPERTY_PANEL_SHOW:         'propertyPanel:show',
  PROPERTY_PANEL_HIDE:         'propertyPanel:hide',
  PROPERTY_PANEL_SET_POSITION: 'propertyPanel:setPosition',
  PROPERTY_PANEL_SET_TITLE:    'propertyPanel:setTitle',
  PROPERTY_PANEL_FBX_CATALOG:  'propertyPanel:fbxCatalog',
} as const;

// Existing payload types
export type ObjectSpawnedPayload            = { index: number };
export type ObjectRemovedPayload            = { removedIndex: number };
export type ObjectRebuiltPayload            = { objectIndex: number };
export type PropertyPhysicsChangedPayload   = { objectIndex: number; data: { config: PhysicsConfig } };
export type PropertyScaleChangedPayload     = { objectIndex: number; data: { x: number; y: number; z: number } };
export type PropertyRadiusChangedPayload    = { objectIndex: number; data: { radius: number } };
export type PropertyLightTypeChangedPayload = { objectIndex: number; data: { lightType: LightType } };
export type PropertyAssetChangedPayload     = { objectIndex: number; data: { url: string } };
export type PropertyScriptChangedPayload     = { objectIndex: number; data: { scriptName: string } };
export type PropertyScriptArgsChangedPayload = { objectIndex: number; data: { args: ScriptArgValues } };

// UI → game payload types
export type ItemSpawnPayload                = { key: string; entry: ItemEntry };
export type HierarchyObjectSelectedPayload  = { index: number };
export type HierarchyObjectRemovedPayload   = { index: number };
export type HierarchyObjectRenamedPayload   = { index: number; name: string };
export type HierarchyObjectDuplicatePayload = { index: number };
export type SceneLoadRequestedPayload       = { encodedString: string };

// game → UI payload types
export type SceneSavedPayload              = { encodedString: string };
export type TerminalPrintPayload           = { message: string; level: LogLevel; tabId?: string };
export type HierarchyRowAddedPayload       = { name: string; key: string };
export type HierarchyRowRemovedPayload     = { index: number };
export type HierarchyRowSelectedPayload    = { index: number };
export type HierarchyRowRenamedPayload     = { index: number; name: string };
export type PropertyPanelShowPayload       = {
  gameObject:          ISceneObject;
  objectIndex:         number;
  label:               string;
  properties:          PropertyGroup[];
  physicsConfig?:      PhysicsConfig;
  selectedAssetUrl?:   string;
  selectedScript?:     string;
  selectedScriptArgs?: ScriptArgValues;
};
export type PropertyPanelSetPositionPayload = { x: number; y: number; z: number };
export type PropertyPanelSetTitlePayload    = { label: string };
export type PropertyPanelFbxCatalogPayload  = { catalog: { label: string; url: string }[] };

export type { PubSubManager };
