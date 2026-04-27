import type { Engine, GameObject, Quad3DOptions } from '@engine';
import type { GameScript } from './ScriptContract';

export default class EnnemySpawner implements GameScript {
  private _cube:         GameObject | null        = null;
  private _lifebar:      GameObject | null        = null;
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
    if (!this._cube) return;
    this._elapsed += deltaTime_number;
    const scale = scaleFactor_number * this.calculateScale(this._cube.getProperty('life'));
    this._cube.setProperty('life', this._cube.getProperty('life') - 1);
    this._cube.setScale(scale, scale, scale);
    this._position = [
      Math.cos(this._elapsed) * 5,
      0,
      Math.sin(this._elapsed) * 5,
    ];
    this._cube.setPosition(this._position);
    this._lifebar?.setPosition([this._position[0], this._position[1] + 1.5, this._position[2]]);
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
    const renderable: Quad3DOptions = {  
      width: 0.5,
      height: 0.1,
      color: [0, 1, 0, 1],
    }
    this._lifebar = this._engine.createQuad3D({
      renderable,
      position: [this._position[0], this._position[1] + 1.5, this._position[2]]
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
