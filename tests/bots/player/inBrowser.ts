// The player bot at the keys of the real game, in a browser (npm run player with PLAY_HEADED=1: playthrough.ts opens
// it at ?seed=…&bot): the same player (player.ts) as a playthrough's, each frame's choosing and doing in place of the
// keys, the game drawn as it plays. A panel bottom left tells who they are, how far the story's got, and the diary as
// it goes (also in the console). Dev only (main.ts loads it only under vite's dev server).

import type { GameModel } from '../../../src/model/GameModel';
import type { GameController } from '../../../src/controller/GameController';
import { mulberry32 } from '../../../src/util/random';
import { Player } from './player';
import { describe } from './persona';

const LINES = 14;
const ACTS = ["arc 1: the first village's line", 'arc 2: the empty wagon', 'arc 2: the road of fires', 'arc 2: Greyminster', 'an ending reached'];

export function drive(model: GameModel, controller: GameController): void {
  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:9999;width:460px;max-height:46vh;overflow:hidden;padding:8px 10px;background:rgba(20,12,6,.82);color:#f3e6c8;font:12px/1.35 ui-monospace,Menlo,monospace;border:2px solid #3e2414;border-radius:6px;pointer-events:none;white-space:pre-wrap';
  document.body.append(panel);
  const lines: string[] = [];
  const start = performance.now();
  const say = (what: string) => {
    const s = Math.floor((performance.now() - start) / 1000);
    const line = `${String(Math.floor(s / 60)).padStart(2)}:${String(s % 60).padStart(2, '0')}  ${what}`;
    console.log(`[bot] ${line}`);
    lines.push(line);
    if (lines.length > LINES) lines.shift();
  };
  const report = (kind: string, detail: string) => say(`⚠ ${kind}: ${detail}`);
  const player = new Player(model, report, mulberry32(model.seed ^ 0x5eed), say);
  const speed = Number(new URLSearchParams(location.search).get('speed') ?? 1);
  if (speed > 0) controller.timeScale = speed;
  let t = 0;
  let second = 0;
  controller.driver = (dt) => {
    player.tick(dt);
    t += dt;
    if ((second += dt) >= 1) [(second = 0), player.balance.sample(t, player.stats), player.observe(t)]; // (each second, as a playthrough's: places come into sight noticed, the clock kept)
    return player.frameEvents;
  };
  const head = `the player bot: ${describe(player.persona)}`;
  setInterval(() => {
    const { hero } = model;
    panel.textContent = `${head}\nlevel ${hero.level} · ${Math.round(hero.hp)} hp · ${hero.money} copper · story: ${ACTS[model.story.saint.act]}\n\n${lines.join('\n')}`;
  }, 250);
}
