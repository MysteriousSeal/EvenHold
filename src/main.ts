import { doorAt, innerWalls, stairsInReach } from './model/interiors/upstairs';
import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { randomLook } from './model/human/humanoid';
import { randomName } from './model/npcs/npcs';
import { loadGame, startAutoSave } from './controller/saveGame';
import { createFpsCounter } from './view/hud/fpsCounter';
import { createHeroHud } from './view/hud/heroHud';
import { createBlessingHud } from './view/hud/blessingHud';
import { createClockHud } from './view/hud/clockHud';
import { createTargetHud } from './view/hud/targetHud';
import { createLootPrompt, lootTarget, type PromptTarget } from './view/hud/lootPrompt';
import { coinText, createFloatingText } from './view/hud/floatingText';
import { createInventoryPanel } from './controller/inventoryPanel';
import { createShopPanel } from './controller/shopPanel';
import { createSmithPanel } from './controller/smithPanel';
import { talkPrompt, talkingTo } from './model/npcs/talk';
import { createBar, orderLabel } from './controller/barOrder';
import { createDrinkTimer } from './view/hud/drinkTimer';
import { createJournal } from './controller/journal';
import { createQuestBoardPanel } from './controller/questBoardPanel';
import { createQuestTracker } from './view/hud/questTracker';
import { noticeBoards } from './model/quests/noticeBoards';
import { createHeroSheet } from './controller/heroSheet';
import { createPauseMenu } from './controller/pauseMenu';
import { createToolbar } from './view/hud/toolbar';
import { bagToolIcon, heroBustIcon, journalIcon, pauseIcon } from './view/ui/itemIcons';
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

  const countFrame = createFpsCounter(document.getElementById('fps-label') as HTMLDivElement, () => view.getRenderStats(), model.hero);
  const hudTop = document.createElement('div');
  hudTop.className = 'hud-top';
  document.body.append(hudTop);
  const updateHud = createHeroHud(model.hero, hudTop);
  const updateBlessing = createBlessingHud(model.hero);
  const updateClock = createClockHud();
  const updateTarget = createTargetHud(hudTop);
  const lootPrompt = createLootPrompt();
  const orderPrompt = createLootPrompt('F'); // sat at the bar: over the hero's head
  const drinkTimer = createDrinkTimer();
  const bar = createBar(
    model,
    {
      heroDrinks: (seconds) => view.heroDrinks(seconds),
      heroStopsDrinking: () => view.heroStopsDrinking(),
      speak: (barmaid, text) => floatingText.speak(barmaid, 1.35, text), // over her, following her
      countdown: (drinking, hero) => drinkTimer(drinking, drinking ? view.toScreen(hero.x, hero.y + 1.15, hero.z) : null),
    },
  );
  const floatingText = createFloatingText();
  const ENEMY_TEXT_HEIGHT = { wolf: 0.35, bandit: 0.4, boar: 0.3 }; // about two thirds of the way up them
  let lastFrame = performance.now();
  let textSpace = model.inside?.entrance; // where floating text's places are (the world, or a room)
  const bag = createInventoryPanel(model);
  const shop = createShopPanel(model, { bag });
  const forge = createSmithPanel(model, { bag });
  const board = createQuestBoardPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const updateQuests = createQuestTracker(model);
  const journal = createJournal(model);
  const sheet = createHeroSheet(model);
  const pause = createPauseMenu({
    setPaused: (paused) => (controller.paused = paused),
    redraw: () => {
      view.update(0); // (the room rebuilt, walls changed) while the game stands still
      view.render();
    },
    newGame: () => {
      autoSave.forget();
      window.location.reload();
    },
    walls: {
      full: () => model.fullWalls,
      toggle: () => {
        model.fullWalls = !model.fullWalls;
        if (model.inside) innerWalls(model.inside.furniture, model.fullWalls);
      },
    },
  });
  const updateToolbar = createToolbar([
    { label: 'Hero', key: 'C', icon: heroBustIcon(model.hero.look), isOpen: () => sheet.menu.isOpen, toggle: () => sheet.menu.toggle() },
    { label: 'Bag', key: 'B', icon: bagToolIcon, isOpen: () => bag.menu.isOpen, toggle: () => bag.menu.toggle() },
    { label: 'Journal', key: 'L', icon: journalIcon, isOpen: () => journal.menu.isOpen, toggle: () => journal.menu.toggle() },
    { label: 'Pause', key: 'Esc', icon: pauseIcon, isOpen: () => pause.isOpen, toggle: () => pause.toggle() },
  ]);
  // What E does right now: pick up loot in reach, else sit or lie down (or get up), else go through a door.
  const DOOR_NAMES = { house: 'Enter house', inn: 'Enter the inn', smithy: 'Enter the smithy' } as const;
  const promptTarget = (): PromptTarget | null => {
    const loot = model.lootInReach;
    if (loot) return lootTarget(loot);
    const { hero } = model;
    const seated = model.seated;
    const talker = talkingTo(model.npcs, model.inside, hero); // the barmaid, the smith
    const talk = talker && { label: talkPrompt(talker), x: talker.x, y: 1.1, z: talker.z, npc: talker };
    if (seated && seated.seat.piece.kind === 'barStool' && bar.busy) return null; // she's seeing to the order: no talking, and E waits
    if (seated) return talk && seated.seat.piece.kind === 'barStool' ? talk : { label: seated.seat.lying ? 'Get up' : 'Stand up', x: hero.x, y: hero.y + 0.6, z: hero.z };
    const seat = model.seatInReach;
    if (seat) {
      const { piece } = seat;
      return { label: seat.lying ? 'Lie down' : 'Sit', x: piece.x + (piece.w - 1) / 2, y: seat.y + (model.inside ? 0.5 : 0.3), z: piece.z + (piece.d - 1) / 2 };
    }
    if (talk) return talk;
    const read = model.boardInReach;
    if (read !== null) {
      const spot = noticeBoards(model)[read];
      return { label: 'Read the notice board', x: spot.x, y: hero.y + 1.05, z: spot.z };
    }
    const well = model.wellInReach;
    if (well !== null) return { label: 'Toss a silver coin', x: model.villages[well].x, y: hero.y + 0.8, z: model.villages[well].z };
    const hallDoor = model.inside?.below ? doorAt(model.inside, hero) : null;
    if (hallDoor) return { label: hallDoor.open ? 'Close door' : 'Open door', x: hero.x, y: hero.y + 1.05, z: hero.z };
    if (model.inside && stairsInReach(model.inside, hero)) return { label: model.inside.below ? 'Go downstairs' : 'Go upstairs', x: hero.x, y: hero.y + 1.05, z: hero.z };
    const door = model.doorInReach;
    if (!door) return null;
    return model.inside ? { label: 'Leave', x: hero.x, y: 0.75, z: hero.z } : { label: DOOR_NAMES[door.type], x: door.x, y: hero.y + 0.75, z: door.z };
  };
  const onFrame = () => {
    countFrame();
    updateHud();
    updateBlessing();
    updateClock(model.minutes);
    updateTarget(model.focused, model.hero.level);
    bag.update();
    shop.update(); // (walked away from the keeper: the shop shuts)
    forge.update();
    journal.update();
    sheet.update();
    updateToolbar();
    const prompt = promptTarget();
    view.prompted = prompt?.npc ?? null; // (their name gives way to it)
    lootPrompt.update(prompt, (x, y, z) => view.toScreen(x, y, z));
    // Sat on a stool at the bar: F orders an ale, the prompt over the hero's head.
    // Waiting behind others: the queue shown instead; gone while she's fetching it, or it's being drunk.
    const order = bar.canOrder ? orderLabel(model) : bar.ahead > 0 ? { label: `Ordered · ${bar.ahead} ahead`, soldOut: true } : null;
    bar.update();
    const { hero } = model;
    orderPrompt.update(order ? { label: order.label, muted: order.soldOut, x: hero.x, y: hero.y + 1.05, z: hero.z } : null, (x, y, z) => view.toScreen(x, y, z));
    updateQuests((x, y, z) => view.toScreen(x, y, z));
    const now = performance.now();
    if (model.inside?.entrance !== textSpace) {
      textSpace = model.inside?.entrance;
      floatingText.clear(); // a room's places aren't the world's
    }
    floatingText.update((x, y, z) => view.toScreen(x, y, z), (now - lastFrame) / 1000);
    lastFrame = now;
  };
  const controller = new GameController(model, view, { uncapped: options.uncapped, onFrame, onPickUp: (item) => lootPrompt.pickedUp(item), onTalk: (npc) => (npc.role === 'smith' ? forge.open(npc) : !bar.busy && shop.open(npc)), onRead: (at) => board.open(at), onOrder: (barmaid) => bar.order(barmaid), onEvent: (event) => {
      // Floating text, as in FarHold: coins looted in gold over the hero's
      // head; a blow's damage in white over the enemy, or in red over the
      // hero ("-3"); a quest's progress in amber (turquoise once done). Over their heads, higher indoors where the hero's drawn bigger.
      const { hero } = model;
      const head = model.inside ? 0.95 : 0.6;
      if (event.kind === 'coins') floatingText.spawn({ x: hero.x, y: hero.y + head, z: hero.z }, coinText(event.amount), '#ffd35a');
      else if (event.kind === 'quest') floatingText.spawn({ x: event.x, y: event.y + head + 0.2, z: event.z }, [event.done ? `${event.text} ✓` : event.text], event.done ? '#5ae0d8' : '#ffc94a');
      else if (event.kind === 'blessing') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [`${event.name}!`], '#ffd35a');
      else if (event.kind === 'say') {
        if ((model.inside?.entrance ?? null) === event.where) floatingText.speak(event.speaker, 1.35, event.text); // said in the hero's room: a bubble over them
      } else if (event.kind === 'poor') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [event.text], '#e8805a');
      else if (event.kind === 'dodge') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, ['Dodge'], '#f8ecd4');
      else if (event.crit) floatingText.spawn({ x: event.x, y: event.y + ENEMY_TEXT_HEIGHT[event.on as keyof typeof ENEMY_TEXT_HEIGHT] + 0.1, z: event.z }, [`${event.amount}!`], '#ffc94a'); // a critical blow, in amber
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
    void import('./controller/cheats/cheatPanel').then(({ createCheatPanel }) => createCheatPanel(model, { get scale() { return controller.timeScale; }, set scale(n) { controller.timeScale = n; } }));
  }
}

void boot();
