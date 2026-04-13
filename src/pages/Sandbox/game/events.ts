import type { PubSubManager } from '@engine';

export const SANDBOX_EVENTS = {
  OBJECT_SPAWNED:              'object:spawned',
  OBJECT_REMOVED:              'object:removed',
  PLAY_STARTED:                'play:started',
  PLAY_STOPPED:                'play:stopped',
  INPUT_POINTER_LOCK_RELEASED: 'input:pointerLockReleased',
} as const;

export type ObjectSpawnedPayload = { index: number };
export type ObjectRemovedPayload = { removedIndex: number };
export type { PubSubManager };
