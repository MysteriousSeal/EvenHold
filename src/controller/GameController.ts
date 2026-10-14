// Controller: turns input into model updates and drives the frame loop.

import { cyclePeople, peopleAbout } from '../model/hero/selection';
import { interactionOf, type Interaction, type InteractionKind } from '../model/hero/interaction';
import type { Carter } from '../model/story/carter';
import { takeStairs, useHallDoor } from '../model/interiors/upstairs';
import { rentRoom, roomAction } from '../model/inn/roomLetting';
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
import { doorNumber } from '../model/interiors/interiors';
import type { Client } from '../model/jobs/room/roomShift';
import type { Talk } from '../model/story/story';
import type { Entrance } from '../model/interiors/interiors';

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

const PRESS_KEPT = 0.2; // seconds a blow or roll pressed too soon is kept, to go as soon as it may

export class GameController {
  private readonly input = new KeyboardInput();
  private lastTime = 0;
  private readonly schedule: (callback: (now: number) => void) => void;
  private readonly onFrame: () => void;
  private readonly onPickUp: (item: BagItem) => void;
  private readonly onEvent: (event: GameEvent) => void;
  private readonly onTalk: (npc: Npc) => void;
  private readonly onRead: (board: number) => void;
  private readonly onSalvage: () => void; // (E by a village's salvage bench: its window)
  private readonly onCook: () => void; // (E by a fire: cooking's recipes)
  private readonly onCarter: (carter: Carter) => void; // (E by the carter at the start: a word with him)
  private readonly onOrder: (npc: Npc, what: BarMenuItem) => void;
  private readonly onSleep: () => void;
  private readonly onTraveller: (t: Traveller) => void;
  private readonly onWork: (inn: Entrance) => void;
  private readonly onMeet: (who: Client, talk: Talk) => void;

  constructor(
    private readonly model: GameModel,
    private readonly view: GameView,
    options: { uncapped: boolean; onFrame?: () => void; onPickUp?: (item: BagItem) => void; onEvent?: (event: GameEvent) => void; onTalk?: (npc: Npc) => void; onMeet?: (who: Client, talk: Talk) => void; onRead?: (board: number) => void; onSalvage?: () => void; onCook?: () => void; onCarter?: (carter: Carter) => void; onOrder?: (npc: Npc, what: BarMenuItem) => void; onSleep?: () => void; onTraveller?: (t: Traveller) => void; onWork?: (inn: Entrance) => void },
  ) {
    this.schedule = options.uncapped ? uncappedScheduler() : (callback) => requestAnimationFrame(callback);
    this.onFrame = options.onFrame ?? (() => {});
    this.onPickUp = options.onPickUp ?? (() => {});
    this.onEvent = options.onEvent ?? (() => {});
    this.onTalk = options.onTalk ?? (() => {});
    this.onRead = options.onRead ?? (() => {});
    this.onSalvage = options.onSalvage ?? (() => {});
    this.onCook = options.onCook ?? (() => {});
    this.onCarter = options.onCarter ?? (() => {});
    this.onOrder = options.onOrder ?? (() => {});
    this.onSleep = options.onSleep ?? (() => {});
    this.onTraveller = options.onTraveller ?? (() => {});
    this.onWork = options.onWork ?? (() => {});
    this.onMeet = options.onMeet ?? (() => {});
    // Clicking an enemy focuses it, anyone else picks them out; clicking open ground, or Escape, lets go.
    view.canvas.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || this.paused || model.yard) return;
      const foe = !model.inside || model.dungeon ? view.pickEnemy(event.clientX, event.clientY, model.foes) : null; // (the world's foes, or a crypt's guards)
      model.focus(foe);
      model.select(foe === null ? view.pickPerson(event.clientX, event.clientY, peopleAbout(model)) : null); // (no foe there: whoever is, hero/selection.ts)
    });
    window.addEventListener('keydown', (event) => {
      if (event.code === 'Escape' && !this.paused) [model.focus(null), model.select(null)];
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
  // The world drawn afresh though it's paused (something changed behind a window: the hour and the room, after a
  // night), `dt` on in what's only seen (a room easing in), nothing of the game moved.
  redraw(dt = 0): void {
    this.view.update(dt);
    this.view.render();
  }
  timeScale = 1; // a dev cheat: the game running this many times as fast
  private held = { attack: 0, roll: 0 }; // seconds a blow or a roll pressed too soon (mid-blow, mid-roll) is still kept to go

  private step(dt: number): void {
    if (this.paused) return;
    if (this.input.consumeAttack()) this.held.attack = PRESS_KEPT;
    if (this.held.attack > 0) this.held.attack = this.model.startAttack() ? 0 : this.held.attack - dt; // (pressed just before the last ends: it follows on)
    const turn = this.input.consumeFocus(); // Tab: the next foe in sight (Shift: back), where foes are (outdoors, or a crypt)
    if (turn && !this.model.yard) {
      if (!this.model.inside || this.model.dungeon) this.model.cycleFocus(turn === 'back');
      if (!this.model.focused) cyclePeople(this.model, turn === 'back'); // (no foe to turn to: whoever's about)
    }
    // F (an ale) or G (a pie), sat on a stool at the bar: ordered from the inn's barmaid. Stood by her, G: a room;
    // by its bed, at night, G: a night's sleep.
    const wanted = this.model.work.shift ? (this.input.consumeOrder(), null) : this.input.consumeOrder(); // (at work: none of it)
    if (wanted && atTheBar(this.model)) {
      const barmaid = barmaidHere(this.model);
      if (barmaid) this.onOrder(barmaid, wanted);
    } else if (wanted === 'pie') {
      const action = roomAction(this.model); // (by the barmaid: a room; by its bed at night: sleep)
      if (action?.kind === 'rent') rentRoom(this.model, action.barmaid, shopAt(this.model.shops, this.model.seed, doorNumber(this.model.inside!.entrance)));
      else if (action?.kind === 'sleep') this.onSleep();
    }
    // E: the first thing there to be done, in the one order everything reads it by (model/hero/interaction.ts); one
    // that comes to nothing (loot with a full bag, a seat that can't be had), the next.
    if (this.input.consumePickup()) {
      const tried = new Set<InteractionKind>();
      for (let found = interactionOf(this.model); found && !this.interact(found); found = interactionOf(this.model, tried)) tried.add(found.kind);
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

    // 1 to 8: what's in that slot of the action bar, eaten or drunk from the bag.
    const action = this.input.consumeAction();
    if (action !== null) this.model.useAction(action);
    // Shift: a roll the way they're going (standing, forward); Q held: the guard up.
    if (this.input.consumeRoll()) this.held.roll = PRESS_KEPT;
    if (this.held.roll > 0) this.held.roll = !this.model.work.held && this.model.roll(dirX, dirZ) ? 0 : this.held.roll - dt; // (not while held where they stand: below)
    this.model.raiseGuard(this.input.guarding);
    this.model.update(dirX, dirZ, dt);
    const come = this.model.work.arrived(); // (someone let into their room, at work: in, the door shut, their word)
    if (come) this.onMeet(come.who, come.talk);
    for (const event of this.model.takeEvents()) this.onEvent(event);
    this.view.update(dt);
  }
  // What E does, done: whether anything came of it (not: the next thing in reach, if any).
  private interact(found: Interaction): boolean {
    const { model } = this;
    switch (found.kind) {
      case 'work': {
        const met = model.work.meet(); // (someone at the door of their room: a word with them)
        return met ? (this.onMeet(met.who, met.talk), true) : model.work.use();
      }
      case 'jobBoard':
        return this.onWork(found.inn), true;
      case 'stopChop':
        return model.lumber.stop(), true;
      case 'loot': {
        const item = model.pickUp();
        if (item) this.onPickUp(item);
        return !!item;
      }
      case 'chest':
        return found.chest.open(), true;
      case 'carter':
        return this.onCarter(found.carter), true;
      case 'chop':
        return model.lumber.use();
      case 'fish':
      case 'fishing':
        return model.fishing.use(); // (cast; a bite hooked, or reeled in)
      case 'talk':
        return this.onTalk(found.npc), true;
      case 'stand':
      case 'sit':
        return model.sitOrStand();
      case 'traveller':
        return this.onTraveller(found.traveller), true;
      case 'board':
        return this.onRead(found.board), true;
      case 'bench':
        return this.onSalvage(), true;
      case 'fire':
        return this.onCook(), true;
      case 'well':
        return model.tossCoin(), true;
      case 'hallDoor':
        return useHallDoor(model);
      case 'stairs':
        return takeStairs(model);
      case 'door':
        return model.useDoor();
      case 'cannotChop':
      case 'cannotFish':
        return true; // (nothing to do: the prompt says why)
    }
  }

}
