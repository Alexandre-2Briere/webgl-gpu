import type { Engine } from '@engine';

export interface GameScript {
  execute(engine: Engine, ...args: unknown[]): Promise<void>;
  update(deltaTime_number: number, ...args: unknown[]): void;
  destroy(): void;
}

export interface GameScriptConstructor {
  new(): GameScript;
}

export type ScriptArgValues = Record<string, string | number | boolean>;
