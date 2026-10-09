// The AI watched playing, in the real game (npm run ai:watch): drawn by the game's own view and HUD, in real time,
// deciding five times a second as in training (player.ts), from its trained policy (models/player.json; ?random: keys
// at random, to see the page without one); a life after another. Beside the game: how the life stands (what it's
// paid, level, coin, quests, falls, what it's done), what it's pressing (the keys lit below, as a player's), what E
// would do, and the window it has open as it reads it (its rows, the one it picked). Keys: space pauses, 1 / 2 / 4 /
// 8 / 16 the speed, N a new life. ?seed=n: that world; ?latest: the latest player saved, not the best.
import { GameView } from '../../src/view/GameView';
import { readRenderOptions } from '../../src/view/render/renderOptions';
import { createHeroHud } from '../../src/view/hud/heroHud';
import { createClockHud } from '../../src/view/hud/clockHud';
import { createTargetHud } from '../../src/view/hud/targetHud';
import { createQuestTracker } from '../../src/view/hud/questTracker';
import { createLootPrompt } from '../../src/view/hud/lootPrompt';
import { generateRandomSeed, mulberry32 } from '../../src/util/random';
import { FRAME, FRAMES_PER_DECISION, KEYS, ROW_KEY, WAYS } from './keys';
import { ACTIONS, MOVES, Player, type PlayStep } from './player';
import { Policy, random, type PolicyWeights } from './policy';
import { prompt, type Prompt } from './senses';
import { shown } from './windows';

const DECISION = FRAME * FRAMES_PER_DECISION;
const SPEEDS = ['1', '2', '4', '8', '16'];
const AFTER = 2; // seconds a life's end stays on screen
const ARROWS = ['·', '↓', '↘', '→', '↗', '↑', '↖', '←', '↙'];
const WHAT_E_DOES: Record<Prompt, string> = {
  none: '', work: 'Work', stopChop: 'Stop chopping', loot: 'Pick up', jobBoard: 'Read the notice board', chest: 'Open the chest', chop: 'Chop', barmaidFromStool: 'Talk to the barmaid', standUp: 'Stand up', getUp: 'Get up', sit: 'Sit', lie: 'Lie down',
  barmaid: 'Talk to the barmaid', smith: 'Trade with the smith', herbalist: 'Trade with the herbalist', bouncer: 'Talk to the bouncer', pedlar: "See the pedlar's wares", traveller: 'A word with the traveller', board: 'Read the notice board', bench: 'Break down gear', well: 'Toss a silver coin',
  hallDoor: 'Open the door', stairs: 'Take the stairs', leave: 'Leave', door: 'Go in', dungeon: 'Go down', cannotChop: "Can't chop this yet",
};

const panel = document.getElementById('panel') as HTMLDivElement;
const windowCard = document.getElementById('window') as HTMLDivElement;
const keyboard = document.getElementById('keys') as HTMLDivElement;

// The keyboard drawn under the game: the game's keys, and the clicks in a window as a cap of their own.
const CAPS: Record<string, { label: string; note?: string; at: [number, number, number] }> = {
  Q: { label: 'Q', note: 'guard', at: [1, 1, 1] }, W: { label: 'W', at: [2, 1, 1] }, E: { label: 'E', note: 'use', at: [3, 1, 1] }, Tab: { label: 'Tab', note: 'focus', at: [4, 1, 1] },
  F: { label: 'F', note: 'ale', at: [5, 1, 1] }, G: { label: 'G', note: 'pie · room', at: [6, 1, 1] }, B: { label: 'B', note: 'bag', at: [7, 1, 1] }, P: { label: 'P', note: 'points', at: [8, 1, 1] }, K: { label: 'K', note: 'recipes', at: [9, 1, 1] },
  Shift: { label: 'Shift', note: 'roll', at: [1, 2, 1] }, A: { label: 'A', at: [2, 2, 1] }, S: { label: 'S', at: [3, 2, 1] }, D: { label: 'D', at: [4, 2, 1] }, Esc: { label: 'Esc', note: 'close', at: [5, 2, 1] },
  click: { label: 'click', note: 'a row', at: [6, 2, 2] }, page: { label: 'page', note: 'buy · sell', at: [8, 2, 1] }, scroll: { label: 'scroll', at: [9, 2, 1] },
  Space: { label: 'Space', note: 'strike', at: [1, 3, 4] }, button: { label: 'button', note: 'the other one', at: [6, 3, 2] },
};
const caps = Object.fromEntries(Object.entries(CAPS).map(([key, { label, note, at }]) => {
  const cap = document.createElement('div');
  cap.innerHTML = `${label}${note ? `<small>${note}</small>` : ''}`;
  cap.style.gridColumn = `${at[0]} / span ${at[2]}`;
  cap.style.gridRow = String(at[1]);
  keyboard.append(cap);
  return [key, cap];
}));
const TAP = 0.3;
const litFor: Record<string, number> = {};

// The caps a decision comes to: W A S D for its way (as the camera has them), and its key's.
function capsOf(move: number, key: number, axes: { forward: { x: number; z: number }; right: { x: number; z: number } }): string[] {
  const [dx, dz] = WAYS[move];
  const out: string[] = [];
  if (dx || dz) {
    const [ahead, aside] = [dx * axes.forward.x + dz * axes.forward.z, dx * axes.right.x + dz * axes.right.z];
    if (ahead > 0.38) out.push('W');
    if (ahead < -0.38) out.push('S');
    if (aside > 0.38) out.push('D');
    if (aside < -0.38) out.push('A');
  }
  const name = KEYS[key];
  const cap = ({ strike: 'Space', roll: 'Shift', guard: 'Q', use: 'E', focus: 'Tab', ale: 'F', other: 'G', bag: 'B', points: 'P', skills: 'K', close: 'Esc', button: 'button', page: 'page', down: 'scroll', up: 'scroll' } as Record<string, string>)[name] ?? (key >= ROW_KEY ? 'click' : null);
  if (cap) out.push(cap);
  return out;
}

function light(keys: string[], dt: number): void {
  for (const key of Object.keys(CAPS)) {
    litFor[key] = keys.includes(key) ? TAP : Math.max(0, (litFor[key] ?? 0) - dt);
    caps[key].classList.toggle('on', litFor[key] > 0);
  }
}

// The window the AI has open, as it reads it.
function drawWindow(player: Player, picked: number): void {
  const w = player.window;
  windowCard.hidden = !w;
  if (!w) return;
  const rows = shown(w);
  const lines = rows.map((r, i) => `<div class="line${i === picked ? ' picked' : ''}${r.can ? '' : ' cant'}"><span>${i}. ${r.label}${r.count > 1 ? ` ×${r.count}` : ''}${r.flag ? ' · taken' : ''}</span><span class="dim">${r.price ? `${r.price} c` : ''}${r.better ? ' <span class="better">better</span>' : ''}${r.level > 0 ? ` +${r.level}` : ''}</span></div>`);
  windowCard.innerHTML = `<b>${w.kind}${w.page ? ` · ${w.page}` : ''}${w.modal ? ' <span class="dim">(the game held)</span>' : ''}</b>${lines.join('') || '<div class="dim">nothing here</div>'}${w.rows().length > rows.length + w.offset ? '<div class="dim">… more below</div>' : ''}`;
}

async function main(): Promise<void> {
  const params = new URLSearchParams(location.search);
  const atRandom = params.has('random');
  let weights: PolicyWeights | null = null;
  if (!atRandom) {
    panel.innerHTML = '<b>Loading the player…</b>';
    // (the best saved, unless ?latest; none of either: told how to train one)
    let response = await fetch(new URL(params.has('latest') ? './models/player.json' : './models/best.json', import.meta.url));
    if (!response.ok && !params.has('latest')) response = await fetch(new URL('./models/player.json', import.meta.url));
    if (!response.ok) {
      panel.innerHTML = '<b>No trained player yet</b>npm run ai:train, then reload; or ?random to watch one pressing keys at random.';
      return;
    }
    weights = (await response.json()) as PolicyWeights;
  }
  const seed = Number(params.get('seed') ?? generateRandomSeed());
  const rng = mulberry32(seed * 7919 + 1);
  const policy = weights ? new Policy(weights) : null;
  const decide = policy ? (o: number[]) => policy.act(o, rng) : random(MOVES, ACTIONS, rng);
  const player = new Player();
  const observation = player.reset(seed);
  panel.innerHTML = '<b>Building the world…</b>';
  const view = new GameView(document.getElementById('app') as HTMLCanvasElement, player.model, readRenderOptions());
  for (const step of view.buildSteps()) step.run();
  await view.finish();
  const hudTop = document.createElement('div');
  hudTop.className = 'hud-top';
  document.body.append(hudTop);
  const updateHud = createHeroHud(player.model.hero, hudTop, player.model.moves);
  const updateClock = createClockHud();
  const updateTarget = createTargetHud(hudTop);
  const updateQuests = createQuestTracker(player.model);
  const ePrompt = createLootPrompt();

  let [speed, paused, clock, ended, held, picked, paid] = [1, false, 0, 0, false, -1, 0];
  let [move, key] = decide(observation);
  let last: PlayStep | null = null;
  held = player.decide(move, key);
  window.addEventListener('keydown', (e) => {
    if (e.key === ' ') paused = !paused;
    else if (SPEEDS.includes(e.key)) speed = Number(e.key);
    else if (e.key.toLowerCase() === 'n') ended = 1e-6;
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
        location.search = `?seed=${seed + 1}${atRandom ? '&random' : ''}`; // (a new life is a new world, and the view built afresh: the page again)
        return;
      }
      if (!held) player.advance(step);
      if ((clock += step) < DECISION) continue;
      clock -= DECISION;
      last = player.settle(held);
      paid += last.reward;
      if (last.done || last.truncated) {
        ended = 1e-6;
        continue;
      }
      [move, key] = decide(last.observation);
      picked = key >= ROW_KEY && key < ROW_KEY + 12 ? key - ROW_KEY : picked;
      held = player.decide(move, key);
    }
    const { model } = player;
    view.update(dt);
    view.render();
    light(ended > 0 || paused ? [] : capsOf(move, key, view.getMovementAxes()), Math.min(0.05, dt || 1 / 60));
    updateHud();
    updateClock(model.minutes);
    updateTarget(model.focused, model.hero.level);
    updateQuests((x, y, z) => view.toScreen(x, y, z));
    const does = WHAT_E_DOES[prompt(model)];
    ePrompt.update(does ? { label: does, x: model.hero.x, y: model.hero.y + (model.inside ? 1.1 : 0.8), z: model.hero.z } : null, (x, y, z) => view.toScreen(x, y, z));
    const { tally } = player;
    const t = `${Math.floor(player.seconds / 60)}:${String(Math.floor(player.seconds % 60)).padStart(2, '0')}`;
    const did = [['slain', tally.kills], ['chests', tally.chests], ['bought', tally.bought], ['sold', tally.sold], ['crafted', tally.crafted], ['chopped', tally.chopped], ['shifts', tally.shifts], ['ales', tally.ales], ['equipped', tally.equipped], ['eaten', tally.eaten]].filter(([, n]) => n).map(([w, n]) => `${w} ${n}`).join(' · ');
    panel.innerHTML =
      `<b>Seed ${seed} · ${t}${weights ? ` · trained ${(weights.steps ?? 0).toLocaleString()}${weights.score != null ? ` · scored ${weights.score.toFixed(2)}` : ''}` : ' · keys at random'}</b>` +
      `<div class="row"><span>Level ${model.hero.level} · ${model.hero.money} copper</span><span class="${paid >= 0 ? 'good' : 'fell'}">paid ${paid.toFixed(2)}</span></div>` +
      `<div class="row"><span>Quests ${tally.quests.done}/${tally.quests.taken}</span><span class="fell">Falls ${tally.falls}</span></div>` +
      `<div class="dim">${did || 'nothing done yet'}</div>` +
      `<div class="row"><span class="move">${ARROWS[move]} ${KEYS[key] === 'none' ? '' : KEYS[key]}</span><span class="dim">${speed}×${paused ? ' · paused' : ''}${ended > 0 ? ' · over' : ''}</span></div>` +
      `<div class="keys">space pause · ${SPEEDS.join(' / ')} speed · N a new life</div>`;
    drawWindow(player, picked);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

// (whatever goes wrong, said on the page: never stuck on 'Loading…')
window.addEventListener('error', (e) => void (panel.innerHTML = `<b>Something broke</b>${e.message}`));
main().catch((e: unknown) => void (panel.innerHTML = `<b>Something broke</b>${e instanceof Error ? e.message : String(e)}`));
