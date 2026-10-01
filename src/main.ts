import { doorAt, innerWalls, stairsInReach } from './model/interiors/upstairs';
import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { randomLook } from './model/human/humanoid';
import { randomName } from './model/npcs/npcs';
import { loadGame, startAutoSave } from './controller/storage/saveGame';
import { createFpsCounter } from './view/hud/fpsCounter';
import { createHeroHud } from './view/hud/heroHud';
import { createBlessingHud } from './view/hud/blessingHud';
import { createPlaceBanner } from './view/hud/placeBanner';
import { createCryptBar } from './view/hud/cryptBar';
import { cryptAt } from './model/crypts/crypts';
import { atWayOut } from './model/interiors/indoors';
import { createClockHud } from './view/hud/clockHud';
import { createTargetHud } from './view/hud/targetHud';
import { createLootPrompt, lootTarget, type PromptTarget } from './view/hud/lootPrompt';
import { coinText, createFloatingText } from './view/hud/floatingText';
import { createInventoryPanel } from './controller/hero/inventoryPanel';
import { createShopPanel } from './controller/trade/shopPanel';
import { createLevelUpPanel } from './controller/hero/levelUpPanel';
import { createSmithPanel } from './controller/trade/smithPanel';
import { talkPrompt, talkingTo } from './model/npcs/talk';
import { bouncerSpeaks } from './model/inn/bouncer';
import { createBar, orderLabel } from './controller/trade/barOrder';
import { createDrinkTimer } from './view/hud/drinkTimer';
import { createJournal } from './controller/quests/journal';
import { createQuestBoardPanel } from './controller/quests/questBoardPanel';
import { createQuestTracker } from './view/hud/questTracker';
import { noticeBoards } from './model/quests/noticeBoards';
import { createHeroSheet } from './controller/hero/heroSheet';
import { createPauseMenu } from './controller/pauseMenu';
import { createToolbar } from './view/hud/toolbar';
import { bagToolIcon, heroBustIcon, journalIcon, levelUpIcon, pauseIcon } from './view/ui/itemIcons';
import { loadingScreen, nextPaint } from './view/hud/loadingScreen';
import { readRenderOptions } from './view/render/renderOptions';
import { counted } from './view/ui/words';
import { keepWorld, loadWorld } from './controller/storage/worldCache';
import { generateWorld } from './model/worldgen/world';
import { DEFAULT_MAP_SIZE } from './model/map/grid';

// Boots in steps, letting the browser repaint the loading screen between
// each, so the page appears instantly and shows progress instead of
// freezing on a blank tab while the world is built.
async function boot(): Promise<void> {
  const loading = loadingScreen();
  const canvas = document.getElementById('app') as HTMLCanvasElement;
  const seed = resolveSeed();
  (document.getElementById('seed-label') as HTMLDivElement).textContent = `seed: ${seed}`;

  // The world as its seed made it: kept from an earlier visit (worldCache.ts), else made now and kept for next time.
  loading.show(0, 'Unrolling the map');
  await nextPaint();
  const kept = await loadWorld(seed, DEFAULT_MAP_SIZE);
  if (!kept) {
    loading.show(0, 'Shaping the land');
    await nextPaint();
  }
  const world = kept ?? generateWorld(seed, DEFAULT_MAP_SIZE);
  const model = new GameModel(seed, DEFAULT_MAP_SIZE, world);
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
  const placeBanner = createPlaceBanner();
  const updateCryptBar = createCryptBar();
  const updateTarget = createTargetHud(hudTop);
  const lootPrompt = createLootPrompt();
  const orderPrompt = createLootPrompt('F'); // sat at the bar: an ale, over the hero's head
  const piePrompt = createLootPrompt('G', false, orderPrompt); // and a meat pie, stacked over it
  const drinkTimer = createDrinkTimer();
  const bar = createBar(
    model,
    {
      heroDrinks: (seconds, what) => view.heroDrinks(seconds, what),
      heroStopsDrinking: () => view.heroStopsDrinking(),
      speak: (barmaid, text) => floatingText.speak(barmaid, 1.35, text), // over her, following her
      countdown: (drinking, hero) => drinkTimer(drinking, drinking ? view.toScreen(hero.x, hero.y + 1.15, hero.z) : null),
    },
  );
  const floatingText = createFloatingText();
  const ENEMY_TEXT_HEIGHT = { wolf: 0.35, bandit: 0.4, boar: 0.3, skeleton: 0.4, skeletonArcher: 0.4, draugr: 0.45, cryptLord: 0.6, ghost: 0.45 }; // about two thirds of the way up them
  let lastFrame = performance.now();
  let textSpace = model.inside?.entrance; // where floating text's places are (the world, or a room)
  const bag = createInventoryPanel(model);
  const shop = createShopPanel(model, { bag });
  const forge = createSmithPanel(model, { bag });
  const board = createQuestBoardPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const updateQuests = createQuestTracker(model);
  const journal = createJournal(model);
  const levelUp = createLevelUpPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const sheet = createHeroSheet(model, { levelUp: () => levelUp.menu.open() });
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
    { label: 'Level up', key: 'P', icon: levelUpIcon, isOpen: () => levelUp.menu.isOpen, toggle: () => levelUp.menu.toggle(), marked: () => model.hero.statPoints > 0 },
    { label: 'Pause', key: 'Esc', icon: pauseIcon, isOpen: () => pause.isOpen, toggle: () => pause.toggle() },
  ]);
  // What E does right now: pick up loot in reach, else sit or lie down (or get up), else go through a door.
  const DOOR_NAMES = { house: 'Enter house', inn: 'Enter the inn', smithy: 'Enter the smithy' } as const;
  const promptTarget = (): PromptTarget | null => {
    const loot = model.lootInReach;
    if (loot) return lootTarget(loot);
    const { hero } = model;
    const chest = model.crypt?.chestInReach(hero) && model.crypt.chest;
    if (chest) return { label: 'Open the chest', x: chest.x, y: 0.8, z: chest.z };
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
    if (talk && !(model.inside && model.doorInReach)) return talk; // (at the way out: out first, not a word with the bouncer by it)
    const read = model.boardInReach;
    if (read !== null) {
      const spot = noticeBoards(model)[read];
      return { label: 'Read the notice board', x: spot.x, y: hero.y + 1.05, z: spot.z };
    }
    const well = model.wellInReach;
    if (well !== null) return { label: 'Toss a silver coin', x: model.villages[well].x, y: hero.y + 0.8, z: model.villages[well].z };
    const hallDoor = model.inside?.below ? doorAt(model.inside, hero) : null;
    if (hallDoor) return { label: hallDoor.open ? 'Close door' : 'Open door', x: hero.x, y: hero.y + 1.05, z: hero.z }; // (a locked one too: tried, it's found locked)
    if (model.inside && stairsInReach(model.inside, hero)) return { label: model.inside.below ? 'Go downstairs' : 'Go upstairs', x: hero.x, y: hero.y + 1.05, z: hero.z };
    const door = model.doorInReach;
    if (!door) return null;
    if (model.inside) return { label: atWayOut(model.inside, hero) ? 'Take the way out' : model.inside.entrance.type === 'crypt' ? 'Climb out' : 'Leave', x: hero.x, y: 0.75, z: hero.z };
    const label = door.type === 'crypt' ? `Enter the crypt (level ${cryptAt(door)?.level ?? 1}) · ${Math.round(model.clearedShare(door) * 100)}% cleared` : DOOR_NAMES[door.type];
    return { label, x: door.x, y: hero.y + 0.75, z: door.z };
  };
  const onFrame = () => {
    countFrame();
    updateHud();
    updateBlessing();
    updateClock(model.minutes);
    updateTarget(model.focused, model.hero.level);
    const crypt = model.crypt && model.inside && cryptAt(model.inside.entrance);
    updateCryptBar(crypt ? { name: crypt.name, share: model.clearedShare(model.inside!.entrance) } : null); // (down in one: how much is cleared)
    bag.update();
    shop.update(); // (walked away from the keeper: the shop shuts)
    forge.update();
    journal.update();
    sheet.update();
    updateToolbar();
    const prompt = promptTarget();
    view.prompted = prompt?.npc ?? null; // (their name gives way to it)
    lootPrompt.update(prompt, (x, y, z) => view.toScreen(x, y, z));
    // Sat on a stool at the bar: F orders an ale and G a meat pie, their prompts over the hero's head.
    // Waiting behind others: the queue shown instead; gone while she's fetching it, or it's being had.
    const order = bar.canOrder ? orderLabel(model, 'ale') : bar.ahead > 0 ? { label: `Ordered · ${bar.ahead} ahead`, soldOut: true } : null;
    const pie = bar.canOrder ? orderLabel(model, 'pie') : null;
    bar.update();
    const { hero } = model;
    orderPrompt.update(order ? { label: order.label, muted: order.soldOut, x: hero.x, y: hero.y + 1.05, z: hero.z } : null, (x, y, z) => view.toScreen(x, y, z));
    piePrompt.update(pie ? { label: pie.label, muted: pie.soldOut, x: hero.x, y: hero.y + 1.05, z: hero.z } : null, (x, y, z) => view.toScreen(x, y, z)); // (at the ale's, stacked over it)
    updateQuests((x, y, z) => view.toScreen(x, y, z));
    const now = performance.now();
    if (model.inside?.entrance !== textSpace) {
      textSpace = model.inside?.entrance;
      floatingText.clear(); // a room's places aren't the world's
    }
    floatingText.update((x, y, z) => view.toScreen(x, y, z), (now - lastFrame) / 1000);
    lastFrame = now;
  };
  const controller = new GameController(model, view, { uncapped: options.uncapped, onFrame, onPickUp: (item) => lootPrompt.pickedUp(item), onTalk: (npc) => (npc.role === 'smith' ? forge.open(npc) : npc.role === 'bouncer' ? bouncerSpeaks(npc) : !bar.busy && shop.open(npc)), onRead: (at) => board.open(at), onOrder: (barmaid, what) => bar.order(barmaid, what), onEvent: (event) => {
      // Floating text, as in FarHold: coins looted in gold over the hero's
      // head; a blow's damage in white over the enemy, or in red over the
      // hero ("-3"); a quest's progress in amber (turquoise once done). Over their heads, higher indoors where the hero's drawn bigger.
      const { hero } = model;
      const head = model.inside ? 0.95 : 0.6;
      if (event.kind === 'coins') floatingText.spawn({ x: hero.x, y: hero.y + head, z: hero.z }, coinText(event.amount), '#ffd35a');
      else if (event.kind === 'quest') floatingText.spawn({ x: event.x, y: event.y + head + 0.2, z: event.z }, [event.done ? `${event.text} ✓` : event.text], event.done ? '#5ae0d8' : '#ffc94a');
      else if (event.kind === 'arrive') placeBanner(event.name, `Level ${event.level}`);
      else if (event.kind === 'locked') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ["It's locked"], '#f8ecd4');
      else if (event.kind === 'chilled') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ['Chilled'], '#9fe4ff');
      else if (event.kind === 'rises') placeBanner(`${event.name} rises`, 'From the great tomb');
      else if (event.kind === 'cleared') placeBanner('Crypt cleared', `${event.name.charAt(0).toUpperCase() + event.name.slice(1)}${event.point ? ' · +1 point to spend (P)' : ''}`);
      else if (event.kind === 'point') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.25, z: hero.z }, ['+1 point to spend (P)'], '#5ae0d8');
      else if (event.kind === 'blessing') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [`${event.name}!`], '#ffd35a');
      else if (event.kind === 'say') {
        if ((model.inside?.entrance ?? null) === event.where) floatingText.speak(event.speaker, 1.35, event.text); // said in the hero's room: a bubble over them
      } else if (event.kind === 'poor') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [event.text], '#e8805a');
      else if (event.kind === 'levelUp') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.25, z: hero.z }, [`Level ${event.level}! · ${counted(event.points, 'point')} to spend (P)`], '#5ae0d8');
      else if (event.kind === 'dodge') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, ['Dodge'], '#f8ecd4');
      else if (event.crit) floatingText.spawn({ x: event.x, y: event.y + ENEMY_TEXT_HEIGHT[event.on as keyof typeof ENEMY_TEXT_HEIGHT] + 0.1, z: event.z }, [`${event.amount}!`], '#ffc94a'); // a critical blow, in amber
      else if (event.on === 'hero') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, [`-${event.amount}`], '#ff6a5a');
      else floatingText.spawn({ x: event.x + (Math.random() - 0.5) * 0.2, y: event.y + ENEMY_TEXT_HEIGHT[event.on], z: event.z }, [`${event.amount}`], '#ffffff');
    },
  });
  controller.start();
  if (!kept) window.setTimeout(() => void keepWorld(seed, DEFAULT_MAP_SIZE, world), 2000); // (once the game's under way)
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
