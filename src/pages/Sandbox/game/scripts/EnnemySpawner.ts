import type { Bar3DHandle, Engine, GameObject, UIGameObject } from '@engine';
import type { GameScript } from './ScriptContract';

export default class EnnemySpawner implements GameScript {
  private _cube:         GameObject | null        = null;
  private _lifebar:      UIGameObject<Bar3DHandle> | null        = null;
  private _elapsed:      number                   = 0;
  private _engine:       Engine | null            = null;
  private _startingLife: number                   = 0;
  private _position:     [number, number, number] = [0, 0, 0];

  async execute(engine: Engine, startingLife_number: number = 100): Promise<void> {
    this._engine       = engine;
    this._startingLife = startingLife_number;
    this.spawn();
  }

  update(deltaTime_number: number, scaleFactor_number: number = 1): void {
    if (!this._cube || !this._lifebar) return;
    this._elapsed += deltaTime_number;
    const scale = scaleFactor_number * this.calculateScale(this._cube.getProperty('life'));
    this._lifebar.getHandle()?.setPercentage(this.calculateScale(this._cube.getProperty('life')));
    this._cube.setProperty('life', this._cube.getProperty('life') - 1);
    this._cube.setScale(scale, scale, scale);
    this._position = [
      Math.cos(this._elapsed) * 5,
      0,
      Math.sin(this._elapsed) * 5,
    ];
    this._cube.setPosition(this._position);
    this._lifebar.getHandle()?.setPosition([this._position[0], this._position[1] + 1.5, this._position[2]]);
    if(this._cube.getProperty('life') <= 0) {
      console.info('Ennemy destroyed');
      this.destroy();
      this.spawn();
    }
  }
  spawn() {
    if(!this._engine) {
      console.error('Engine not initialized');
      return;
    }
    this._lifebar = this._engine.createBar3D({
      position: [this._position[0], this._position[1] + 1.5, this._position[2]],
      width: 1,
      height: 0.1,
      borderThickness: 0.02,
      borderColor: [1, 1, 1, 1],
      fillColor: [0, 1, 0, 1],
      emptyColor: [0, 0, 0, 1],
      percentage: 1,
    });
    this._cube = this._engine.createCube({ label: 'ennemy-spawner-cube' });
    this._cube.registerProperty('life', this._startingLife);
    this._cube.setPosition(this._position);
  }
  calculateScale(life: number): number {
    return (life/this._startingLife);
  }

  destroy(): void {
    this._cube?.destroy();
    this._cube = null;
    this._lifebar?.destroy();
    this._lifebar = null;
  }
}
