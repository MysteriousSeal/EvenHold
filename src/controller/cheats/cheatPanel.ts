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
import {
  nextCamp,
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
import {
  BANDIT_OUTFIT,
  EQUIP_SLOTS,
  ITEMS,
  ITEM_IDS,
  SLOT_NAMES,
  STARTER_SET,
  pickOutfit,
  slotOf,
  wear,
  type ItemId,
} from '../../model/human/equipment';
import type { Village } from '../../model/types';
import type { Entrance } from '../../model/interiors/interiors';
import { TIRED, gainXp, xpToNext } from '../../model/hero/heroStats';
import { maxEnergyOf } from '../../model/hero/attributes';
import { maxHpOf } from '../../model/hero/attributes';
import { refundPoints } from '../../model/hero/training';
import { LOOT_IDS, type LootId } from '../../model/loot/loot';
import { BAG_IDS } from '../../model/loot/bags';
import { POTION_IDS } from '../../model/loot/potions';
import { JUNK_ITEMS } from '../../model/loot/junk';
import { PROVISION_IDS } from '../../model/loot/provisions';
import { addToBag, type BagItem } from '../../model/hero/bag';
import { JUNK_STACK, slotsUsed } from '../../model/hero/bagStacks';
import { bagRoom } from '../../model/hero/bagSlots';
import { createMenu, type Menu, type MenuAction, type MenuIcon } from '../../view/ui/menu';
import type { Scenery, SceneryKind } from '../../model/scenery/scenery';
import { BLOOMS, type BloomKind } from '../../model/scenery/meadowPatches';
import type { LifeKind } from '../../model/scenery/ambientSpots';
import { HEROINE_LOOK, ICONS as ICON, itemIcon } from './cheatIcons';
import { HERO_LOOK, STYLES_OF, randomLook, type HairStyle } from '../../model/human/humanoid';
import { COPPER_PER_SILVER, SILVER_PER_GOLD } from '../../model/hero/money';
import { blessAll } from '../../model/hero/blessing';
import { restockAll } from '../../model/inn/tavernShop';
import { lootIcon } from '../../view/ui/itemIcons';
import { randomName } from '../../model/npcs/npcs';
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
const SIGHTS_LIFE: ReadonlyArray<readonly [LifeKind, string, string]> = [
  ['bird', 'Next songbirds', 'A little flock on the grass (by day: the hour set if need be)'],
  ['butterfly', 'Next butterflies', 'Over a meadow (by day: the hour set if need be)'],
  ['firefly', 'Next fireflies', 'Glowing in the dark (at night: the hour set if need be)'],
];
const NEARBY = 15; // tiles, for "nearby foes"

// `time`: the game's speed (a multiple of real time), to read and set.
export function createCheatPanel(model: GameModel, time: { scale: number }): void {
  const here = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  // Teleports there and closes the menu, so the new place is seen at once.
  const travel = (tile: Tile | null, where: string) => {
    if (!tile) return `There's no ${where} in this world.`;
    model.teleport(tile.x, tile.z);
    menu.close();
    return `Travelled to ${where}.`;
  };
  const [seenScenery, seenMeadows, seenLife] = [new Set<Scenery>(), new Set<string>(), new Set<string>()]; // (the Sights' tours)
  let banditDraws = 0; // for "Random bandit": a new outfit each time
  // Replaces everything the hero wears with `items`.
  const dress = (items: readonly ItemId[]) => {
    for (const slot of EQUIP_SLOTS) delete model.hero.equipment[slot];
    for (const item of items) wear(model.hero.equipment, item);
  };
  // Puts each of `items` in the bag (room or not: a cheat).
  const give = (items: readonly BagItem[]) => items.forEach((item) => addToBag(model.hero.bag, item));
  const visited = new Set<Village>(); // the village tour: nearest first, no repeats
  const ruinsSeen = new Set<Ruin>(); // the ruins' tour, likewise
  const campsSeen = new Set<Camp>(); // and the camps'
  const cavesSeen = new Set<Cave>(); // and the caves'
  // The nearest cave not yet visited on the tour: the spot before its mouth.
  const nextCave = (): Tile | null => {
    const cave = model.caves.filter((c) => !cavesSeen.has(c)).sort((a, b) => Math.hypot(a.entrance.x - model.hero.x, a.entrance.z - model.hero.z) - Math.hypot(b.entrance.x - model.hero.x, b.entrance.z - model.hero.z))[0];
    if (!cave) return null;
    cavesSeen.add(cave);
    return { x: cave.entrance.x, z: cave.entrance.z };
  };
  const entered = new Set<Entrance>(); // likewise, the buildings stepped into
  const herbalists = new Set<Entrance>(); // and the herbalists' houses
  const STYLE_NAMES: Record<HairStyle, string> = {
    short: 'Short',
    long: 'Long',
    cropped: 'Cropped',
    bald: 'Bald',
    braid: 'Braid',
    bun: 'Bun',
    ponytail: 'Ponytail',
    twinBraids: 'Twin braids',
    crownBraid: 'Crown braid',
    waves: 'Loose waves',
    pigtails: 'Pigtails',
    bob: 'Bob',
    topknot: 'Topknot',
    shaggy: 'Shaggy',
    warriorTail: 'Warrior tail',
  };
  const toggle = (get: () => boolean, set: (on: boolean) => void, on: string, off: string): Pick<MenuAction, 'run' | 'isOn'> => ({
    isOn: get,
    run: () => {
      set(!get());
      return get() ? on : off;
    },
  });

  // A run of rows under one header (`section` on the first).
  const group = (section: string, actions: MenuAction[]): MenuAction[] => actions.map((a, i) => (i === 0 ? { ...a, section } : a));
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
          ]),
          ...group('Dungeons', [
            { icon: ICON.ruin, title: 'Next crypt', detail: 'The nearest ruins you haven’t visited, their crypt in them', run: () => travel(nextRuin(model, here(), ruinsSeen), `ruins ${ruinsSeen.size} of ${model.ruins.length}`) },
            { icon: ICON.ruin, title: 'Next cave', detail: 'The nearest you haven’t visited, before its mouth', run: () => travel(nextCave(), `cave ${cavesSeen.size} of ${model.caves.length}`) },
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
        actions: [
          ...group('Body', [
            {
              icon: ICON.undress,
              title: 'Random new look',
              detail: 'Another body, face, hair and name, at random',
              run: () => {
                model.hero.look = randomLook();
                model.hero.name = randomName(model.hero.look.build);
                return `Now ${model.hero.name}.`;
              },
            },
            {
              icon: ICON.heroine,
              title: "Woman's body",
              detail: 'The hero as a woman (off: a man)',
              ...toggle(
                () => model.hero.look.build === 'female',
                (on) => (model.hero.look = on ? { ...HEROINE_LOOK } : { ...HERO_LOOK }),
                'The hero is a woman.',
                'The hero is a man.',
              ),
            },
            {
              icon: ICON.heroine,
              title: 'Next hairstyle',
              detail: 'Each click, the next style',
              current: () => ({ value: STYLE_NAMES[model.hero.look.hairStyle] }),
              run: () => {
                const styles = STYLES_OF[model.hero.look.build];
                const next = styles[(styles.indexOf(model.hero.look.hairStyle) + 1) % styles.length];
                model.hero.look = { ...model.hero.look, hairStyle: next };
                return `Hair: ${STYLE_NAMES[next]}.`;
              },
            },
          ]),
          ...group('Outfits', [
            { icon: ICON.undress, title: 'Undress', detail: 'Back to the bare body', run: () => (dress([]), 'Undressed.') },
            { icon: ICON.starterSet, title: 'Starter set', detail: 'Everything the hero starts out with', run: () => (dress(STARTER_SET), 'Wearing the starter set.') },
            { icon: ICON.banditOutfit, title: 'Bandit outfit', detail: 'Hood, vest, gloves, trousers, boots, sword', run: () => (dress(BANDIT_OUTFIT), 'Wearing the bandit outfit.') },
            { icon: ICON.bandit, title: 'Random bandit outfit', detail: 'A new mix of what bandits wear, each time', run: () => (dress(Object.values(pickOutfit('bandit', ++banditDraws, 7))), 'Dressed as a bandit.') },
          ]),
          // One row per slot: each use puts on the slot's next item (then nothing, then round again).
          ...group(
            'Each slot',
            EQUIP_SLOTS.map((slot): MenuAction => {
              const choices = [undefined, ...ITEM_IDS.filter((item) => slotOf(item) === slot)];
              const worn = () => model.hero.equipment[slot];
              return {
                title: SLOT_NAMES[slot],
                run: () => {
                  const next = choices[(choices.indexOf(worn()) + 1) % choices.length];
                  if (next) wear(model.hero.equipment, next);
                  else delete model.hero.equipment[slot];
                  return next ? `${ITEMS[next].name} on.` : `Nothing on the ${SLOT_NAMES[slot].toLowerCase()}.`;
                },
                current: () => {
                  const item = worn();
                  return { detail: item ? ITEMS[item].name : 'Nothing', icon: item ? itemIcon(item) : undefined, value: `${choices.indexOf(item)} of ${choices.length - 1}` };
                },
              };
            }),
          ),
        ],
      },
      {
        name: 'Items',
        icon: lootIcon('roughSack'),
        actions: [
          ...group('Money', [
            { icon: itemIcon('goldRing'), title: 'Add 1 gold', detail: 'Into the purse', run: () => ((model.hero.money += COPPER_PER_SILVER * SILVER_PER_GOLD), 'A gold coin, added.') },
            { icon: itemIcon('silverRing'), title: 'Add 10 silver', detail: 'Into the purse', run: () => ((model.hero.money += 10 * COPPER_PER_SILVER), 'Ten silver, added.') },
          ]),
          ...group('Into the bag', [
            {
              icon: ICON.wardrobe,
              title: 'Starter & bandit gear',
              detail: 'Both outfits, to wear from the hero sheet',
              run: () => (give([...STARTER_SET, ...BANDIT_OUTFIT]), 'Gear, in the bag.'),
            },
            { icon: lootIcon('roughSack'), title: 'Every bag', detail: 'One of each, to fit to the sockets', run: () => (give(BAG_IDS), 'One of every bag, in the bag.') },
            { icon: lootIcon('greaterHealthPotion'), title: 'Every potion', detail: 'Three of each', run: () => (give(POTION_IDS.flatMap((id) => [id, id, id])), 'Potions, in the bag.') },
            { icon: lootIcon('bread'), title: 'Every food & drink', detail: 'Five of each', run: () => (give(PROVISION_IDS.flatMap((id) => [id, id, id, id, id])), 'Food and drink, in the bag.') },
            {
              icon: lootIcon('wolfFang'),
              title: 'Fill the bag with junk',
              detail: 'Full stacks of junk in every free slot',
              run: () => {
                const junk = Object.keys(JUNK_ITEMS) as LootId[];
                for (let i = 0; slotsUsed(model.hero.bag) < bagRoom(model.hero); i++) give(Array.from({ length: JUNK_STACK }, () => junk[i % junk.length])); // (round the junk again: another full stack each)
                return 'The bag is full of junk.';
              },
            },
            { icon: ICON.undress, title: 'Empty the bag', detail: 'Everything in it gone (fitted bags stay)', run: () => (Object.assign(model.hero, { bag: {}, bagOrder: [], bagCounts: [] }), 'The bag is empty.') },
          ]),
          ...group('On the ground', [
            {
              icon: lootIcon('rustyBuckle'),
              title: 'Every loot item, around you',
              detail: 'One of each kind, on the ground in a ring',
              run: () => {
                LOOT_IDS.forEach((item, i) => {
                  const a = (i / LOOT_IDS.length) * Math.PI * 2;
                  model.dropLoot(item, model.hero.x + Math.cos(a) * 1.2, model.hero.z + Math.sin(a) * 1.2);
                });
                return 'Loot all around.';
              },
            },
          ]),
        ],
      },
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
    ['Ground', `tier ${model.heightMap[tx]?.[tz] ?? '?'} · ${model.lakeMap[tx]?.[tz] ? 'water' : (model.surfaceMap[tx]?.[tz] ?? '?')}`],
    ['Foes near', `${count('wolf')} wolves · ${count('bandit')} bandits · ${count('boar')} boars`],
    ['Nearest village', village ? `${Math.round(Math.hypot(village.x - tx, village.z - tz))} tiles` : 'none'],
    ['World', `${model.size.width}×${model.size.depth}`],
    ['Villages · camps · ruins', `${model.villages.length} · ${model.camps.length} · ${model.ruins.length}`],
    ['Bag', `${slotsUsed(hero.bag)} of ${bagRoom(hero)} slots`],
  ];
}
