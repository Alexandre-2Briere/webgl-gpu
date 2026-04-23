import type { Engine } from '@engine';

export interface ScriptHandle {
  destroy(): void;
}

export type ExecuteFn = (engine: Engine, ...args: unknown[]) => Promise<ScriptHandle>;
export type ScriptArgValues = Record<string, string | number | boolean>;
