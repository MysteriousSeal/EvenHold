// Hazard at an inn's table (model/inn/diceHall.ts, diceTable.ts): sat at a table across from someone, H (the dice
// key) opens the board. The one across, their face and their word; both purses, and what's changed hands tonight;
// the main called (five to nine, its odds on hover) and the stake (the inn's three); Throw, and the dice tumbling to
// their faces; this game's casts in turn; Cry fullams!, mid-game, on a cheat. A Rules tab says it all plainly. The game
// plays on round it; up from the table (or the window shut), the sitting's over, a stake on the table lost.

import './dicePanel.css';
import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { MAINS, type Cast, type Main } from '../../model/inn/hazard';
import { canStart, castDice, cryFoul, oddsOf, startGame, type Sitting } from '../../model/inn/diceTable';
import { el, line } from '../../view/ui/dom';
import { coinParts, coinWords } from '../../view/ui/coins';
import { createMenu, anyMenuOpen, type Menu } from '../../view/ui/menu';
import { uiCue } from '../../view/audio/uiCue';
import { isKey, label as keyName } from '../keyBindings';
import { createLootPrompt } from '../../view/hud/lootPrompt';
import type { ToScreen } from '../../view/hud/floatingText';
import { oneOf } from '../../util/random';
import { talk } from '../trade/tradePanel';
import { DICE_RULES, HONEST, SEEN, diceFace } from './diceWords';

const ROLL_MS = 650; // the dice tumbling, before they show
const pick = (lines: readonly string[]) => oneOf(lines, Math.random());

// What the dice window needs of the view: the dice and cup on the table, thrown.
export interface DiceView {
  tumble(cast: Cast, ms: number): void;
}

export function createDicePanel(model: GameModel, view?: DiceView): { menu: Menu; update(toScreen?: ToScreen): void; prompt(): string | null } {
  let main: Main = 7;
  let stake = 0;
  let says = '';
  let rolling: { until: number; shown: { money: number; purse: number; net: number } } | null = null;
  let tick = 0;
  const prompted = createLootPrompt(() => keyName('dice'), true); // (under the hero: the ale's and the pie's over them)
  const at = () => model.dice.at;
  const sitting = (): Sitting | null => at()?.sitting ?? null;
  const theirs = () => at()?.sitting.sharp ?? null;

  // Their word on how it went: a sharp's own, else any villager's.
  const word = (kind: 'won' | 'lost' | 'caught' | 'wronged' | 'cleaned out' | 'enough'): string => {
    const sharp = theirs();
    if (sharp && (kind === 'won' || kind === 'lost' || kind === 'caught' || kind === 'wronged')) return pick(sharp[kind]);
    return pick(HONEST[kind === 'won' ? 'theyWon' : kind === 'lost' ? 'theyLost' : kind]);
  };

  // A throw: a game begun first if none's under way (the stake down, the main called), then a cast; the dice tumble
  // ROLL_MS before they show, the purses as they were till then.
  const throwDice = () => {
    const s = sitting();
    if (!s || rolling) return;
    const shown = { money: model.hero.money, purse: s.purse, net: s.net };
    if (!s.game || s.game.result) {
      const why = canStart(s, model.hero, stake);
      if (why !== 'ok') return void ((says = why === 'too poor' ? "You can't cover that, friend." : why === 'short' ? "I haven't that much left on me." : says), uiCue('error'), menu.refresh());
      startGame(s, model.hero, main, stake, Math.random);
    }
    const cast = castDice(s, model.hero, Math.random)!;
    view?.tumble(cast, ROLL_MS);
    rolling = { until: performance.now() + ROLL_MS, shown };
    menu.refresh();
  };

  // The dice down: their word on it, coin's clink or not.
  const landed = () => {
    rolling = null;
    const s = sitting()!;
    const g = s.game!;
    if (g.result) {
      uiCue(g.result === 'won' ? 'coin' : 'error');
      says = s.over === 'cleaned out' || s.over === 'enough' ? word(s.over) : word(g.result === 'won' ? 'lost' : 'won'); // (theirs: the hero's win their loss)
    } else if (g.casts.length === 1) says = `The chance is ${g.chance}. Throw for it before the ${g.main}.`;
    menu.refresh();
  };

  const cry = () => {
    const s = sitting();
    if (!s || rolling) return;
    const cried = cryFoul(s, model.hero);
    if (!cried) return;
    uiCue(cried.caught ? 'coin' : 'error');
    says = word(cried.caught ? 'caught' : 'wronged');
    if (cried.caught) model.dice.caughtOut(model.folk); // (a swing at the hero; the bouncer comes)
    menu.refresh();
  };

  const button = (label: string, on: () => void, can: boolean, extra = '') => {
    const b = el('button', `menu-button ${extra}`, label) as HTMLButtonElement;
    b.disabled = !can;
    b.addEventListener('click', on);
    return b;
  };

  // The board: who's across, the purses, the dice and this game's casts, what to call and stake, and the throw.
  const board = (): HTMLElement => {
    const wrap = el('div', 'dice-board');
    const a = at();
    const s = sitting();
    if (!a || !s) return wrap;
    wrap.append(talk(a.with, says, 'buy'));
    const shown = rolling?.shown ?? { money: model.hero.money, purse: s.purse, net: s.net };
    const purses = el('div', 'menu-purse dice-purses');
    const purse = (name: string, copper: number) => {
      const p = el('span', 'shop-purse');
      p.append(el('b', '', name), ...coinParts(copper, true));
      return p;
    };
    const net = el('span', `dice-net ${shown.net > 0 ? 'up' : shown.net < 0 ? 'down' : ''}`, shown.net === 0 ? 'Even tonight' : `${shown.net > 0 ? 'Up' : 'Down'} ${coinWords(Math.abs(shown.net))} tonight`);
    purses.append(purse('Yours', shown.money), net, purse('Theirs', shown.purse));
    wrap.append(purses);
    // The dice, and the game.
    const g = s.game;
    const table = el('div', 'dice-table');
    const last = g?.casts[g.casts.length - 1];
    const faces = rolling ? [1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)] : last ?? null;
    const dice = el('div', `dice-dice${rolling ? ' rolling' : ''}`);
    if (faces) dice.append(diceFace(faces[0]), diceFace(faces[1]));
    else dice.append(el('span', 'dice-idle', 'Call your main, put your stake down, and throw.'));
    const state = el('div', 'dice-state');
    if (g) {
      const casts = rolling ? g.casts.slice(0, -1) : g.casts;
      state.append(line('dice-called', `Main ${g.main}${g.chance !== null && casts.length > 0 ? ` · chance ${g.chance}` : ''} · ${coinWords(g.stake)} a side`));
      state.append(line('dice-casts', casts.map(([x, y]) => `${x + y}`).join(' · ') || '·'));
      if (g.seen && !g.result) state.append(line('dice-seen', SEEN.replace('{name}', a.with.name)));
      if (!rolling && g.result) state.append(line(`dice-result ${g.result}`, g.result === 'won' ? `You win ${coinWords(g.stake)}.` : `You lose ${coinWords(g.stake)}.`));
    }
    table.append(dice, state);
    wrap.append(table);
    if (s.over) {
      wrap.append(line('dice-over', s.over === 'caught' ? 'Caught out! The bouncer will see them off.' : s.over === 'wronged' ? 'They want no more to do with you tonight.' : 'They’re done playing for tonight.'));
      return wrap;
    }
    // The call and the stake, between games; mid-game, throwing on (or crying foul).
    const playing = !!g && !g.result;
    const calls = el('div', 'dice-calls');
    const mains = el('div', 'dice-row');
    mains.append(el('b', '', 'Main'));
    for (const m of MAINS) {
      const b = button(`${m}`, () => ((main = m), menu.refresh()), !playing && !rolling, m === main ? 'chosen' : '');
      b.title = `You win ${Math.round(oddsOf(m) * 1000) / 10}% of games on a main of ${m}.`;
      mains.append(b);
    }
    const stakes = el('div', 'dice-row');
    stakes.append(el('b', '', 'Stake'));
    if (!s.stakes.includes(stake)) stake = s.stakes[0];
    for (const k of s.stakes) stakes.append(button(coinWords(k), () => ((stake = k), menu.refresh()), !playing && !rolling && k <= s.purse, k === stake ? 'chosen' : ''));
    calls.append(mains, stakes);
    const acts = el('div', 'menu-buttons dice-acts');
    acts.append(button(playing ? 'Throw again' : 'Throw', throwDice, !rolling, 'teal'), button('Cry fullams!', cry, playing && !rolling, 'dice-foul'));
    acts.lastElementChild!.setAttribute('title', 'Say their dice are loaded. Right: your stake back, theirs, and all they’ve won off you tonight. Wrong: your stake, and as much again for the insult.');
    wrap.append(calls, acts);
    return wrap;
  };

  const rules = (): HTMLElement => {
    const wrap = el('div', 'dice-rules');
    for (const [head, text] of DICE_RULES) wrap.append(line('dice-rule-head', head), line('dice-rule', text));
    return wrap;
  };

  const menu = createMenu({
    title: 'Hazard',
    modal: false,
    place: 'center',
    keyHints: false,
    tabs: [
      { name: 'Table', header: board },
      { name: 'Rules', header: rules },
    ],
    onOpenChange: (open) => {
      if (open) return;
      rolling = null;
      model.dice.rise(); // (up from the table: a stake on it lost)
    },
  });

  // H by the table (the dice key): the board opened (or shut).
  window.addEventListener('keydown', (e) => {
    if (!isKey('dice', e.code) || e.repeat) return;
    if (menu.isOpen) return menu.close();
    if (anyMenuOpen() || !model.inside) return;
    const npc = model.dice.across(model.folk);
    if (!npc) return;
    open(npc);
  });

  function open(npc: Npc): void {
    const a = model.dice.play(npc);
    if (!a) return;
    const sharp = a.sitting.sharp;
    says = sharp ? pick(model.dice.knows(sharp) ? sharp.again : sharp.hello) : pick(HONEST.hello);
    stake = a.sitting.stakes[0];
    menu.setTitle(`Hazard with ${npc.name}`);
    menu.open(0);
  }

  return {
    menu,
    // Each frame: the prompt under the hero, sat where they could play; the dice down once they've tumbled; the hero
    // up from the table, or the one across gone, it shuts.
    update(toScreen) {
      const says = this.prompt();
      const { hero } = model;
      if (toScreen) prompted.update(says ? { label: says, x: hero.x, y: hero.y, z: hero.z } : null, toScreen);
      if (!menu.isOpen) return;
      const a = at();
      const chair = model.inside?.seated?.seat.piece;
      if (!a || !chair || model.inside?.entrance !== a.inn || (!a.with.seat && a.sitting.over !== 'caught')) return menu.close();
      if (rolling && performance.now() >= rolling.until) landed();
      else if (rolling && performance.now() - tick > 70) ((tick = performance.now()), menu.refresh()); // (the faces flickering as they tumble)
    },
    // The prompt over the hero's head, sat where they could play: who with.
    prompt() {
      if (menu.isOpen || !model.inside?.seated || model.work.shift) return null;
      const npc = model.dice.across(model.folk);
      return npc ? `Dice with ${npc.name}` : null;
    },
  };
}
