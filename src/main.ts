import { doorAt, innerWalls, stairsInReach } from './model/interiors/upstairs';
import { KIND_LOOKS } from './view/meshes/enemy/enemyKinds';
import { dangerInk } from './view/meshes/enemy/enemyParts';
import { chestInReach } from './model/loot/chests';
import { isHerbalistHome } from './model/herbalist/herbalistHomes';
import { kindOf, nameOf, qualityOf } from './model/hero/bag';
import { CLASSIC_MOST, GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { keepSessionSeed, sessionSeed, takeSeedFromUrl } from './util/seed';
import { showMainMenu } from './controller/title/mainMenu';
import { randomLook } from './model/human/humanoid';
import { randomName } from './model/npcs/npcs';
import { forgetWorld, loadGame, savedSize, savedWorlds, startAutoSave } from './controller/storage/saveGame';
import { createFpsCounter } from './view/hud/fpsCounter';
import { createHeroHud } from './view/hud/heroHud';
import { createBlessingHud } from './view/hud/blessingHud';
import { createPlaceBanner } from './view/hud/placeBanner';
import { createPlaceBar } from './view/hud/placeBar';
import { dungeonAt } from './model/dungeons/dungeons';
import { goesUnder } from './model/dungeons/dungeonTypes';
import { TEARS_AT } from './model/caves/caveFoes';
import { atWayOut } from './model/interiors/indoors';
import { travellerInReach, travellerPrompt, travellerSays } from './model/travellers/travellerTalk';
import { say } from './model/npcs/speech';
import { createPedlarPanel } from './controller/trade/pedlarPanel';
import { createHerbalistPanel } from './controller/trade/herbalistPanel';
import { WORD_HOLD } from './model/travellers/travellers';
import { roomAction, roomActionLabel, sleepTillMorning } from './model/inn/roomLetting';
import { createSleepFade } from './view/hud/sleepFade';
import { createClockHud } from './view/hud/clockHud';
import { createTargetHud } from './view/hud/targetHud';
import { QUALITY_INK, createLootPrompt, lootTarget, type PromptTarget } from './view/hud/lootPrompt';
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
import { createSkillsPanel } from './controller/skills/skillsPanel';
import { skillsIcon } from './view/ui/skillIcons';
import { createQuestBoardPanel } from './controller/quests/questBoardPanel';
import { createJobPanel } from './controller/jobs/jobPanel';
import { workPrompt } from './controller/jobs/workPrompt';
import { shiftStatus } from './controller/jobs/shiftStatus';
import { BarShift } from './model/jobs/barShift';
import { PourMeter } from './view/hud/pourMeter';
import { createQuestTracker } from './view/hud/questTracker';
import { boardSpot } from './model/quests/noticeBoards';
import { createHeroSheet } from './controller/hero/heroSheet';
import { createPauseMenu } from './controller/pauseMenu';
import { clockAt } from './model/clock';
import { createToolbar } from './view/hud/toolbar';
import { createActionBar } from './view/hud/actionBar';
import { clearAction, swapActions, useAction } from './model/hero/actionBar';
import { bagToolIcon, heroBustIcon, journalIcon, levelUpIcon, pauseIcon } from './view/ui/itemIcons';
import { loadingScreen, nextPaint } from './view/hud/loadingScreen';
import { readRenderOptions } from './view/render/renderOptions';
import { counted } from './view/ui/words';
import { keepWorld, loadWorld } from './controller/storage/worldCache';
import { generateWorld } from './model/worldgen/world';
import { WorkerSource } from './controller/world/workerSource';
import { STREAMED_SIZE } from './model/worldgen/regions';

// Boots in steps, letting the browser repaint the loading screen between
// each, so the page appears instantly and shows progress instead of
// freezing on a blank tab while the world is built.
async function boot(): Promise<void> {
  const loading = loadingScreen();
  const canvas = document.getElementById('app') as HTMLCanvasElement;
  // The world to play: a shared link's (its seed taken out of the address), else this tab's (a reload), else the one
  // chosen on the main menu; kept for the tab.
  const given = takeSeedFromUrl() ?? sessionSeed();
  const choice = given !== null ? { seed: given } : await showMainMenu({ worlds: savedWorlds, forget: forgetWorld });
  const seed = choice.seed;
  keepSessionSeed(seed);
  (document.getElementById('version-label') as HTMLDivElement).textContent = `EvenHold v${__GAME_VERSION__}`; // (package.json's, with the seed)
  const positionLabel = document.getElementById('position-label') as HTMLDivElement;
  (document.getElementById('seed-label') as HTMLDivElement).textContent = `seed: ${seed}`;

  // The world as its seed made it. A game goes on in the world it began in: a classic world (2048 a side, made whole:
  // kept from an earlier visit, worldCache.ts, else made now and kept for next time); a new game's a streamed one (16384
  // a side, made a region at a time round the hero, off the game's thread: controller/world/workerSource.ts).
  const size = savedSize(seed) ?? STREAMED_SIZE;
  const streamed = Math.max(size.width, size.depth) > CLASSIC_MOST;
  loading.show(0, streamed ? 'Shaping the land round you' : 'Unrolling the map');
  await nextPaint();
  const kept = streamed ? null : await loadWorld(seed, size);
  if (!kept && !streamed) {
    loading.show(0, 'Shaping the land');
    await nextPaint();
  }
  const world = streamed ? undefined : (kept ?? generateWorld(seed, size));
  const model = new GameModel(seed, size, world, streamed ? new WorkerSource(seed, size) : undefined);
  // This world's saved game, if it was played before; else a new hero: the one made on the main menu, or any look
  // with a name to match.
  if (!loadGame(model)) {
    model.hero.look = choice.hero?.look ?? randomLook();
    model.hero.name = choice.hero?.name ?? randomName(model.hero.look.build);
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
  const updateHud = createHeroHud(model.hero, hudTop, model.moves);
  const updateBlessing = createBlessingHud(model.hero);
  const updateClock = createClockHud();
  const placeBanner = createPlaceBanner();
  const updatePlaceBar = createPlaceBar();
  const updateTarget = createTargetHud(hudTop);
  const lootPrompt = createLootPrompt();
  const orderPrompt = createLootPrompt('F'); // sat at the bar: an ale, over the hero's head
  const piePrompt = createLootPrompt('G', false, orderPrompt); // and a meat pie, stacked over it
  const rentPrompt = createLootPrompt('G', false, lootPrompt); // stood by the barmaid: a room, stacked over her E; by the let room's bed: sleep
  const sleepFade = createSleepFade();
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
  const pourMeter = new PourMeter((at, text, ink) => floatingText.spawn(at, [text], ink)); // (behind the bar: the pour, and its word)
  const GUARD_WORDS = { rolled: ['Rolled', '#f8ecd4'], parried: ['Parried!', '#ffc94a'], blocked: ['Blocked', '#c8d0d8'], broken: ['Guard broken', '#ff6a5a'] } as const; // (a blow at the hero, met: combatMoves.ts)
  let lastFrame = performance.now();
  let textSpace = model.inside?.entrance; // where floating text's places are (the world, or a room)
  const bag = createInventoryPanel(model);
  const shop = createShopPanel(model, { bag });
  const forge = createSmithPanel(model, { bag });
  const pack = createPedlarPanel(model, { bag }); // a pedlar's, on the road
  const jobs = createJobPanel(model, { setPaused: (paused) => (controller.paused = paused) }); // the work to be had: an inn's server's
  const herbs = createHerbalistPanel(model, { bag }); // a village herbalist's, at home
  const board = createQuestBoardPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const updateQuests = createQuestTracker(model);
  const journal = createJournal(model);
  const skills = createSkillsPanel(model); // (K: the hero's skills, cooking and fishing)
  const levelUp = createLevelUpPanel(model, { setPaused: (paused) => (controller.paused = paused) });
  const sheet = createHeroSheet(model, { levelUp: () => levelUp.menu.open() });
  const pause = createPauseMenu({
    setPaused: (paused) => (controller.paused = paused),
    redraw: () => {
      view.update(0); // (the room rebuilt, walls changed) while the game stands still
      view.render();
    },
    mainMenu: () => {
      autoSave.save();
      keepSessionSeed(null); // (this tab's world let go: the reload shows the main menu)
      window.location.reload();
    },
    hero: () => ({ name: model.hero.name, level: model.hero.level, day: clockAt(model.minutes).day, seed: model.seed, look: model.hero.look, equipment: model.hero.equipment }),
    walls: {
      full: () => model.fullWalls,
      toggle: () => {
        model.fullWalls = !model.fullWalls;
        if (model.inside) innerWalls(model.inside.furniture, model.fullWalls);
      },
    },
  });
  // The action bar, bottom centre: shortcuts to food and drink in the bag (keys 1 to 8: GameController).
  const { hero: me } = model;
  const updateActionBar = createActionBar(me, { use: (i) => useAction(me, i), swap: (a, b) => swapActions(me, a, b), clear: (i) => clearAction(me, i) });
  const updateToolbar = createToolbar([
    { label: 'Hero', key: 'C', icon: heroBustIcon(model.hero.look), isOpen: () => sheet.menu.isOpen, toggle: () => sheet.menu.toggle() },
    { label: 'Bag', key: 'B', icon: bagToolIcon, isOpen: () => bag.menu.isOpen, toggle: () => bag.menu.toggle() },
    { label: 'Journal', key: 'L', icon: journalIcon, isOpen: () => journal.menu.isOpen, toggle: () => journal.menu.toggle() },
    { label: 'Skills', key: 'K', icon: skillsIcon, isOpen: () => skills.menu.isOpen, toggle: () => skills.menu.toggle() },
    { label: 'Level up', key: 'P', icon: levelUpIcon, isOpen: () => levelUp.menu.isOpen, toggle: () => levelUp.menu.toggle(), marked: () => model.hero.statPoints > 0 },
    { label: 'Pause', key: 'Esc', icon: pauseIcon, isOpen: () => pause.isOpen, toggle: () => pause.toggle() },
  ]);
  // What E does right now: pick up loot in reach, else sit or lie down (or get up), else go through a door.
  const DOOR_NAMES = { house: 'Enter house', inn: 'Enter the inn', smithy: 'Enter the smithy' } as const;
  const CHEST_PROMPTS = { chest: 'Open the chest', hoard: 'Tear open the hoard', locked: 'Locked · the chief has the key' } as const;
  const promptTarget = (): PromptTarget | null => {
    if (model.work.shift) return workPrompt(model); // (at work: the work's prompts alone, and the notice board's)
    const loot = model.lootInReach;
    if (loot) return lootTarget(loot);
    const work = workPrompt(model); // (the inn's notice board: its work)
    if (work) return work;
    const { hero } = model;
    const chest = chestInReach(model); // (a lord's chest, a brood mother's silk-wrapped hoard, a bandit camp's: locked while its chief stands)
    if (chest) return { label: CHEST_PROMPTS[chest.what], x: chest.x, y: chest.y, z: chest.z };
    const seated = model.seated;
    const talker = talkingTo(model.folk, model.inside, hero); // the barmaid, the smith (of the villagers round about)
    const talk = talker && { label: talkPrompt(talker), x: talker.x, y: 1.1, z: talker.z, npc: talker };
    if (seated && seated.seat.piece.kind === 'barStool' && bar.busy) return null; // she's seeing to the order: no talking, and E waits
    if (seated) return talk && seated.seat.piece.kind === 'barStool' ? talk : { label: seated.seat.lying ? 'Get up' : 'Stand up', x: hero.x, y: hero.y + 0.6, z: hero.z };
    const seat = model.seatInReach;
    if (seat) {
      const { piece } = seat;
      return { label: seat.lying ? 'Lie down' : 'Sit', x: piece.x + (piece.w - 1) / 2, y: seat.y + (model.inside ? 0.5 : 0.3), z: piece.z + (piece.d - 1) / 2 };
    }
    if (talk && !(model.inside && model.doorInReach)) return talk; // (at the way out: out first, not a word with the bouncer by it)
    const traveller = !model.inside && !model.yard ? travellerInReach(model.travellers.list, hero) : null; // (on the road)
    if (traveller) return { label: travellerPrompt(traveller), x: traveller.x, y: traveller.y + 0.75, z: traveller.z };
    const read = model.boardInReach;
    const spot = read === null ? undefined : boardSpot(model, read);
    if (spot) return { label: 'Read the notice board', x: spot.x, y: hero.y + 1.05, z: spot.z };
    const well = model.wellInReach;
    if (well !== null) return { label: 'Toss a silver coin', x: model.villages[well].x, y: hero.y + 0.8, z: model.villages[well].z };
    const hallDoor = model.inside?.below ? doorAt(model.inside, hero) : null;
    if (hallDoor) return { label: hallDoor.open ? 'Close door' : 'Open door', x: hero.x, y: hero.y + 1.05, z: hero.z }; // (a locked one too: tried, it's found locked)
    if (model.inside && stairsInReach(model.inside, hero)) return { label: model.inside.below ? 'Go downstairs' : 'Go upstairs', x: hero.x, y: hero.y + 1.05, z: hero.z };
    const door = model.doorInReach;
    if (!door) return null;
    if (model.inside) return { label: atWayOut(model.inside, hero) ? 'Take the way out' : goesUnder(model.inside.entrance) ? 'Climb out' : 'Leave', x: hero.x, y: 0.75, z: hero.z };
    const place = goesUnder(door) ? dungeonAt(door) : null;
    const label = place ? `Enter the ${place.kind} (level ${place.level}) · ${Math.round(model.clearedShare(door) * 100)}% cleared` : isHerbalistHome(door) ? "Enter the herbalist's" : DOOR_NAMES[door.type as keyof typeof DOOR_NAMES];
    return { label, x: door.x, y: hero.y + 0.75, z: door.z };
  };
  const onFrame = () => {
    countFrame();
    // Where the hero is on the map: their tile (indoors, the building's door's), and the room they're in.
    const at = model.inside ? model.inside.below ?? model.inside.entrance : model.hero;
    const where = `x: ${Math.round(at.x)} · z: ${Math.round(at.z)}${model.inside ? ` · in the ${model.inside.entrance.type}${model.inside.below ? ', upstairs' : ''}` : ''}`;
    if (positionLabel.textContent !== where) positionLabel.textContent = where;
    updateHud();
    updateBlessing();
    updateClock(model.minutes);
    updateTarget(model.focused, model.hero.level);
    const below = model.dungeon && model.inside && dungeonAt(model.inside.entrance);
    const camp = !model.inside ? model.campLife.status(model.hero) : null; // (about a bandit camp: its bandits and chief slain)
    const village = !model.inside && !camp ? model.welcome.village() : null; // (in a village: its name and level, its board's quests)
    const shift = model.work.shift; // (at work: the shift's time and tally)
    updatePlaceBar(shift ? shiftStatus(shift) : below ? { name: below.name, share: model.clearedShare(model.inside!.entrance) } : camp ? { name: camp.name, camp, ink: dangerInk(camp.level, model.hero.level) } : village ? { name: village.name, village: { level: village.level, ink: dangerInk(village.level, model.hero.level), quests: model.quests.tallyAt(model.boardOf(village.village)) } } : null); // (down in a crypt or a cave: how much is cleared)
    bag.update();
    shop.update(); // (walked away from the keeper: the shop shuts)
    forge.update();
    herbs.update();
    pack.update();
    journal.update();
    skills.update();
    sheet.update();
    updateToolbar();
    updateActionBar();
    const prompt = promptTarget();
    view.prompted = prompt?.npc ?? null; // (their name gives way to it)
    lootPrompt.update(prompt, (x, y, z) => view.toScreen(x, y, z));
    pourMeter.update(model.work.shift instanceof BarShift ? model.work.shift : null, model.hero, (x, y, z) => view.toScreen(x, y, z));
    const action = prompt && roomAction(model); // (G by the barmaid: a room, or said it's let; by its bed at night: sleep)
    rentPrompt.update(action && prompt ? { label: roomActionLabel(action), muted: action.kind === 'rent' && action.taken, x: prompt.x, y: prompt.y, z: prompt.z } : null, (x, y, z) => view.toScreen(x, y, z));
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
  const controller = new GameController(model, view, { uncapped: options.uncapped, onFrame, onPickUp: (item) => floatingText.spawn({ x: model.hero.x, y: model.hero.y + (model.inside ? 0.95 : 0.6) + 0.2, z: model.hero.z }, [`+ ${nameOf(item)} (${kindOf(item)})`], QUALITY_INK[qualityOf(item)]), onTraveller: (t) => (t.role === 'pedlar' ? pack.open(t) : (model.travellers.hold(t, WORD_HOLD), say(t, travellerSays(t, model.crypts)))), onTalk: (npc) => (npc.role === 'smith' ? forge.open(npc) : npc.role === 'herbalist' ? herbs.open(npc) : npc.role === 'bouncer' ? bouncerSpeaks(npc) : !bar.busy && shop.open(npc)), onRead: (at) => board.open(at), onWork: (inn) => jobs.open(inn), onOrder: (barmaid, what) => bar.order(barmaid, what),
    onSleep: () => {
      if (!model.seated) model.sitOrStand(); // (into the bed)
      sleepFade(
        () => {
          controller.paused = true; // (the night passing, unseen)
          sleepTillMorning(model);
        },
        () => (controller.paused = false), // (seen again, the morning, as it fades back in)
      );
    },
    onEvent: (event) => {
      // Floating text, as in FarHold: coins looted in gold over the hero's
      // head; a blow's damage in white over the enemy, or in red over the
      // hero ("-3"); a quest's progress in amber (turquoise once done). Over their heads, higher indoors where the hero's drawn bigger.
      const { hero } = model;
      const head = model.inside ? 0.95 : 0.6;
      if (event.kind === 'coins') floatingText.spawn({ x: hero.x, y: hero.y + head, z: hero.z }, coinText(event.amount), '#ffd35a');
      else if (event.kind === 'quest') floatingText.spawn({ x: event.x, y: event.y + head + 0.2, z: event.z }, [event.done ? `${event.text} ✓` : event.text], event.done ? '#5ae0d8' : '#ffc94a');
      else if (event.kind === 'arrive') placeBanner(event.name, `Level ${event.level}`);
      else if (event.kind === 'village') placeBanner(event.name, ['Village · ', { text: `Level ${event.level}`, ink: dangerInk(event.level, hero.level) }]); // (its level: its quests', its smith's; in how hard they are for them)
      else if (event.kind === 'campGate') placeBanner(event.name, ['Bandit camp · ', { text: `Level ${event.level}`, ink: dangerInk(event.level, hero.level) }]); // (its level in how dangerous it is to them)
      else if (event.kind === 'locked') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ["It's locked"], '#f8ecd4');
      else if (event.kind === 'chilled') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ['Chilled'], '#9fe4ff');
      else if (event.kind === 'webbed') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ['Webbed'], '#e8e2d6');
      else if (event.kind === 'rises') placeBanner(`${event.name} rises`, 'From the great tomb');
      else if (event.kind === 'stirs') placeBanner(`${event.name} stirs`, 'From her silken nest');
      else if (event.kind === 'torn') placeBanner('The silk tears', 'Deep within, the nest lies open');
      else if (event.kind === 'walled') placeBanner('The nest is webbed shut', `Clear ${Math.round(TEARS_AT * 100)}% of the cave to tear the silk · ${Math.round(event.share * 100)}% cleared`, 3000); // (the brood mother out of reach: told large)
      else if (event.kind === 'brood') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, ['The eggs are hatching!'], '#d8e89a');
      else if (event.kind === 'cleared') placeBanner(event.place === 'cave' ? 'Cave cleared' : event.place === 'camp' ? 'Camp cleared' : 'Crypt cleared', `${event.name.charAt(0).toUpperCase() + event.name.slice(1)}${event.point ? ' · +1 point to spend (P)' : ''}`);
      else if (event.kind === 'point') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.25, z: hero.z }, ['+1 point to spend (P)'], '#5ae0d8');
      else if (event.kind === 'blessing') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [`${event.name}!`], '#ffd35a');
      else if (event.kind === 'say') {
        if ((model.inside?.entrance ?? null) === event.where) floatingText.speak(event.speaker, model.inside ? 1.35 : 0.8, event.text); // said in the hero's room: a bubble over them
      } else if (event.kind === 'poor') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.2, z: hero.z }, [event.text], '#e8805a');
      else if (event.kind === 'levelUp') floatingText.spawn({ x: hero.x, y: hero.y + head + 0.25, z: hero.z }, [`Level ${event.level}! · ${counted(event.points, 'point')} to spend (P)`], '#5ae0d8');
      else if (event.kind === 'dodge') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, ['Dodge'], '#f8ecd4');
      else if (event.kind === 'guard') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, [GUARD_WORDS[event.outcome][0]], GUARD_WORDS[event.outcome][1]); // (a roll through it, a parry, a block, the guard broken)
      else if (event.kind === 'shift') placeBanner(event.early ? 'Shift left early' : 'Shift over', `${event.served} served · ${event.walkedOut} walked out · ${event.tally} · ${event.earned} copper${event.bonus ? ` (${event.bonus} for a clean shift)` : ''}`, 4500);
      else if (event.kind === 'jobRank') placeBanner(event.rank, `A step up in ${event.job.toLowerCase()}`);
      else if (event.crit) floatingText.spawn({ x: event.x, y: event.y + (event.on === 'hero' ? 0.4 : KIND_LOOKS[event.on].textHeight) + 0.1, z: event.z }, [`${event.amount}!`], '#ffc94a'); // a critical blow, in amber
      else if (event.on === 'hero') floatingText.spawn({ x: event.x, y: event.y + head, z: event.z }, [`-${event.amount}`], '#ff6a5a');
      else floatingText.spawn({ x: event.x + (Math.random() - 0.5) * 0.2, y: event.y + KIND_LOOKS[event.on].textHeight, z: event.z }, [`${event.amount}`], '#ffffff');
    },
  });
  controller.start();
  if (world && !kept) window.setTimeout(() => void keepWorld(seed, size, world), 2000); // (a classic world's, once the game's under way)
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
