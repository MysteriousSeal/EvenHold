// Controller: turns input into model updates and drives the frame loop.

import type { GameModel } from '../model/GameModel';
import type { GameView } from '../view/GameView';
import { KeyboardInput } from './KeyboardInput';

const MAX_FRAME_DT = 0.1; // seconds; avoids a huge jump after the tab was backgrounded

export class GameController {
  private readonly input = new KeyboardInput();
  private lastTime = 0;

  constructor(
    private readonly model: GameModel,
    private readonly view: GameView,
  ) {}

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    // rAF's timestamp is the frame's start time, which can be slightly
    // earlier than the performance.now() taken in start(); clamp so the
    // first frame never gets a negative dt.
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.step(dt);
    requestAnimationFrame(this.tick);
  };

  private step(dt: number): void {
    const { forward, right } = this.view.getMovementAxes();

    let dirX = 0;
    let dirZ = 0;
    if (this.input.isPressed('up')) {
      dirX += forward.x;
      dirZ += forward.z;
    }
    if (this.input.isPressed('down')) {
      dirX -= forward.x;
      dirZ -= forward.z;
    }
    if (this.input.isPressed('right')) {
      dirX += right.x;
      dirZ += right.z;
    }
    if (this.input.isPressed('left')) {
      dirX -= right.x;
      dirZ -= right.z;
    }

    this.model.move(dirX, dirZ, dt);
    this.view.update(this.model);
    this.view.render();
  }
}
