import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { randomLook } from './model/human/humanoid';
import { randomName } from './model/npcs/npcs';
import { loadGame, startAutoSave } from './controller/saveGame';
import { createFpsCounter } from './view/hud/fpsCounter';
import { createHeroHud } from './view/hud/heroHud';
import { createTargetHud } from './view/hud/targetHud';
import { createLootPrompt, lootTarget, type PromptTarget } from './view/hud/lootPrompt';
import { coinText, createFloatingText } from './view/hud/floatingText';
import { createInventoryPanel } from './controller/inventoryPanel';
import { createShopPanel } from './controller/shopPanel';
import { createQuestBoardPanel } from './controller/questBoardPanel';
import { createQuestTracker } from './view/hud/questTracker';
import { noticeBoards } from './model/quests/noticeBoards';
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
  // This world's saved game, if it was played before; else a new hero: any look, a name to match.
  if (!loadGame(model)) {
    model.hero.look = randomLook();
    model.hero.name = randomName(model.hero.look.build);
  }
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
  const floatingText = createFloatingText();
  const ENEMY_TEXT_HEIGHT = { wolf: 0.35, bandit: 0.4 }; // about two thirds of the way up them
  let lastFrame = performance.now();
  let textSpace = model.inside?.entrance; // where floating text's places are (the world, or a room)
  const bag = createInventoryPanel(model);
  const shop = createShopPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const board = createQuestBoardPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const updateQuests = createQuestTracker(model);
  const sheet = createHeroSheet(model);
  const pause = createPauseMenu({
    setPaused: (paused) => (controller.paused = paused),
    redraw: () => view.render(),
    newGame: () => {
      autoSave.forget();
      window.location.reload();
    },
  });
  const updateToolbar = createToolbar([
    { label: 'Hero', key: 'C', icon: heroBustIcon(model.hero.look), isOpen: () => sheet.menu.isOpen, toggle: () => sheet.menu.toggle() },
    { label: 'Bag', key: 'B', icon: bagToolIcon, isOpen: () => bag.menu.isOpen, toggle: () => bag.menu.toggle() },
    { label: 'Pause', key: 'Esc', icon: pauseIcon, isOpen: () => pause.isOpen, toggle: () => pause.toggle() },
  ]);
  // What E does right now: pick up loot in reach, else sit or lie down (or get up), else go through a door.
  const DOOR_NAMES = { house: 'Enter house', inn: 'Enter the inn', smithy: 'Enter the smithy' } as const;
  const promptTarget = (): PromptTarget | null => {
    const loot = model.lootInReach;
    if (loot) return lootTarget(loot);
    const { hero } = model;
    const seated = model.inside?.seated;
    const barmaid = model.barmaidInReach;
    const talk = barmaid && { label: `Talk to ${barmaid.name}`, x: barmaid.x, y: 1.1, z: barmaid.z };
    if (seated) return talk && seated.seat.piece.kind === 'barStool' ? talk : { label: seated.seat.lying ? 'Get up' : 'Stand up', x: hero.x, y: hero.y + 0.6, z: hero.z };
    const seat = model.seatInReach;
    if (seat) {
      const { piece } = seat;
      return { label: seat.lying ? 'Lie down' : 'Sit', x: piece.x + (piece.w - 1) / 2, y: seat.y + 0.5, z: piece.z + (piece.d - 1) / 2 };
    }
    if (talk) return talk;
    const read = model.boardInReach;
    if (read !== null) {
      const spot = noticeBoards(model)[read];
      return { label: 'Read the notice board', x: spot.x, y: hero.y + 1.05, z: spot.z };
    }
    const door = model.doorInReach;
    if (!door) return null;
    return model.inside ? { label: 'Leave', x: hero.x, y: 0.75, z: hero.z } : { label: DOOR_NAMES[door.type], x: door.x, y: hero.y + 0.75, z: door.z };
  };
  const onFrame = () => {
    countFrame();
    updateHud();
    updateTarget(model.focused, model.hero.level);
    bag.update();
    sheet.update();
    updateToolbar();
    lootPrompt.update(promptTarget(), (x, y, z) => view.toScreen(x, y, z));
    updateQuests((x, y, z) => view.toScreen(x, y, z));
    const now = performance.now();
    if (model.inside?.entrance !== textSpace) {
      textSpace = model.inside?.entrance;
      floatingText.clear(); // a room's places aren't the world's
    }
    floatingText.update((x, y, z) => view.toScreen(x, y, z), (now - lastFrame) / 1000);
    lastFrame = now;
  };
  const controller = new GameController(model, view, { uncapped: options.uncapped, onFrame, onPickUp: (item) => lootPrompt.pickedUp(item), onTalk: (barmaid) => shop.open(barmaid), onRead: (at) => board.open(at), onEvent: (event) => {
      // Floating text, as in FarHold: coins looted in gold over the hero's
      // head; a blow's damage in white over the enemy, or in red over the
      // hero ("-3"); a quest's progress in amber (turquoise once done). Over their heads, higher indoors where the hero's drawn bigger.
      const { hero } = model;
      const head = model.inside ? 0.95 : 0.6;
      if (event.kind === 'coins') floatingText.spawn({ x: hero.x, y: hero.y + head, z: hero.z }, coinText(event.amount), '#ffd35a');
      else if (event.kind === 'quest') floatingText.spawn({ x: event.x, y: event.y + head + 0.2, z: event.z }, [event.done ? `${event.text} ✓` : event.text], event.done ? '#5ae0d8' : '#ffc94a');
      else if (event.on === 'hero') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, [`-${event.amount}`], '#ff6a5a');
      else floatingText.spawn({ x: event.x + (Math.random() - 0.5) * 0.2, y: event.y + ENEMY_TEXT_HEIGHT[event.on], z: event.z }, [`${event.amount}`], '#ffffff');
    },
  });
  controller.start();
  const autoSave = startAutoSave(model);
  loading.show(1, 'Welcome');
  // Fade out once the first frame is on screen.
  await nextPaint();
  loading.hide();

  // Dev-only tools, loaded on demand so production builds don't include them.
  if (import.meta.env.DEV) {
    void import('./controller/cheats/cheatPanel').then(({ createCheatPanel }) => createCheatPanel(model));
  }
}

void boot();
