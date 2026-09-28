// Dev-only cheat menu (travel, hero powers, enemies, the wardrobe, world
// facts), toggled with the backquote key (`), built on the shared EvenHold
// menu (view/ui/menu.ts). The game pauses while it's open.
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
import { gainXp, maxHpAt, xpToNext } from '../../model/heroStats';
import { LOOT_IDS } from '../../model/loot/loot';
import { createMenu, type MenuAction } from '../../view/ui/menu';
import { ICONS as ICON, itemIcon } from './cheatIcons';

const SPEED_BOOST = 3;
const NEARBY = 15; // tiles, for "nearby foes"

export interface CheatPanelHooks {
  setPaused(paused: boolean): void;
}

export function createCheatPanel(model: GameModel, hooks: CheatPanelHooks): void {
  const here = (): Tile => ({ x: model.hero.x, z: model.hero.z });
  const travel = (tile: Tile | null, where: string) => {
    if (!tile) return `There's no ${where} in this world.`;
    model.teleport(tile.x, tile.z);
    return `Travelled to ${where}.`;
  };
  let banditDraws = 0; // for "Random bandit": a new outfit each time
  // Replaces everything the hero wears with `items`.
  const dress = (items: readonly ItemId[]) => {
    for (const slot of EQUIP_SLOTS) delete model.hero.equipment[slot];
    for (const item of items) wear(model.hero.equipment, item);
  };
  const visited = new Set<Village>(); // the village tour: nearest first, no repeats
  const toggle = (get: () => boolean, set: (on: boolean) => void, on: string, off: string): Pick<MenuAction, 'run' | 'isOn'> => ({
    isOn: get,
    run: () => {
      set(!get());
      return get() ? on : off;
    },
  });

  createMenu({
    title: 'Cheats',
    toggleKey: 'Backquote',
    onOpenChange: (open) => hooks.setPaused(open),
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
