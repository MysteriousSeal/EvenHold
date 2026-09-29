// Controller: turns input into model updates and drives the frame loop.

import { atTheBar, barmaidHere } from './barOrder';
import type { BagItem } from '../model/hero/bag';
import type { GameModel } from '../model/GameModel';
import type { GameEvent } from '../model/types';
import type { Npc } from '../model/npcs/npcs';
import type { GameView } from '../view/GameView';
import { KeyboardInput } from './KeyboardInput';
import { stepZoom } from '../view/render/zoom';

const MAX_FRAME_DT = 0.1; // seconds; avoids a huge jump after the tab was backgrounded
const WHEEL_STEP = 100; // scroll (in wheel deltas) to a zoom step

// Uncapped frames are scheduled as message-channel tasks: unlike setTimeout
// they aren't clamped to 4 ms, and unlike requestAnimationFrame they aren't
// tied to the display refresh. A hidden tab falls back to requestAnimationFrame,
// which the browser pauses, so the loop doesn't spin in the background.
function uncappedScheduler(): (callback: (now: number) => void) => void {
  const channel = new MessageChannel();
  let pending: ((now: number) => void) | null = null;
  channel.port1.onmessage = () => pending?.(performance.now());
  return (callback) => {
    if (document.hidden) {
      requestAnimationFrame(callback);
      return;
    }
    pending = callback;
    channel.port2.postMessage(null);
  };
}

export class GameController {
  private readonly input = new KeyboardInput();
  private lastTime = 0;
  private readonly schedule: (callback: (now: number) => void) => void;
  private readonly onFrame: () => void;
  private readonly onPickUp: (item: BagItem) => void;
  private readonly onEvent: (event: GameEvent) => void;
  private readonly onTalk: (npc: Npc) => void;
  private readonly onRead: (board: number) => void;
  private readonly onOrder: (npc: Npc) => void;

  constructor(
    private readonly model: GameModel,
    private readonly view: GameView,
    options: { uncapped: boolean; onFrame?: () => void; onPickUp?: (item: BagItem) => void; onEvent?: (event: GameEvent) => void; onTalk?: (npc: Npc) => void; onRead?: (board: number) => void; onOrder?: (npc: Npc) => void },
  ) {
    this.schedule = options.uncapped ? uncappedScheduler() : (callback) => requestAnimationFrame(callback);
    this.onFrame = options.onFrame ?? (() => {});
    this.onPickUp = options.onPickUp ?? (() => {});
    this.onEvent = options.onEvent ?? (() => {});
    this.onTalk = options.onTalk ?? (() => {});
    this.onRead = options.onRead ?? (() => {});
    this.onOrder = options.onOrder ?? (() => {});
    // Clicking an enemy focuses it; clicking open ground, or Escape, lets go.
    view.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0 && !this.paused && !model.inside) model.focus(view.pickEnemy(event.clientX, event.clientY, model.enemies));
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && !this.paused) model.focus(null);
    });
    // The mouse wheel steps the zoom outdoors: up, closer. Small scrolls (a
    // trackpad's) add up to a whole step first.
    let scrolled = 0;
    view.canvas.addEventListener(
      'wheel',
      (event) => {
        event.preventDefault();
        if (this.paused || model.inside) return; // indoors the camera keeps the room's own zoom
        scrolled += event.deltaY;
        if (Math.abs(scrolled) < WHEEL_STEP) return;
        stepZoom(scrolled < 0 ? 1 : -1);
        scrolled = 0;
      },
      { passive: false },
    );
  }

  start(): void {
    this.lastTime = performance.now();
    this.schedule(this.tick);
  }

  private tick = (now: number): void => {
    // rAF's timestamp is the frame's start time, which can be slightly
    // earlier than the performance.now() taken in start(); clamp so the
    // first frame never gets a negative dt.
    const dt = Math.min(MAX_FRAME_DT, Math.max(0, (now - this.lastTime) / 1000));
    this.lastTime = now;

    this.step(dt);
    this.onFrame();
    this.schedule(this.tick);
  };

  // Set while a pause menu is open: the world stands still and nothing is
  // redrawn (the last frame stays on screen), leaving the page free to
  // respond instantly to the menu.
  paused = false;

  private step(dt: number): void {
    if (this.paused) return;
    if (this.input.consumeAttack()) this.model.startAttack();
    // F, sat on a stool at the bar: order an ale from the inn's barmaid.
    if (this.input.consumeOrder() && atTheBar(this.model)) {
      const barmaid = barmaidHere(this.model);
      if (barmaid) this.onOrder(barmaid);
    }
    // E: pick up what's in reach; else, sat at the bar, talk to the barmaid;
    // else sit down or get up; else talk to her from her bar; else read the
    // notice board in reach; else toss a coin in the well beside; else go
    // through the door in reach.
    if (this.input.consumePickup()) {
      const item = this.model.pickUp();
      const barmaid = this.model.barmaidInReach;
      if (item) this.onPickUp(item);
      else if (barmaid && this.model.inside?.seated?.seat.piece.kind === 'barStool') this.onTalk(barmaid);
      else if (!this.model.sitOrStand()) {
        const board = this.model.boardInReach;
        if (barmaid) this.onTalk(barmaid);
        else if (board !== null) this.onRead(board);
        else if (this.model.wellInReach !== null) this.model.tossCoin();
        else this.model.useDoor();
      }
    }

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

    this.model.update(dirX, dirZ, dt);
    for (const event of this.model.takeEvents()) this.onEvent(event);
    this.view.update(dt);
    this.view.render();
  }
}
