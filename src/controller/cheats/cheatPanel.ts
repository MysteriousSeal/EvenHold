// Dev-only cheat menu (travel, hero powers, enemies, the wardrobe, world
// facts), toggled with the backquote key (`), built on the shared EvenHold
// menu (view/ui/menu.ts). The game keeps running while it's open, so a
// teleport or a summon shows at once.
// main.ts loads this module only when Vite runs in dev mode, so production
// builds don't contain it.

import type { GameModel } from '../../model/GameModel';
import {
  nearestCamp,
  nearestLakeShore,
  nearestPack,
  nextVillage,
  slayNearby,
  spawnEnemyNear,
  spawnTile,
  villageEntrance,
  enterNearest,
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
import { gainXp, maxHpAt, xpToNext } from '../../model/heroStats';
import { LOOT_IDS } from '../../model/loot/loot';
import { addToBag } from '../../model/bag';
import { createMenu, type Menu, type MenuAction } from '../../view/ui/menu';
import { HEROINE_LOOK, ICONS as ICON, itemIcon } from './cheatIcons';
import { HERO_LOOK, STYLES_OF, type HairStyle } from '../../model/human/humanoid';

const SPEED_BOOST = 3;
const NEARBY = 15; // tiles, for "nearby foes"

export function createCheatPanel(model: GameModel): void {
  const here = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  // Teleports there and closes the menu, so the new place is seen at once.
  const travel = (tile: Tile | null, where: string) => {
    if (!tile) return `There's no ${where} in this world.`;
    model.teleport(tile.x, tile.z);
    menu.close();
    return `Travelled to ${where}.`;
  };
  let banditDraws = 0; // for "Random bandit": a new outfit each time
  // Replaces everything the hero wears with `items`.
  const dress = (items: readonly ItemId[]) => {
    for (const slot of EQUIP_SLOTS) delete model.hero.equipment[slot];
    for (const item of items) wear(model.hero.equipment, item);
  };
  const visited = new Set<Village>(); // the village tour: nearest first, no repeats
  const entered = new Set<Entrance>(); // likewise, the buildings stepped into
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
  };
  const toggle = (get: () => boolean, set: (on: boolean) => void, on: string, off: string): Pick<MenuAction, 'run' | 'isOn'> => ({
    isOn: get,
    run: () => {
      set(!get());
      return get() ? on : off;
    },
  });

  const menu: Menu = createMenu({
    title: 'Cheats',
    toggleKey: 'Backquote',
    tabs: [
      {
        name: 'Travel',
        icon: ICON.travel,
        actions: [
          {
            icon: ICON.village,
            title: 'Next village',
            detail: 'The nearest one you haven’t visited',
            run: () => {
              const village = nextVillage(model, here(), visited);
              return travel(village && villageEntrance(model, village, here()), `village ${visited.size} of ${model.villages.length}`);
            },
          },
          { icon: ICON.lake, title: 'Nearest lake', detail: 'Stand on the closest shore', run: () => travel(nearestLakeShore(model, here()), 'the lake shore') },
          { icon: ICON.camp, title: 'Bandit camp', detail: 'Just outside the nearest gate', run: () => travel(nearestCamp(model, here()), 'a bandit camp') },
          { icon: ICON.wolfPack, title: 'Wolf pack', detail: 'A few paces from the nearest wolves', run: () => travel(nearestPack(model, here()), 'a wolf pack') },
          ...(['house', 'inn', 'smithy'] as const).map(
            (type): MenuAction => ({
              icon: ICON.village,
              title: `Inside ${type === 'house' ? 'a house' : type === 'inn' ? 'the inn' : 'a smithy'}`,
              detail: 'The nearest one you haven’t visited',
              run: () => {
                if (!enterNearest(model, type, entered)) return `There's no ${type} in this world.`;
                menu.close();
                return `Inside the ${type}.`;
              },
            }),
          ),
          { icon: ICON.spawn, title: 'Back to spawn', detail: 'Where the journey began', run: () => travel(spawnTile(model), 'spawn') },
        ],
      },
      {
        name: 'Hero',
        icon: ICON.hero,
        actions: [
          { icon: ICON.hero, title: 'Heal', detail: 'Back to full health', run: () => ((model.hero.hp = maxHpAt(model.hero.level)), 'Healed.') },
          {
            icon: ICON.starterSet,
            title: 'Gain a level',
            detail: 'Just enough experience for the next',
            run: () => (gainXp(model.hero, xpToNext(model.hero.level) - model.hero.xp), `Level ${model.hero.level}.`),
          },
          {
            icon: ICON.heroine,
            title: 'A woman',
            detail: 'The hero in a woman\'s body',
            ...toggle(
              () => model.hero.look.build === 'female',
              (on) => (model.hero.look = on ? { ...HEROINE_LOOK } : { ...HERO_LOOK }),
              'The hero is a woman.',
              'The hero is a man.',
            ),
          },
          {
            icon: ICON.heroine,
            title: 'Hairstyle',
            detail: 'Each click, the next style',
            current: () => ({ value: STYLE_NAMES[model.hero.look.hairStyle] }),
            run: () => {
              const styles = STYLES_OF[model.hero.look.build];
              const next = styles[(styles.indexOf(model.hero.look.hairStyle) + 1) % styles.length];
              model.hero.look = { ...model.hero.look, hairStyle: next };
              return `Hair: ${STYLE_NAMES[next]}.`;
            },
          },
          { icon: itemIcon('goldRing'), title: 'Add 1 gold', detail: 'Into the purse', run: () => ((model.hero.money += 10_000), 'A gold coin, added.') },
          { icon: itemIcon('silverRing'), title: 'Add 10 silver', detail: 'Into the purse', run: () => ((model.hero.money += 1_000), 'Ten silver, added.') },
          {
            icon: ICON.swiftFeet,
            title: 'Swift feet',
            detail: `Walk ${SPEED_BOOST}× faster`,
            ...toggle(() => model.speedMultiplier !== 1, (on) => (model.speedMultiplier = on ? SPEED_BOOST : 1), 'Swift feet on.', 'Swift feet off.'),
          },
          { icon: ICON.noclip, title: 'Walk through anything', detail: 'Walls, water and foes', ...toggle(() => model.noclip, (on) => (model.noclip = on), 'Walking through anything.', 'The world is solid again.') },
          { icon: ICON.invulnerable, title: 'Invulnerable', detail: "Foes' blows don't hurt", ...toggle(() => model.godMode, (on) => (model.godMode = on), 'Invulnerable.', 'Vulnerable again.') },
        ],
      },
      {
        name: 'Enemies',
        icon: ICON.enemies,
        actions: [
          { icon: ICON.wolf, title: 'Summon a wolf', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'wolf'), 'A wolf appears.') },
          { icon: ICON.bandit, title: 'Summon a bandit', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'bandit'), 'A bandit appears.') },
          {
            icon: ICON.camp,
            title: 'Scatter junk',
            detail: 'One of every junk item around you',
            run: () => {
              LOOT_IDS.forEach((item, i) => {
                const a = (i / LOOT_IDS.length) * Math.PI * 2;
                model.dropLoot(item, model.hero.x + Math.cos(a) * 1.2, model.hero.z + Math.sin(a) * 1.2);
              });
              return 'Junk everywhere.';
            },
          },
          { icon: ICON.slay, title: 'Slay nearby foes', detail: `Everything within ${NEARBY} tiles`, run: () => `${slayNearby(model, NEARBY)} foes slain.` },
          { icon: ICON.freeze, title: 'Freeze foes', detail: 'Enemies stand still', ...toggle(() => model.enemiesFrozen, (on) => (model.enemiesFrozen = on), 'Foes frozen.', 'Foes move again.') },
        ],
      },
      {
        name: 'Wardrobe',
        icon: ICON.wardrobe,
        actions: [
          { icon: ICON.undress, title: 'Undress', detail: 'Back to the bare body', run: () => (dress([]), 'Undressed.') },
          {
            icon: ICON.wardrobe,
            title: 'Gear in the bag',
            detail: 'The starter set and the bandit outfit, to wear from the hero sheet',
            run: () => {
              for (const item of [...STARTER_SET, ...BANDIT_OUTFIT]) addToBag(model.hero.bag, item);
              return 'Your bag is full of gear.';
            },
          },
          { icon: ICON.starterSet, title: 'Starter set', detail: 'Everything the hero starts out with', run: () => (dress(STARTER_SET), 'Wearing the starter set.') },
          { icon: ICON.banditOutfit, title: 'Bandit outfit', detail: 'Hood, vest, gloves, trousers, boots, sword', run: () => (dress(BANDIT_OUTFIT), 'Wearing the bandit outfit.') },
          {
            icon: ICON.bandit,
            title: 'Random bandit',
            detail: 'A new mix of what bandits wear, each time',
            run: () => (dress(Object.values(pickOutfit('bandit', ++banditDraws, 7))), 'Dressed as a bandit.'),
          },
          // One row per slot: each use puts on the slot's next item (then nothing, then round again).
          ...EQUIP_SLOTS.map((slot): MenuAction => {
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
                return {
                  detail: item ? ITEMS[item].name : 'Nothing',
                  icon: item ? itemIcon(item) : undefined,
                  value: `${choices.indexOf(item)} of ${choices.length - 1}`,
                };
              },
            };
          }),
        ],
      },
      {
        name: 'World',
        icon: ICON.world,
        facts: () => {
          const { hero } = model;
          const tx = Math.round(hero.x);
          const tz = Math.round(hero.z);
          const near = model.enemies.filter((e) => e.state !== 'dead' && Math.hypot(e.x - hero.x, e.z - hero.z) <= NEARBY);
          const village = model.villages.reduce<Village | null>(
            (best, v) => (!best || Math.hypot(v.x - tx, v.z - tz) < Math.hypot(best.x - tx, best.z - tz) ? v : best),
            null,
          );
          return [
            ['Seed', String(model.seed)],
            ['Position', `${hero.x.toFixed(1)}, ${hero.z.toFixed(1)}`],
            ['Ground', `tier ${model.heightMap[tx]?.[tz] ?? '?'} · ${model.lakeMap[tx]?.[tz] ? 'water' : (model.surfaceMap[tx]?.[tz] ?? '?')}`],
            ['Foes near', `${near.filter((e) => e.kind === 'wolf').length} wolves · ${near.filter((e) => e.kind === 'bandit').length} bandits`],
            ['Nearest village', village ? `${Math.round(Math.hypot(village.x - tx, village.z - tz))} tiles` : 'none'],
            ['World', `${model.size.width}×${model.size.depth}`],
            ['Villages · camps', `${model.villages.length} · ${model.camps.length}`],
            ['In the bag', `${Object.values(model.hero.bag).reduce((n, c) => n + (c ?? 0), 0)} items`],
          ];
        },
      },
    ],
  });
}
