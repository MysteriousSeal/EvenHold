// Dev-only cheat menu, toggled with the backquote key (`), built on the shared
// EvenHold menu (view/ui/menu.ts). A tab for each thing a cheat touches,
// named for what you're after: Go to (towns, dungeons, the wilds, the roads,
// back to the start), Sights (rocks and landmarks, wildflowers, wildlife),
// Hero (powers first, then health and energy, level and stats), Appearance
// (body, outfits, each slot), Items (money, into the bag, on the ground), Foes
// (spawn, control, dungeons) and World (time, shops, debug, and facts about
// where the hero stands); each tab's rows in groups under a header, two
// columns wide, each named by what it does. The game keeps running while it's open, so a teleport or a
// summon shows at once.
// main.ts loads this module only when Vite runs in dev mode, so production
// builds don't contain it.
import type { GameModel } from '../../model/GameModel';
import type { Who } from '../../model/story/story';
import { createQuestDebug } from './questDebug';
import { charmActions } from './charmCheats';
import { strongholdAction } from './strongholdCheats';
import { hourCheat } from './roomCheats';
import { SPELL_ICONS } from '../../view/ui/spellIcons';
import {
  nextCamp,
  nextCave,
  nextRuin,
  nearestLakeShore,
  nearestPack,
  nearestOf,
  nextVillage,
  resetCrypts, slayNearby, spawnDraugr,
  spawnEnemyNear,
  spawnTile,
  villageEntrance,
  enterNearest,
  visitHerbalist,
  nearestTraveller,
  nextLife,
  nextMeadow,
  nextScenery,
  type Tile,
} from '../../model/cheats';
import type { Village } from '../../model/types';
import type { Entrance } from '../../model/interiors/interiors';
import { TIRED, gainXp, xpToNext } from '../../model/hero/heroStats';
import { maxEnergyOf } from '../../model/hero/attributes';
import { maxHpOf } from '../../model/hero/attributes';
import { refundPoints } from '../../model/hero/training';
import { slotsUsed } from '../../model/hero/bagStacks';
import { bagRoom } from '../../model/hero/bagSlots';
import { createMenu, type Menu, type MenuAction, type MenuIcon } from '../../view/ui/menu';
import type { Scenery, SceneryKind } from '../../model/scenery/scenery';
import { BLOOMS, type BloomKind } from '../../model/scenery/meadowPatches';
import type { LifeKind } from '../../model/scenery/ambientSpots';
import { ICONS as ICON, itemIcon } from './cheatIcons';
import { group, toggle } from './cheatRows';
import { lookActions } from './lookCheats';
import { itemActions } from './itemCheats';
import { blessAll } from '../../model/hero/blessing';
import { restockAll } from '../../model/inn/tavernShop';
import { lootIcon } from '../../view/ui/itemIcons';
import type { Ruin } from '../../model/ruins/ruins';
import type { Cave } from '../../model/caves/caves';
import type { Camp } from '../../model/camps/camps';
import './cheatPanel.css';

const SPEED_BOOST = 3;
const SPEEDS = [1, 2, 3, 4, 10]; // the game speed cheat's steps
// The Sights: each kind of rock and landmark, flower and small life, its row's words.
const SIGHTS_SCENERY: ReadonlyArray<readonly [SceneryKind, string, string]> = [
  ['boulder', 'Next boulder', 'A mossy boulder out in the wilds'],
  ['outcrop', 'Next rock outcrop', 'Slabs of stone stacked, moss on their shelves'],
  ['log', 'Next fallen log', 'A felled trunk in the woods, mushrooms at its side'],
  ['cairn', 'Next cairn', 'Flat stones stacked by someone long ago'],
  ['wall', 'Next stone wall', 'An old dry-stone wall, ivy down it'],
  ['menhir', 'Next stone circle', 'A ring of standing stones, from its middle'],
];
const BLOOM_NAMES: Record<BloomKind, string> = { poppy: 'poppies', bluebell: 'bluebells', daisy: 'daisies', buttercup: 'buttercups', foxglove: 'foxgloves', lavender: 'lavender', clover: 'clover' };
const SIGHTS_LIFE: ReadonlyArray<readonly [LifeKind & keyof typeof ICON, string, string]> = [ // (those with an icon)
  ['bird', 'Next songbirds', 'A little flock on the grass (by day: the hour set if need be)'],
  ['butterfly', 'Next butterflies', 'Over a meadow (by day: the hour set if need be)'],
  ['firefly', 'Next fireflies', 'Glowing in the dark (at night: the hour set if need be)'],
];
const NEARBY = 15; // tiles, for "nearby foes"

// `time`: the game's speed (a multiple of real time), to read and set.
export function createCheatPanel(model: GameModel, time: { scale: number }, talk: (who: Who, quest: string) => void = () => {}, play: Parameters<typeof hourCheat>[1] = () => false): void {
  createQuestDebug(model, talk); // (Q beside someone, with the quests' debugging on)
  const here = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  // Teleports there and closes the menu, so the new place is seen at once.
  const travel = (tile: Tile | null, where: string) => {
    if (!tile) return `There's no ${where} in this world.`;
    model.teleport(tile.x, tile.z);
    menu.close();
    return `Travelled to ${where}.`;
  };
  const [seenScenery, seenMeadows, seenLife] = [new Set<Scenery>(), new Set<string>(), new Set<string>()]; // (the Sights' tours)
  const visited = new Set<Village>(); // the village tour: nearest first, no repeats
  const ruinsSeen = new Set<Ruin>(); // the ruins' tour, likewise
  const campsSeen = new Set<Camp>(); // and the camps'
  const cavesSeen = new Set<Cave>(); // and the caves'

  const entered = new Set<Entrance>(); // likewise, the buildings stepped into
  const herbalists = new Set<Entrance>(); // and the herbalists' houses
  const witches = new Set<Entrance>(); // the hedge-witches' cottages
  const travellerRow = (role: 'pedlar' | 'pilgrim' | 'guard', title: string, detail: string, icon: MenuIcon): MenuAction => ({
    icon,
    title,
    detail,
    run: () => {
      const found = nearestTraveller(model, here(), role);
      return travel(found?.at ?? null, found ? `${found.traveller.name}, a ${role}` : `${role} on the roads`);
    },
  });
  const insideRow = (type: 'house' | 'inn' | 'smithy', icon: MenuIcon): MenuAction => ({
    icon,
    title: `Inside ${type === 'house' ? 'a house' : type === 'inn' ? 'an inn' : 'a smithy'}`,
    detail: 'The nearest one you haven’t been in',
    run: () => {
      if (!enterNearest(model, type, entered)) return `There's no ${type} in this world.`;
      menu.close();
      return `Inside the ${type}.`;
    },
  });
  const summonRow = (kind: 'wolf' | 'bandit' | 'boar' | 'bear' | 'lynx', icon: MenuIcon, detail = 'Just ahead of you'): MenuAction => ({
    icon,
    title: `A ${kind}`,
    detail,
    run: () => (spawnEnemyNear(model, kind), `A ${kind} appears.`),
  });

  const menu: Menu = createMenu({
    title: 'Cheats',
    toggleKey: 'Backquote',
    tabs: [
      {
        name: 'Go to',
        icon: ICON.travel,
        actions: [
          ...group('Towns', [
            {
              icon: ICON.village,
              title: 'Next village',
              detail: 'The nearest one you haven’t visited',
              run: () => {
                const village = nextVillage(model, here(), visited);
                return travel(village && villageEntrance(model, village, here()), `village ${visited.size} of ${model.villages.length}`);
              },
            },
            insideRow('house', ICON.village),
            insideRow('inn', lootIcon('ale')),
            insideRow('smithy', itemIcon('shortSword')),
            {
              icon: lootIcon('lesserHealthPotion'),
              title: 'Inside a herbalist\'s',
              detail: 'The nearest herbalist\'s house, with their potions',
              run: () => {
                if (!visitHerbalist(model, herbalists)) return 'There\'s no herbalist in this world.';
                menu.close();
                return 'At the herbalist\'s.';
              },
            },
            {
              icon: lootIcon('moonGrimoire'),
              title: 'Inside a hedge-witch\'s',
              detail: 'The nearest hedge-witch\'s cottage (about one village in three), her charms to teach',
              run: () => {
                if (!visitHerbalist(model, witches, 'witch')) return 'There\'s no hedge-witch in this world.';
                menu.close();
                return 'At the hedge-witch\'s.';
              },
            },
          ]),
          ...group('Dungeons', [
            { icon: ICON.ruin, title: 'Next crypt', detail: 'The nearest ruins you haven’t visited, their crypt in them', run: () => travel(nextRuin(model, here(), ruinsSeen), `ruins ${ruinsSeen.size} of ${model.ruins.length}`) },
            { icon: ICON.ruin, title: 'Next cave', detail: 'The nearest you haven’t visited, before its mouth', run: () => travel(nextCave(model, here(), cavesSeen), `cave ${cavesSeen.size} of ${model.caves.length}`) },
            strongholdAction(model, ICON.camp, here, travel), // (strongholdCheats.ts)
          ]),
          ...group('Wilds', [
            { icon: ICON.camp, title: 'Next bandit camp', detail: 'The nearest you haven’t visited, at its gate', run: () => travel(nextCamp(model, here(), campsSeen), `camp ${campsSeen.size} of ${model.camps.length}`) },
            { icon: ICON.wolfPack, title: 'Nearest wolf pack', detail: 'A few paces from the nearest wolves', run: () => travel(nearestPack(model, here()), 'a wolf pack') },
            { icon: ICON.bear, title: 'Nearest bear', detail: 'A few paces from the nearest, deep in the forest', run: () => travel(nearestOf(model, here(), 'bear'), 'a bear') },
            { icon: ICON.lynx, title: 'Nearest lynx', detail: 'A few paces from the nearest, at a forest’s edge', run: () => travel(nearestOf(model, here(), 'lynx'), 'a lynx') },
            { icon: ICON.lake, title: 'Nearest lake', detail: 'Stand on the closest shore', run: () => travel(nearestLakeShore(model, here()), 'the lake shore') },
          ]),
          ...group('Roads', [
            travellerRow('pedlar', 'Nearest pedlar', 'On the road, with their pack', lootIcon('travellersPack')),
            travellerRow('pilgrim', 'Nearest pilgrim', 'On the road, with a word to say', ICON.hero),
            travellerRow('guard', 'Nearest guards', 'Two guards walking their beat', itemIcon('nasalCap')),
          ]),
          ...group('Start', [{ icon: ICON.spawn, title: 'Back to spawn', detail: 'Where the journey began', run: () => travel(spawnTile(model), 'spawn') }]),
        ],
      },
      {
        name: 'Sights',
        icon: ICON.menhir,
        actions: [
          ...group(
            'Rocks & landmarks',
            SIGHTS_SCENERY.map(([kind, title, detail]): MenuAction => ({ icon: ICON[kind], title, detail, run: () => travel(nextScenery(model, here(), kind, seenScenery), title.replace(/^Next /, 'a ').toLowerCase()) })),
          ),
          ...group('Wildflowers', [
            { icon: ICON.meadow, title: 'Next flower meadow', detail: 'A thick patch of wildflowers, any kind', run: () => travel(nextMeadow(model, here(), null, seenMeadows), 'a flower meadow') },
            ...BLOOMS.map(
              (kind, i): MenuAction => ({
                icon: ICON[kind],
                title: `Next ${BLOOM_NAMES[kind]}`,
                detail: `A meadow patch of ${BLOOM_NAMES[kind]}`,
                run: () => travel(nextMeadow(model, here(), i, seenMeadows), `a patch of ${BLOOM_NAMES[kind]}`),
              }),
            ),
          ]),
          ...group(
            'Wildlife',
            SIGHTS_LIFE.map(([kind, title, detail]): MenuAction => ({ icon: ICON[kind], title, detail, run: () => travel(nextLife(model, here(), kind, seenLife), title.replace(/^Next /, '').toLowerCase()) })),
          ),
        ],
      },
      {
        name: 'Hero',
        icon: ICON.hero,
        actions: [
          ...group('Powers', [
            { icon: ICON.invulnerable, title: 'Invulnerable', detail: "Foes' blows don't hurt", ...toggle(() => model.godMode, (on) => (model.godMode = on), 'Invulnerable.', 'Vulnerable again.') },
            { icon: ICON.slay, title: 'One-hit kills', detail: 'Every blow fells what it lands on, crypt lords too', ...toggle(() => model.oneHitKills, (on) => (model.oneHitKills = on), 'Every blow a kill.', 'Blows as they were.') },
                      {
              icon: ICON.swiftFeet,
              title: 'Run fast',
              detail: `Walk ${SPEED_BOOST}× faster (not the well's Swift feet)`,
              ...toggle(() => model.speedMultiplier !== 1, (on) => (model.speedMultiplier = on ? SPEED_BOOST : 1), 'Running fast.', 'Back to walking.'),
            },
            { icon: ICON.noclip, title: 'Walk through walls', detail: 'Walls, water and foes (no clipping)', ...toggle(() => model.noclip, (on) => (model.noclip = on), 'Walking through anything.', 'The world is solid again.') },
          ]),
          ...group('Health & energy', [
            { icon: ICON.hero, title: 'Full health', detail: 'Healed back to full', run: () => ((model.hero.hp = maxHpOf(model.hero)), 'Healed.') },
            { icon: lootIcon('ale'), title: 'Full energy', detail: 'Rested at once, as after a night in bed', run: () => ((model.hero.energy = maxEnergyOf(model.hero)), 'Full of energy.') },
            { icon: ICON.slay, title: 'Set health to 1', detail: 'One hit point left (to test healing)', run: () => ((model.hero.hp = 1), 'One hit point left.') },
            { icon: ICON.noclip, title: 'Faint', detail: 'As if felled: coin lost, waking at the inn, Weary', run: () => (model.fall(), 'Fallen, and woken Weary.') },
            {
              icon: ICON.swiftFeet,
              title: 'Make tired',
              detail: `Energy to ${TIRED - 1}, just under where the walk slows`,
              run: () => ((model.hero.energy = TIRED - 1), `Energy at ${TIRED - 1}: tired.`),
            },
          ]),
          ...group('Level & stats', [
            {
              icon: ICON.starterSet,
              title: 'Gain a level',
              detail: 'Just enough experience for the next',
              run: () => (gainXp(model.hero, xpToNext(model.hero.level) - model.hero.xp), `Level ${model.hero.level}.`),
            },
            { icon: ICON.hero, title: 'Refund stat points', detail: 'Every point spent, back to spend again', run: () => (refundPoints(model.hero), `${model.hero.statPoints} points to spend.`) },
            { icon: ICON.travel, title: 'All well blessings', detail: "Every well's blessing at once, for half an hour", run: () => (blessAll(model.hero), 'Every blessing, for half an hour.') },
          ]),
        ],
      },
      {
        name: 'Appearance',
        icon: ICON.heroine,
        actions: lookActions(model), // (lookCheats.ts)
      },
      {
        name: 'Items',
        icon: lootIcon('roughSack'),
        actions: itemActions(model), // (itemCheats.ts)
      },
      { name: 'Charms', icon: SPELL_ICONS.swap, actions: charmActions(model) }, // (charmCheats.ts)
      {
        name: 'Foes',
        icon: ICON.enemies,
        actions: [
          ...group('Spawn', [
            summonRow('wolf', ICON.wolf),
            summonRow('bandit', ICON.bandit),
            summonRow('boar', ICON.boar, 'Just ahead of you (passive until struck)'),
            summonRow('bear', ICON.bear, 'Just ahead of you (rears up and slams; charges when hurt)'),
            summonRow('lynx', ICON.lynx, 'Just ahead of you (pounces from a few tiles off)'),
            { icon: ICON.slay, title: 'A draugr', detail: 'At your level (in a crypt: with its breath and cleave)', run: () => (spawnDraugr(model), `A draugr of level ${model.hero.level} rises.`) },
          ]),
          ...group('Control', [
            { icon: ICON.freeze, title: 'Freeze foes', detail: 'Every foe stands still', ...toggle(() => model.enemiesFrozen, (on) => (model.enemiesFrozen = on), 'Foes frozen.', 'Foes move again.') },
            { icon: ICON.slay, title: 'Slay foes nearby', detail: `Everything within ${NEARBY} tiles`, run: () => `${slayNearby(model, NEARBY)} foes slain.` },
          ]),
          ...group('Dungeons', [
            { icon: ICON.ruin, title: 'Reset crypts & caves', detail: 'Every guard and beast back at its post (out of one first)', run: () => (resetCrypts(model), 'The crypts and caves are guarded again.') },
          ]),
        ],
      },
      {
        name: 'World',
        icon: ICON.world,
        actions: [
          ...group('Time', [
            {
              icon: ICON.freeze,
              title: 'Game speed',
              detail: 'Each click, faster: ×1, ×2, ×3, ×4, ×10',
              current: () => ({ value: `×${time.scale}` }),
              run: () => ((time.scale = SPEEDS[(SPEEDS.indexOf(time.scale) + 1) % SPEEDS.length]), `The game runs at ×${time.scale}.`),
            },
          ]),
          ...group('Shops', [
            { icon: lootIcon('ale'), title: 'Restock the inns', detail: "Every barmaid's wares and purse back to full", run: () => `${restockAll(model.shops, model.seed)} barmaids restocked (the rest are full anyway).` },
          ]),
          ...group('Debug', [
            { icon: ICON.village, title: 'Quest debug', detail: 'Q beside someone: their quests, to replay. Journal: finish any', ...toggle(() => model.story.debug, (on) => (model.story.debug = on), 'Quest debug on: Q beside someone lists their quests.', 'Quest debug off.') },
            {
              icon: ICON.village,
              title: 'Furniture yard',
              detail: 'Flat grass, every piece up close. Again to return',
              run: () => {
                const said = model.toggleFurnitureYard();
                menu.close();
                return said;
              },
            },
            hourCheat(model, play, () => menu.close()),
          ]),
        ],
        facts: () => worldFacts(model, NEARBY),
      },
    ],
  });
}

// The World tab's facts: where the hero stands, what's about, the world's size and what the bag holds.
function worldFacts(model: GameModel, near: number): Array<[string, string]> {
  const { hero } = model;
  const tx = Math.round(hero.x);
  const tz = Math.round(hero.z);
  const foes = model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) <= near);
  const count = (kind: string) => foes.filter((e) => e.kind === kind).length;
  const village = model.villages.reduce<Village | null>((best, v) => (!best || Math.hypot(v.x - tx, v.z - tz) < Math.hypot(best.x - tx, best.z - tz) ? v : best), null);
  return [
    ['Seed', String(model.seed)],
    ['Position', `${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`],
    ['Ground', model.tiles.has(tx, tz) ? `tier ${model.tiles.height(tx, tz)} · ${model.tiles.lake(tx, tz) ? 'water' : model.tiles.surface(tx, tz)}` : 'off the map'],
    ['Foes near', `${count('wolf')} wolves · ${count('bandit')} bandits · ${count('boar')} boars`],
    ['Nearest village', village ? `${Math.round(Math.hypot(village.x - tx, village.z - tz))} tiles` : 'none'],
    ['World', `${model.size.width}×${model.size.depth}`],
    ['Villages · camps · ruins', `${model.villages.length} · ${model.camps.length} · ${model.ruins.length}`],
    ['Bag', `${slotsUsed(hero.bag)} of ${bagRoom(hero)} slots`],
  ];
}
