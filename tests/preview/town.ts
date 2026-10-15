// A look at the cathedral town in the game's own view, to capture headless (npx vite, then /tests/preview/town.html?
// seed=&at=dx,dz (from its well)&hour=&zoom=&inside=1|x,z (in the cathedral, on its floor)&frames=): a streamed world, the
// hero stood there, the clock at that hour. window.done once drawn; window.stats its draw calls and triangles.
import { GameModel } from '../../src/model/GameModel';
import { STREAMED_SIZE } from '../../src/model/worldgen/regions';
import { townSite } from '../../src/model/town/townSite';
import { GameView } from '../../src/view/GameView';
import { readRenderOptions } from '../../src/view/render/renderOptions';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const model = new GameModel(seed, STREAMED_SIZE);
const site = townSite(seed, STREAMED_SIZE)!;
const [dx, dz] = (q.get('at') ?? '0,10').split(',').map(Number);
if (!q.get('spawn')) model.teleport(site.x + dx, site.z + dz); // (spawn=1: where the hero sets out, a plain village's country, to measure against)
model.minutes = Number(q.get('hour') ?? 13) * 60;
if (q.get('inside')) {
  const door = model.entrances.find((e) => e.type === 'cathedral')!;
  model.enterRoom(door);
  [model.hero.x, model.hero.z] = (q.get('inside') === '1' ? '5,12' : q.get('inside')!).split(',').map(Number);
}
const canvas = document.getElementById('app') as HTMLCanvasElement;
canvas.width = innerWidth;
canvas.height = innerHeight;
const view = new GameView(canvas, model, readRenderOptions());
for (const step of view.buildSteps()) step.run();
await view.finish();
const zoom = Number(q.get('zoom') ?? 0);
const camera = (view as unknown as { camera: { zoom: number; updateProjectionMatrix(): void } }).camera;
if (zoom) Object.defineProperty(camera, 'zoom', { get: () => zoom, set: () => camera.updateProjectionMatrix() }); // (past the game's own farthest: a look from afar)
for (let i = 0, frames = Number(q.get('frames') ?? 20); i < frames; i++) {
  view.update(1 / 30);
  view.render();
  await new Promise((r) => setTimeout(r, 0));
}
const w = window as unknown as { done: boolean; stats: unknown };
w.stats = view.getRenderStats();
w.done = true;
