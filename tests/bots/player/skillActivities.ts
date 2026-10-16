// The trades a player takes up besides the axe (activities.ts): rocks struck for ore with a pickaxe (skills/mining.ts),
// and a line cast from a lake's shore with a rod (skills/fishing.ts). Each only with its tool in the bag (the smith
// sells a copper pick: activities.ts 'smith'; a rod's the pedlar's), each where the player's been.

import { VEINS, isRock, middleOf } from '../../../src/model/skills/mining';
import { skillOf } from '../../../src/model/skills/skills';
import type { Step } from '../botSteps';
import type { Activity, Target } from './activities';

const near = (p: { model: { hero: { x: number; z: number } } }, at: { x: number; z: number }) => Math.hypot(at.x - p.model.hero.x, at.z - p.model.hero.z);

// Struck till it's done (the strikes run out, or it's worked out), a minute at most.
const working = (start: () => boolean, busy: () => boolean): Step => {
  let [begun, t] = [false, 0];
  return (dt) => {
    if (!begun) return start() ? ((begun = true), 'run') : 'fail';
    if ((t += dt) > 60) return 'ok';
    return busy() ? 'run' : 'ok';
  };
};

export const SKILL_ACTIVITIES: Activity[] = [
  {
    id: 'mine',
    serves: { craft: 0.9, coin: 0.4, growth: 0.3 },
    traits: { industrious: 0.9, social: -0.2 },
    options: (p) => {
      const { mining, hero } = p.model;
      if (!mining.pick || p.model.inside) return [];
      const level = skillOf(hero, 'mining').level;
      const rock = p.model.scenery
        .filter(isRock)
        .filter((r) => near(p, middleOf(r)) < 60 && !mining.workedOut(r) && VEINS[mining.veinOf(r)].needs <= level && p.model.isMade(r.x, r.z))
        .sort((a, b) => near(p, middleOf(a)) - near(p, middleOf(b)))[0];
      return rock ? [{ label: `a rock (${mining.veinOf(rock)}), to strike`, at: middleOf(rock), data: rock } as Target] : [];
    },
    steps: (p, t) => [p.walk(() => t.at!, 1.2), working(() => p.model.mining.use(), () => p.model.mining.progress !== null)],
  },
  {
    id: 'fish',
    serves: { craft: 0.8, rest: 0.4, coin: 0.3 },
    traits: { industrious: 0.4, cautious: 0.3, social: -0.2 },
    options: (p) => {
      const { fishing, hero, tiles } = p.model;
      if (!fishing.rod || p.model.inside) return [];
      // The nearest bit of shore (land with a lake beside it), a ring at a time out to 40 tiles.
      const [hx, hz] = [Math.round(hero.x), Math.round(hero.z)];
      for (let r = 2; r <= 40; r += 2)
        for (let a = 0; a < 16; a++) {
          const [x, z] = [Math.round(hx + Math.cos((a * Math.PI) / 8) * r), Math.round(hz + Math.sin((a * Math.PI) / 8) * r)];
          if (!tiles.lake(x, z) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => tiles.lake(x + dx, z + dz)) && !p.model.isBlocked(x, z, 0.3)) return [{ label: 'the lakeshore, to fish', at: { x, z }, data: { x, z } }];
        }
      return [];
    },
    steps: (p, t) => {
      const at = t.data as { x: number; z: number };
      let waited = 0;
      return [
        p.walk(() => at, 0.4),
        () => {
          // Faced out over the water (the lake's side of the tile), and cast.
          const water = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => p.model.tiles.lake(at.x + dx, at.z + dz));
          if (water) p.model.hero.facing = Math.atan2(water[0], water[1]);
          return p.model.fishing.use() ? 'ok' : 'fail';
        },
        (dt) => {
          const { fishing } = p.model;
          if (fishing.biting) return fishing.use(), 'ok'; // (struck as it bites)
          return fishing.line === null || (waited += dt) > 90 ? 'ok' : 'run'; // (the line out, waiting on a bite)
        },
      ];
    },
  },
];
