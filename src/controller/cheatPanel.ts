// Dev-only cheat menu, toggled with the backquote key (`), built on the
// shared EvenHold menu (view/ui/menu.ts). The game pauses while it's open.
// main.ts loads this module only when Vite runs in dev mode, so production
// builds don't contain it.

import type { GameModel } from '../model/GameModel';
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
} from '../model/cheats';
import type { Village } from '../model/types';
import { createMenu, type MenuAction } from '../view/ui/menu';

const SPEED_BOOST = 3;
const NEARBY = 15; // tiles, for "nearby foes"

// Pixel-art icons (8x8, '.' empty) and their colors, in the game's palette.
const PALETTE: Record<string, string> = {
  k: '#2e1f14', r: '#a4502f', R: '#c26a45', w: '#f3e3c4', y: '#ffd98a', b: '#3dbdb8', B: '#217c98',
  g: '#62ad4c', G: '#3e7a34', s: '#f0c49a', h: '#6b4226', c: '#e8dcc0', i: '#d0d5dc', I: '#8a9098',
  t: '#5a3a22', f: '#80838b', F: '#5d6068', m: '#c9b89a', o: '#ffa940',
};
const ICON = {
  map: ['kkkkkkkk', 'kwwgwwbk', 'kwggwbbk', 'kwwwrwwk', 'kwgwwwgk', 'kbbwwggk', 'kwwwwwwk', 'kkkkkkkk'],
  hero: ['..hhhh..', '.hsssh..', '.skskk..', '.sssss..', '..ccc...', '.scccs..', '..c.c...', '..s.s...'],
  sword: ['......ik', '.....iI.', '....iI..', '...iI...', 't.iI....', '.tI.....', '.kt.....', 'k..t....'],
  scroll: ['.kkkkkk.', 'kwwwwwwk', '.wkkkwk.', '.wwwwwk.', '.wkkwk..', '.wwwwk..', 'kwwwwwwk', '.kkkkkk.'],
  village: ['...rR...', '..rRRr..', '.rRRRRr.', 'rRRRRRRr', '.wwtwww.', '.wytwyw.', '.wwttww.', '.wwttww.'],
  lake: ['...b....', '...b....', '..bbb...', '..bbbb..', '.bbbbbB.', '.bbbbbB.', '..bbbB..', '...BB...'],
  camp: ['...r....', '..rRr...', '..rRr...', '.rRkRr..', '.rRkRr..', 'rRRkRRr.', '...o....', '..ooo...'],
  paw: ['.f..f...', 'fF.fF...', '........', 'f.ff.f..', '.ffff...', '.ffff...', '..ff....', '........'],
  flag: ['.tRRRR..', '.tRRRRR.', '.tRrRRR.', '.tRRRRR.', '.tRR....', '.t......', '.t......', 'gggggggg'],
  boot: ['c.......', 'cc......', 'ic......', '..t.hhh.', '...hhhh.', '..hhhhh.', '.tttttt.', '.kkkkkk.'],
  ghost: ['..wwww..', '.wwwwww.', '.wkwwkw.', '.wwwwww.', '.wwkkww.', '.wwwwww.', '.wwwwww.', '.w.ww.w.'],
  shield: ['.IIIIII.', '.IbbbbI.', '.IbBbbI.', '.IbbbbI.', '.IbbbbI.', '..IbbI..', '..IbbI..', '...II...'],
  wolf: ['.f....f.', '.ff..ff.', '.ffffff.', 'fyffyff.', 'fffffff.', '.ffffkf.', '..ffff..', '...ff...'],
  bandit: ['..hhhh..', '.hhhhhh.', '.hskskh.', '.hkkkkh.', '.hkkkkh.', '..hhhh..', '.tttttt.', 'tttttttt'],
  skull: ['..cccc..', '.cccccc.', 'ckkcckkc', 'ckkcckkc', '.cccccc.', '..ckkc..', '..cccc..', '..c..c..'],
  frost: ['...b....', '.b.b.b..', '..bbb...', 'bbbBbbb.', '..bbb...', '.b.b.b..', '...b....', '........'],
};

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
    palette: PALETTE,
    toggleKey: 'Backquote',
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [
      {
        name: 'Travel',
        icon: ICON.map,
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
          { icon: ICON.paw, title: 'Wolf pack', detail: 'A few paces from the nearest wolves', run: () => travel(nearestPack(model, here()), 'a wolf pack') },
          { icon: ICON.flag, title: 'Back to spawn', detail: 'Where the journey began', run: () => travel(spawnTile(model), 'spawn') },
        ],
      },
      {
        name: 'Hero',
        icon: ICON.hero,
        actions: [
          {
            icon: ICON.boot,
            title: 'Swift feet',
            detail: `Walk ${SPEED_BOOST}× faster`,
            ...toggle(() => model.speedMultiplier !== 1, (on) => (model.speedMultiplier = on ? SPEED_BOOST : 1), 'Swift feet on.', 'Swift feet off.'),
          },
          { icon: ICON.ghost, title: 'Walk through anything', detail: 'Walls, water and foes', ...toggle(() => model.noclip, (on) => (model.noclip = on), 'Walking through anything.', 'The world is solid again.') },
          { icon: ICON.shield, title: 'Invulnerable', detail: 'For when foes can hurt you', ...toggle(() => model.godMode, (on) => (model.godMode = on), 'Invulnerable.', 'Vulnerable again.') },
        ],
      },
      {
        name: 'Enemies',
        icon: ICON.sword,
        actions: [
          { icon: ICON.wolf, title: 'Summon a wolf', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'wolf'), 'A wolf appears.') },
          { icon: ICON.bandit, title: 'Summon a bandit', detail: 'Appears just ahead of you', run: () => (spawnEnemyNear(model, 'bandit'), 'A bandit appears.') },
          { icon: ICON.skull, title: 'Slay nearby foes', detail: `Everything within ${NEARBY} tiles`, run: () => `${slayNearby(model, NEARBY)} foes slain.` },
          { icon: ICON.frost, title: 'Freeze foes', detail: 'Enemies stand still', ...toggle(() => model.enemiesFrozen, (on) => (model.enemiesFrozen = on), 'Foes frozen.', 'Foes move again.') },
        ],
      },
      {
        name: 'World',
        icon: ICON.scroll,
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
          ];
        },
      },
    ],
  });
}
