import type { ArrowGizmoHandle } from "./ArrowGizmoHandle";
import type { Bar3DHandle } from "./Bar3DHandle";
import type { TextHandle } from "./TextHandle";

type Handle = Bar3DHandle | TextHandle | ArrowGizmoHandle | null;

export class UIGameObject<T extends Handle> {
    private _uiHandle: T | null = null;
    private _property: Record<string, unknown> = {};
    readonly isScreen: boolean;

    constructor(uiHandle: T, isScreen = false) {
        this._uiHandle = uiHandle;
        this.isScreen = isScreen;
    }

    getHandle(): T | null {return this._uiHandle;}

    registerProperty(key: string, value: unknown): void {
        if(this._property[key] !== undefined) {
            console.warn(`Overwriting existing property '${key}' on UIGameObject`);
            return;
        }
        this._property[key] = value;
    }

    setProperty(key: string, value: unknown): void {
        if(this._property[key] === undefined) {
            console.warn(`non existing property '${key}' on UIGameObject`);
            return;
        }
        this._property[key] = value;
    }

    removeProperty(key: string): void {
        delete this._property[key];
    }
    getProperty(key: string): unknown {
        return this._property[key];
    }

    destroy(): void {
        this.getHandle()?.destroy();
        this._uiHandle = null;
    }
}
