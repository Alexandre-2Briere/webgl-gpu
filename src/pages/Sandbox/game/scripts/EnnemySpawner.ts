import type { Bar3DHandle, Engine, GameObject, UIGameObject } from '@engine';
import type { GameScript } from './ScriptContract';
import pathJson from './path.json';

const SPAWN_INTERVAL = 2; // seconds between spawns

interface CubeEntry {
  cube:    GameObject;
  lifebar: UIGameObject<Bar3DHandle>;
}

export default class EnnemySpawner implements GameScript {
  private _cubes:        CubeEntry[] = [];
  private _elapsed:      number      = 0;
  private _engine:       Engine | null = null;
  private _startingLife: number      = 100;
  private _cubeHeight:   number      = 1;
  private _path: { x: number; z: number }[] = pathJson.tiles
    .flatMap(t => t.waypoints)
    .filter((point, index, array) => index === 0 || point.x !== array[index - 1].x || point.z !== array[index - 1].z);

  async execute(engine: Engine, startingLife_number: number = 100, cubeHeight_number: number = 1): Promise<void> {
    this._startingLife = startingLife_number > 0 ? startingLife_number : this._startingLife;
    this._cubeHeight   = cubeHeight_number   > 0 ? cubeHeight_number   : this._cubeHeight;
    this._engine       = engine;
    this._spawnCube();
  }

  update(deltaTime_number: number): void {
    if (!this._engine) return;

    this._elapsed += deltaTime_number;
    if (this._elapsed >= SPAWN_INTERVAL) {
      this._elapsed -= SPAWN_INTERVAL;
      this._spawnCube();
    }

    const toRemove: number[] = [];

    for (let i = 0; i < this._cubes.length; i++) {
      const { cube, lifebar } = this._cubes[i];

      let index      = cube.getProperty('index')      as number;
      let percentage = cube.getProperty('percentage') as number;
      const speed    = cube.getProperty('speed')      as number;

      if (index >= this._path.length - 1) { toRemove.push(i); continue; }

      const current       = this._path[index];
      const next          = this._path[index + 1];
      const dx            = next.x - current.x;
      const dz            = next.z - current.z;
      const segmentLength = Math.sqrt(dx * dx + dz * dz);

      percentage += (speed * deltaTime_number) / segmentLength;

      while (percentage >= 1 && index < this._path.length - 1) {
        percentage -= 1;
        index++;
      }

      if (index >= this._path.length - 1) { toRemove.push(i); continue; }

      cube.setProperty('index',      index);
      cube.setProperty('percentage', percentage);

      const posX = this._path[index].x + (this._path[index + 1].x - this._path[index].x) * percentage;
      const posZ = this._path[index].z + (this._path[index + 1].z - this._path[index].z) * percentage;
      const posY = this._cubeHeight / 2;

      cube.setPosition([posX, posY, posZ]);
      lifebar.getHandle()?.setPosition([posX, posY + this._cubeHeight + 0.5, posZ]);
      lifebar.getHandle()?.setPercentage(this.calculateScale(cube.getProperty('life') as number));
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      this._destroyCubeAt(toRemove[i]);
    }
  }

  private _spawnCube(): void {
    if (!this._engine) return;
    const startX = this._path[0]?.x ?? 0;
    const startZ = this._path[0]?.z ?? 0;
    const posY   = this._cubeHeight / 2;
    const lifebar = this._engine.createBar3D({
      position:        [startX, posY + this._cubeHeight + 0.5, startZ],
      width:           1,
      height:          0.1,
      borderThickness: 0.02,
      borderColor:     [1, 1, 1, 1],
      fillColor:       [0, 1, 0, 1],
      emptyColor:      [0, 0, 0, 1],
      percentage:      1,
    });
    const cube = this._engine.createCube({ label: 'ennemy-spawner-cube' });
    cube.registerProperty('life',       this._startingLife);
    cube.registerProperty('speed',      1);
    cube.registerProperty('percentage', 0);
    cube.registerProperty('index',      0);
    cube.setPosition([startX, posY, startZ]);
    this._cubes.push({ cube, lifebar });
  }

  private _destroyCubeAt(index: number): void {
    const entry = this._cubes[index];
    if (!entry) return;
    entry.cube.destroy();
    entry.lifebar.destroy();
    this._cubes.splice(index, 1);
  }

  private calculateScale(life: number): number {
    return life / this._startingLife;
  }

  destroy(): void {
    for (const { cube, lifebar } of this._cubes) {
      cube.destroy();
      lifebar.destroy();
    }
    this._cubes   = [];
    this._elapsed = 0;
  }
}
