// A trained AI watched, in the real game: drawn by the game's own view, in real time, deciding ten times a second as
// in training. Two of them:
// - the fighter (npm run ai:watch): the arena's fights (arena.ts) one after another, the named ones in turn, then any
//   at random; a panel with the fight, what it's pressing, its health and its foes', the tally so far;
// - the player (npm run ai:player:watch, ?player): the whole game played by keys (player.ts), a life after another; a
//   panel with what it's pressing, how it stands, and how far it's got (level, quests, falls, places found).
// Keys: space pauses, 1 / 2 / 4 / 8 / 16 the speed, N the next fight (or a new life).
import { Arena, FRAME, FRAMES_PER_DECISION, NAMED_FIGHTS } from './arena';
import { Player } from './player';
import { FighterPolicy, type PolicyWeights } from './fighterPolicy';
import { GameView } from '../../src/view/GameView';
import { readRenderOptions } from '../../src/view/render/renderOptions';
import { maxHpOf } from '../../src/model/hero/attributes';
import type { GameModel } from '../../src/model/GameModel';

const DECISION = FRAME * FRAMES_PER_DECISION; // game seconds between its decisions
const ARROWS = ['·', '↓', '↘', '→', '↗', '↑', '↖', '←', '↙']; // (each way, by the map: north is -z)
const KEYS = ['', 'a blow', 'a roll', 'the guard', 'E', 'eat', 'gear on'];
const AFTER = 1.5; // seconds a fight's end stays on screen
const SPEEDS = ['1', '2', '4', '8', '16'];

interface Outcome {
  observation: number[];
  done: boolean;
  truncated: boolean;
  info: Record<string, number | boolean>;
}

// What's watched, either way: a game, started afresh (the n-th time), decided and played on.
interface Watched {
  readonly model: GameModel;
  start(n: number): number[];
  decide(move: number, key: number): void;
  advance(dt: number): void;
  settle(): Outcome;
  describe(last: Outcome | null): string; // the panel's own part
}

const panel = document.getElementById('panel') as HTMLDivElement;

// The keyboard drawn under the game: each key the AI's decision comes to, as a player would press it (the way it goes
// as W A S D, turned to the camera as the game's own keys are; a blow Space, a roll Shift, the guard Q held, E, eating
// 1 off the action bar, gear on B from the bag). Its place on the grid: [column, row, columns wide].
const CAPS: Record<string, { label: string; note?: string; at: [number, number, number] }> = {
  Q: { label: 'Q', note: 'guard', at: [1, 1, 1] },
  W: { label: 'W', at: [2, 1, 1] },
  E: { label: 'E', note: 'use', at: [3, 1, 1] },
  Shift: { label: 'Shift', note: 'roll', at: [1, 2, 1] },
  A: { label: 'A', at: [2, 2, 1] },
  S: { label: 'S', at: [3, 2, 1] },
  D: { label: 'D', at: [4, 2, 1] },
  Space: { label: 'Space', note: 'strike', at: [1, 3, 4] },
  '1': { label: '1', note: 'eat', at: [6, 1, 1] },
  B: { label: 'B', note: 'gear', at: [7, 1, 1] },
};
const keyboard = document.getElementById('keys') as HTMLDivElement;
const caps = Object.fromEntries(
  Object.entries(CAPS).map(([key, { label, note, at }]) => {
    const cap = document.createElement('div');
    cap.innerHTML = `${label}${note ? `<small>${note}</small>` : ''}`;
    cap.style.gridColumn = `${at[0]} / span ${at[2]}`;
    cap.style.gridRow = String(at[1]);
    keyboard.append(cap);
    return [key, cap];
  }),
);
const TAP = 0.25; // seconds a tapped key stays lit (a tenth of a second is too quick to see)
const litFor: Record<string, number> = {};
const WAYS: ReadonlyArray<[number, number]> = [[0, 0], ...Array.from({ length: 8 }, (_, i) => [Math.sin((i * Math.PI) / 4), Math.cos((i * Math.PI) / 4)] as [number, number])];

// The keys a decision comes to: W A S D for its way (as the camera has them: `axes`, the game's), and its key.
function keysOf(move: number, key: number, axes: { forward: { x: number; z: number }; right: { x: number; z: number } }): string[] {
  const [dx, dz] = WAYS[move];
  const keys: string[] = [];
  if (dx || dz) {
    const [ahead, aside] = [dx * axes.forward.x + dz * axes.forward.z, dx * axes.right.x + dz * axes.right.z];
    if (ahead > 0.38) keys.push('W');
    if (ahead < -0.38) keys.push('S');
    if (aside > 0.38) keys.push('D');
    if (aside < -0.38) keys.push('A');
  }
  const pressed = [null, 'Space', 'Shift', 'Q', 'E', '1', 'B'][key];
  if (pressed) keys.push(pressed);
  return keys;
}

// Each frame: the keys held now lit, a tap kept lit a moment.
function light(keys: string[], dt: number): void {
  for (const key of Object.keys(CAPS)) {
    litFor[key] = keys.includes(key) ? TAP : Math.max(0, (litFor[key] ?? 0) - dt);
    caps[key].classList.toggle('on', litFor[key] > 0);
  }
}
const bar = (share: number) => `<div class="bar"><i style="width:${Math.max(0, Math.min(1, share)) * 100}%"></i></div>`;
const heroRow = (model: GameModel, label: string) => `<div class="row"><span>${label}</span><span class="dim">${Math.ceil(model.hero.hp)}/${maxHpOf(model.hero)}</span></div>${bar(model.hero.hp / maxHpOf(model.hero))}`;

function fights(): Watched {
  const arena = new Arena();
  const tally = { won: 0, fell: 0, time: 0 };
  let fight = 0;
  return {
    get model() {
      return arena.model;
    },
    start(n) {
      fight = n;
      return arena.reset(1000 + n, NAMED_FIGHTS[n % (NAMED_FIGHTS.length * 2)] ?? undefined, true); // (the named ones, then as many at random)
    },
    decide: (move, key) => arena.decide(move, key),
    advance: (dt) => arena.advance(dt),
    settle() {
      const step = arena.settle();
      if (step.done || step.truncated) step.info.won ? tally.won++ : step.info.fell ? tally.fell++ : tally.time++;
      return step;
    },
    describe(last) {
      const foes = arena.model.enemies.map((e) => `<div class="row"><span>${e.kind} · level ${e.level}</span><span class="dim">${e.state === 'dead' ? 'slain' : `${Math.ceil(e.hp)}/${e.maxHp}`}</span></div>${e.state === 'dead' ? '' : bar(e.hp / e.maxHp)}`).join('');
      const over = last && (last.done || last.truncated) ? (last.info.won ? '<div class="won">Won</div>' : last.info.fell ? '<div class="fell">Fell</div>' : '<div class="dim">Out of time</div>') : '';
      const fought = tally.won + tally.fell + tally.time;
      return (
        `<b>Fight ${fight + 1}: ${arena.scenario.name}</b>` +
        heroRow(arena.model, `Hero · level ${arena.model.hero.level}${arena.scenario.kit ? ', kitted' : ''}`) +
        foes +
        over +
        `<div class="row"><span>So far: <span class="won">${tally.won} won</span> · <span class="fell">${tally.fell} fell</span> · ${tally.time} out of time</span><span class="dim">${fought ? Math.round((tally.won / fought) * 100) : 0}%</span></div>`
      );
    },
  };
}

function lives(): Watched {
  const player = new Player();
  let life = 0;
  let info: Outcome['info'] = {};
  return {
    get model() {
      return player.model;
    },
    start(n) {
      [life, info] = [n, {}];
      return player.reset(n, true);
    },
    decide: (move, key) => player.decide(move, key),
    advance: (dt) => player.advance(dt),
    settle() {
      const step = player.settle();
      info = step.info;
      return step;
    },
    describe() {
      const { hero, inside } = player.model;
      const n = (k: string) => Number(info[k] ?? 0);
      return (
        `<b>Life ${life + 1} · ${Math.floor(n('seconds') / 60)}:${String(Math.floor(n('seconds') % 60)).padStart(2, '0')}</b>` +
        heroRow(player.model, `Level ${hero.level} · ${hero.money} copper${inside ? ` · in the ${inside.entrance.type}` : ''}`) +
        `<div class="row"><span>Experience ${n('xp')}</span><span>Quests ${n('quests')} done of ${n('taken')} taken</span></div>` +
        `<div class="row"><span>Damage dealt ${n('dealt')}</span><span>Chests ${n('chests')} · cleared ${n('cleared')}</span></div>` +
        `<div class="row"><span>Places found ${n('found')}</span><span>Ground walked ${n('patches')}</span></div>` +
        `<div class="row"><span class="fell">Falls ${n('falls')}</span><span class="dim">${player.model.quests.taken.length} quests taken</span></div>`
      );
    },
  };
}

async function main(): Promise<void> {
  const asPlayer = new URLSearchParams(location.search).has('player');
  const name = asPlayer ? 'player' : 'fighter';
  const response = await fetch(new URL(`./models/${name}.json`, import.meta.url));
  if (!response.ok) {
    panel.textContent = `No trained ${name} yet: npm run ${asPlayer ? 'ai:player:train' : 'ai:train'}, then reload.`;
    return;
  }
  const ai = new FighterPolicy((await response.json()) as PolicyWeights);
  const watched = asPlayer ? lives() : fights();
  // (the player drawn by its odds, as in training: the fighter, its likeliest, its best play)
  const chance = Math.random.bind(Math);
  const decide = (seen: number[]) => ai.act(seen, asPlayer ? chance : undefined);
  let round = 0;
  let observation = watched.start(round);
  const view = new GameView(document.getElementById('app') as HTMLCanvasElement, watched.model, readRenderOptions());
  for (const step of view.buildSteps()) step.run();
  await view.finish();

  let [speed, paused, clock, ended] = [1, false, 0, 0];
  let [move, key] = decide(observation);
  let last: Outcome | null = null;
  watched.decide(move, key);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') paused = !paused;
    else if (SPEEDS.includes(e.key)) speed = Number(e.key);
    else if (e.key.toLowerCase() === 'n') ended = AFTER; // (on to the next)
  });

  let before = performance.now();
  const frame = (now: number) => {
    const dt = Math.min(0.05, (now - before) / 1000) * (paused ? 0 : speed);
    before = now;
    for (let left = dt; left > 1e-6; ) {
      const step = Math.min(left, 1 / 60);
      left -= step;
      if (ended > 0) {
        if ((ended += step) < AFTER) continue;
        observation = watched.start(++round);
        [ended, clock, last] = [0, 0, null];
        [move, key] = decide(observation);
        watched.decide(move, key);
        continue;
      }
      watched.advance(step);
      if ((clock += step) < DECISION) continue;
      clock -= DECISION;
      last = watched.settle();
      if (last.done || last.truncated) {
        ended = 1e-6;
        continue;
      }
      [move, key] = decide(last.observation);
      watched.decide(move, key);
    }
    view.update(dt);
    view.render();
    light(ended > 0 || paused ? [] : keysOf(move, key, view.getMovementAxes()), Math.min(0.05, dt || 1 / 60));
    panel.innerHTML =
      watched.describe(last) +
      `<div class="row"><span class="move">${ARROWS[move]} ${KEYS[key]}</span><span class="dim">${speed}×${paused ? ' · paused' : ''}</span></div>` +
      `<div class="keys">space pause · ${SPEEDS.join(' / ')} speed · N ${asPlayer ? 'a new life' : 'next fight'}</div>`;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void main();
