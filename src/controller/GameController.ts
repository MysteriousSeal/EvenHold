import { GameModel } from '../model/GameModel';
import { GameView } from '../view/GameView';

const KEY_BINDINGS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
};

export class GameController {
  private readonly model: GameModel;
  private readonly view: GameView;
  private readonly pressed = new Set<'up' | 'down' | 'left' | 'right'>();
  private lastTime = 0;

  constructor(model: GameModel, view: GameView) {
    this.model = model;
    this.view = view;

    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
  }

  private onKey(e: KeyboardEvent, isDown: boolean): void {
    const action = KEY_BINDINGS[e.code];
    if (!action) return;
    if (isDown) this.pressed.add(action);
    else this.pressed.delete(action);
  }

  start(): void {
    this.lastTime = performance.now();
    requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.step(dt);

    requestAnimationFrame(this.tick);
  };

  private step(dt: number): void {
    const axes = this.view.getMovementAxes();

    let inputX = 0;
    let inputZ = 0;
    if (this.pressed.has('up')) {
      inputX += axes.forward.x;
      inputZ += axes.forward.z;
    }
    if (this.pressed.has('down')) {
      inputX -= axes.forward.x;
      inputZ -= axes.forward.z;
    }
    if (this.pressed.has('right')) {
      inputX += axes.right.x;
      inputZ += axes.right.z;
    }
    if (this.pressed.has('left')) {
      inputX -= axes.right.x;
      inputZ -= axes.right.z;
    }

    this.model.move(inputX, inputZ, dt);
    this.view.update(this.model);
    this.view.render();
  }
}
