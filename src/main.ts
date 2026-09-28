import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { createFpsCounter } from './view/hud/fpsCounter';
import { createHeroHud } from './view/hud/heroHud';
import { createTargetHud } from './view/hud/targetHud';
import { createLootPrompt } from './view/hud/lootPrompt';
import { createInventoryPanel } from './controller/inventoryPanel';
import { createHeroSheet } from './controller/heroSheet';
import { createPauseMenu } from './controller/pauseMenu';
import { createToolbar } from './view/hud/toolbar';
import { bagToolIcon, heroBustIcon, pauseIcon } from './view/ui/itemIcons';
import { loadingScreen, nextPaint } from './view/hud/loadingScreen';
import { readRenderOptions } from './view/render/renderOptions';

// Boots in steps, letting the browser repaint the loading screen between
// each, so the page appears instantly and shows progress instead of
// freezing on a blank tab while the world is built.
async function boot(): Promise<void> {
  const loading = loadingScreen();
  const canvas = document.getElementById('app') as HTMLCanvasElement;
  const seed = resolveSeed();
  (document.getElementById('seed-label') as HTMLDivElement).textContent = `seed: ${seed}`;

  loading.show(0, 'Shaping the land');
  await nextPaint();
  const model = new GameModel(seed);
  const options = readRenderOptions();
  const view = new GameView(canvas, model, options);

  const steps = view.buildSteps();
  const total = steps.length + 2; // + world generation, + lighting and shaders
  for (const [i, step] of steps.entries()) {
    loading.show((i + 1) / total, step.label);
    await nextPaint();
    step.run();
  }
  loading.show((total - 1) / total, 'Warming the hearths');
  await nextPaint();
  await view.finish();

  const countFrame = createFpsCounter(document.getElementById('fps-label') as HTMLDivElement, () => view.getRenderStats());
  const hudTop = document.createElement('div');
  hudTop.className = 'hud-top';
  document.body.append(hudTop);
  const updateHud = createHeroHud(model.hero, hudTop);
  const updateTarget = createTargetHud(hudTop);
  const lootPrompt = createLootPrompt();
  const bag = createInventoryPanel(model);
  const sheet = createHeroSheet(model);
  const pause = createPauseMenu({ setPaused: (paused) => (controller.paused = paused) });
  const updateToolbar = createToolbar([
    { label: 'Hero', key: 'C', icon: heroBustIcon(model.hero.look), isOpen: () => sheet.menu.isOpen, toggle: () => sheet.menu.toggle() },
    { label: 'Bag', key: 'B', icon: bagToolIcon, isOpen: () => bag.menu.isOpen, toggle: () => bag.menu.toggle() },
    { label: 'Pause', key: 'Esc', icon: pauseIcon, isOpen: () => pause.isOpen, toggle: () => pause.toggle() },
  ]);
  const onFrame = () => {
    countFrame();
    updateHud();
    updateTarget(model.focused, model.hero.level);
    bag.update();
    sheet.update();
    updateToolbar();
    lootPrompt.update(model.lootInReach, (x, y, z) => view.toScreen(x, y, z));
  };
  const controller = new GameController(model, view, { uncapped: options.uncapped, onFrame, onPickUp: (item) => lootPrompt.pickedUp(item) });
  controller.start();
  loading.show(1, 'Welcome');
  // Fade out once the first frame is on screen.
  await nextPaint();
  loading.hide();

  // Dev-only tools, loaded on demand so production builds don't include them.
  if (import.meta.env.DEV) {
    void import('./controller/cheats/cheatPanel').then(({ createCheatPanel }) =>
      createCheatPanel(model, { setPaused: (paused) => (controller.paused = paused) }),
    );
  }
}

void boot();
