import type { ISceneObject } from '@engine';
import type { PropertyGroup, PhysicsConfig } from '../../items/types';
import type { ScriptHandle, ScriptArgValues } from '../scripts/ScriptContract';

export interface SpawnedObject {
  gameObject:        ISceneObject
  key:               string
  label:             string
  properties:        PropertyGroup[]
  physicsConfig:     PhysicsConfig
  selectedFbxUrl:    string | null
  playSnapshot:      [number, number, number] | null
  selectedScript:    string | null
  selectedScriptArgs: ScriptArgValues
  scriptHandle:      ScriptHandle | null
}
