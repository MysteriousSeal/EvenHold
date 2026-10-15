// The real game's model and view, without its controller, to capture headless (npx vite, then
// /tests/preview/polish.html?seed=&size=&minutes=): window.p to drive it (the hero put somewhere, in through a door,
// time let run, the graphics changed) and to read what a frame costs; the title "ready" once it's drawn.
import * as THREE from 'three';
import { GameModel } from '../../src/model/GameModel';
import { GameView } from '../../src/view/GameView';
import { readRenderOptions } from '../../src/view/render/renderOptions';
import { setGraphics, type Quality } from '../../src/view/render/graphics';
import { wakeVillagers } from '../../src/model/npcs/npcRoutine';
import { createTipCard } from '../../src/view/hud/tipCard';
import { createPauseMenu } from '../../src/controller/pauseMenu';
import { TIPS } from '../../src/controller/tips/firstTips';
import { label } from '../../src/controller/keyBindings';

const q = new URLSearchParams(location.search);
const seed = Number(q.get('seed') ?? 1);
const size = Number(q.get('size') ?? 192);
const canvas = document.createElement('canvas');
document.body.append(canvas);
try {
  const model = new GameModel(seed, { width: size, depth: size });
  if (q.has('minutes')) model.minutes = Number(q.get('minutes'));
  if (q.has('wake')) wakeVillagers(model.folk, model);
  const view = new GameView(canvas, model, readRenderOptions());
  for (const step of view.buildSteps()) step.run();
  await view.finish();
  const frame = (dt: number) => {
    model.update(0, 0, dt);
    view.update(dt);
    view.render();
  };
  const p = {
    THREE,
    model,
    view,
    // Time let run, a frame each 1/30 s (drawn only at the end unless `draw`).
    live(seconds: number, draw = false) {
      for (let t = 0; t < seconds; t += 1 / 30) {
        model.update(0, 0, 1 / 30);
        view.update(1 / 30);
        if (draw) view.render();
      }
      view.render();
    },
    goto(x: number, z: number) {
      model.teleport(x, z);
      frame(1 / 30);
    },
    goIn(n: number) {
      model.enterRoom(model.entrances[n]);
      frame(1 / 30);
    },
    at(x: number, z: number) {
      Object.assign(model.hero, { x, z });
      frame(1 / 30);
    },
    quality(quality: Quality, brightness = 1) {
      setGraphics({ quality, brightness });
      frame(1 / 30);
    },
    // A frame's draws and triangles, and the average time of `frames` renders (ms).
    cost(frames = 20) {
      view.render();
      const stats = view.getRenderStats();
      const gl = (view.canvas.getContext('webgl2') ?? view.canvas.getContext('webgl')) as WebGL2RenderingContext;
      const pixel = new Uint8Array(4);
      const start = performance.now();
      for (let i = 0; i < frames; i++) {
        view.render();
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); // (waits for the frame to be drawn)
      }
      return { ...stats, ms: +((performance.now() - start) / frames).toFixed(1) };
    },
    // A tip's card, as the game shows it (`id`: TIPS'), and the pause menu open over the frame.
    tip(id: string) {
      const tip = TIPS.find((t) => t.id === id)!;
      (this.card ??= createTipCard()).show({ title: tip.title, text: tip.text(label, model) });
    },
    card: null as ReturnType<typeof createTipCard> | null,
    pause() {
      const hero = model.hero;
      createPauseMenu({ setPaused() {}, redraw: () => view.render(), mainMenu() {}, walls: { full: () => model.fullWalls, toggle() {} }, hero: () => ({ name: hero.name, level: hero.level, day: 1, seed, look: hero.look, equipment: hero.equipment }) }).open();
    },
    shot: () => (view.render(), view.canvas.toDataURL('image/png')),
  };
  (window as unknown as { p: typeof p }).p = p;
  document.title = 'ready';
} catch (e) {
  document.title = `error: ${(e as Error).message}`;
  throw e;
}
