import type { Bar3DHandle } from "./Bar3DHandle";

type Handle = Bar3DHandle | null;

export class UIGameObject<T extends Handle> {
    private _uiHandle: T | null = null;
    private _property: Record<string, any> = {};

    constructor(uiHandle: T) {
        this._uiHandle = uiHandle;
    }

    getHandle(): T | null {return this._uiHandle;}

    registerProperty(key: string, value: any): void {
        if(this._property[key] !== undefined) {
            console.warn(`Overwriting existing property '${key}' on UIGameObject`);
            return;
        }
        this._property[key] = value;
    }
    
    setProperty(key: string, value: any): void {
        if(this._property[key] === undefined) {
            console.warn(`non existing property '${key}' on UIGameObject`);
            return;
        }
        this._property[key] = value;
    }
    
    removeProperty(key: string): void {
        delete this._property[key];
    }
    getProperty(key: string): any {
        return this._property[key];
    }

    destroy(): void {
        this.getHandle()?.destroy();
        this._uiHandle = null;
    }
}