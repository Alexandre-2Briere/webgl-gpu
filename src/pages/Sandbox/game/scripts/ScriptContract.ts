import type { Engine } from '@engine';

export interface ScriptContext {
  position: [number, number, number];
  scale:    [number, number, number];
}

export interface ScriptHandle {
  destroy(): void;
}

export type ExecuteFn = (context: ScriptContext, engine: Engine) => Promise<ScriptHandle>;
