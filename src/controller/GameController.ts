// Controller: turns input into model updates and drives the frame loop.

import { takeStairs, useHallDoor } from '../model/interiors/upstairs';
import { talkingTo } from '../model/npcs/talk';
import { rentRoom, roomAction } from '../model/inn/roomLetting';
import { travellerInReach } from '../model/travellers/travellerTalk';
import type { Traveller } from '../model/travellers/travellers';
import { shopAt } from '../model/inn/tavernShop';
import { atTheBar, barmaidHere, type BarMenuItem } from './trade/barOrder';
import type { BagItem } from '../model/hero/bag';
import type { GameModel } from '../model/GameModel';
import type { GameEvent } from '../model/types';
import type { Npc } from '../model/npcs/npcs';
import type { GameView } from '../view/GameView';
import { KeyboardInput } from './KeyboardInput';
import { stepZoom } from '../view/render/zoom';

const MAX_FRAME_DT = 0.1; // seconds; avoids a huge jump after the tab was backgrounded
const MAX_STEP = 1 / 30; // the longest step the game takes at once (a sped-up frame is several)
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
  private readonly onOrder: (npc: Npc, what: BarMenuItem) => void;
  private readonly onSleep: () => void;
  private readonly onTraveller: (t: Traveller) => void;

  constructor(
    private readonly model: GameModel,
    private readonly view: GameView,
    options: { uncapped: boolean; onFrame?: () => void; onPickUp?: (item: BagItem) => void; onEvent?: (event: GameEvent) => void; onTalk?: (npc: Npc) => void; onRead?: (board: number) => void; onOrder?: (npc: Npc, what: BarMenuItem) => void; onSleep?: () => void; onTraveller?: (t: Traveller) => void },
  ) {
    this.schedule = options.uncapped ? uncappedScheduler() : (callback) => requestAnimationFrame(callback);
    this.onFrame = options.onFrame ?? (() => {});
    this.onPickUp = options.onPickUp ?? (() => {});
    this.onEvent = options.onEvent ?? (() => {});
    this.onTalk = options.onTalk ?? (() => {});
    this.onRead = options.onRead ?? (() => {});
    this.onOrder = options.onOrder ?? (() => {});
    this.onSleep = options.onSleep ?? (() => {});
    this.onTraveller = options.onTraveller ?? (() => {});
    // Clicking an enemy focuses it; clicking open ground, or Escape, lets go.
    view.canvas.addEventListener('pointerdown', (event) => {
      if (event.button === 0 && !this.paused && (!model.inside || model.crypt) && !model.yard) model.focus(view.pickEnemy(event.clientX, event.clientY, model.foes)); // (the world's foes, or a crypt's guards)
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

    // Sped up (the game speed cheat), in small steps, so nothing moves far enough in one to pass through a wall.
    let left = dt * this.timeScale;
    do this.step(Math.min(left, MAX_STEP)); // at least once a frame (the first has no time to it)
    while ((left -= MAX_STEP) > 1e-6);
    if (!this.paused) this.view.render(); // once a frame, however many steps
    this.onFrame();
    this.schedule(this.tick);
  };

  // Set while a pause menu is open: the world stands still and nothing is
  // redrawn (the last frame stays on screen), leaving the page free to
  // respond instantly to the menu.
  paused = false;
  timeScale = 1; // a dev cheat: the game running this many times as fast

  private step(dt: number): void {
    if (this.paused) return;
    if (this.input.consumeAttack()) this.model.startAttack();
    const turn = this.input.consumeFocus(); // Tab: the next foe in sight (Shift: back), where foes are (outdoors, or a crypt)
    if (turn && (!this.model.inside || this.model.crypt) && !this.model.yard) this.model.cycleFocus(turn === 'back');
    // F (an ale) or G (a pie), sat on a stool at the bar: ordered from the inn's barmaid. Stood by her, G: a room;
    // by its bed, at night, G: a night's sleep.
    const wanted = this.input.consumeOrder();
    if (wanted && atTheBar(this.model)) {
      const barmaid = barmaidHere(this.model);
      if (barmaid) this.onOrder(barmaid, wanted);
    } else if (wanted === 'pie') {
      const action = roomAction(this.model); // (by the barmaid: a room; by its bed at night: sleep)
      if (action?.kind === 'rent') rentRoom(this.model, action.barmaid, shopAt(this.model.shops, this.model.seed, this.model.entrances.indexOf(this.model.inside!.entrance)));
      else if (action?.kind === 'sleep') this.onSleep();
    }
    // E: pick up what's in reach; else, sat at the bar, talk to the barmaid;
    // else sit down or get up; else talk to her from her bar; else read the
    // smith by his counter (unless at the way out: out first); else read the
    // notice board in reach; else toss a coin in the well beside; else go
    // through the door in reach.
    if (this.input.consumePickup()) {
      const item = this.model.pickUp();
      const talker = talkingTo(this.model.npcs, this.model.inside, this.model.hero); // the barmaid, the smith
      if (item) this.onPickUp(item);
      else if (this.model.crypt?.chestInReach(this.model.hero)) this.model.crypt.openChest(); // a crypt lord's chest
      else if (talker && this.model.inside?.seated?.seat.piece.kind === 'barStool') this.onTalk(talker);
      else if (!this.model.sitOrStand()) {
        const board = this.model.boardInReach;
        const leaving = !!this.model.inside && !!this.model.doorInReach; // (at the way out: out, before a word with whoever stands by it, the bouncer)
        const traveller = !this.model.inside && !this.model.yard ? travellerInReach(this.model.travellers.list, this.model.hero) : null; // (on the road: a pedlar, a pilgrim, a guard)
        if (talker && !leaving) this.onTalk(talker);
        else if (traveller) this.onTraveller(traveller);
        else if (board !== null) this.onRead(board);
        else if (this.model.wellInReach !== null) this.model.tossCoin();
        else if (!useHallDoor(this.model) && !takeStairs(this.model)) this.model.useDoor(); // a door upstairs, else the stairs by them, else the way out
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
  }
}
