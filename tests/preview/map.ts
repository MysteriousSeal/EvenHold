// A look at the map and the notice board's bounties, to capture headless (npx vite, then
// /tests/preview/map.html?seed=&show=map|mini|board): a streamed world, the hero walked from where they set out along a
// few of its villages (the land seen), a quest and a bounty taken, a purse marked; the window open. window.done once up.
import { GameModel } from '../../src/model/GameModel';
import { STREAMED_SIZE } from '../../src/model/worldgen/regions';
import { createMapWindow } from '../../src/controller/atlas/mapWindow';
import { createMinimap } from '../../src/view/hud/minimap';
import { createQuestBoardPanel } from '../../src/controller/quests/questBoardPanel';

const q = new URLSearchParams(location.search);
const model = new GameModel(Number(q.get('seed') ?? 1), STREAMED_SIZE);
const walk = (x: number, z: number) => {
  const [fx, fz] = [model.hero.x, model.hero.z];
  const steps = Math.ceil(Math.hypot(x - fx, z - fz) / 6);
  for (let i = 1; i <= steps; i++) {
    model.teleport(fx + ((x - fx) * i) / steps, fz + ((z - fz) * i) / steps);
    model.atlas.update();
  }
};
model.atlas.update();
const start = { x: model.hero.x, z: model.hero.z };
const near = [...model.villages].sort((a, b) => Math.hypot(a.x - start.x, a.z - start.z) - Math.hypot(b.x - start.x, b.z - start.z));
for (const v of near.slice(0, 7)) walk(v.x, v.z + 2);
walk(start.x + 40, start.z - 30);
model.quests.accept(model.quests.offersAt(model.boardOf(near[0]))[0]);
const board = model.boardOf(near[0]);
model.bounties.accept(model.bounties.postersAt(board)[0]);
model.atlas.marks.set('purse', () => [{ kind: 'purse', x: near[2].x + 12, z: near[2].z - 8, label: 'Your purse' }]);
const show = q.get('show') ?? 'map';
const minimap = createMinimap(model);
if (show === 'mini') {
  for (let i = 0; i < 60; i++) model.atlas.chart(Math.floor(model.hero.x / 512), Math.floor(model.hero.z / 512));
  setTimeout(() => minimap.update(), 50);
} else if (show === 'board') {
  createQuestBoardPanel(model, { setPaused() {} }).open(board);
  const tab = Array.from(document.querySelectorAll('button')).find((b) => b.textContent === 'Bounties');
  tab?.click();
  const row = document.querySelectorAll('.menu-row')[0] as HTMLElement | undefined;
  row?.click();
} else {
  minimap.toggle();
  if (minimap.on) minimap.toggle();
  minimap.update();
  createMapWindow(model, { setPaused() {}, minimap }).menu.open();
}
setTimeout(() => ((window as unknown as { done: boolean }).done = true), 1500);
