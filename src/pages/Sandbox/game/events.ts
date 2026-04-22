import type { PubSubManager, LightType } from '@engine';
import type { PhysicsConfig } from '../items/types';

export const SANDBOX_EVENTS = {
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
  UI_RESIZE_STARTED:           'ui:resizeDragStarted',
  UI_RESIZE_ENDED:             'ui:resizeDragEnded',
  CAMERA_DRAG_STARTED:         'camera:dragStarted',
  CAMERA_DRAG_ENDED:           'camera:dragEnded',
} as const;

export type ObjectSpawnedPayload            = { index: number };
export type ObjectRemovedPayload            = { removedIndex: number };
export type ObjectRebuiltPayload            = { objectIndex: number };
export type PropertyPhysicsChangedPayload   = { objectIndex: number; data: { config: PhysicsConfig } };
export type PropertyScaleChangedPayload     = { objectIndex: number; data: { x: number; y: number; z: number } };
export type PropertyRadiusChangedPayload    = { objectIndex: number; data: { radius: number } };
export type PropertyLightTypeChangedPayload = { objectIndex: number; data: { lightType: LightType } };
export type PropertyAssetChangedPayload     = { objectIndex: number; data: { url: string } };
export type PropertyScriptChangedPayload    = { objectIndex: number; data: { scriptName: string } };
export type { PubSubManager };
