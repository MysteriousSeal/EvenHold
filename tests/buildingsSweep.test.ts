import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { spawnOf } from '../src/model/map/grid';
import { bumpsFurniture } from '../src/model/interiors/furniture';
import { HERO_RADIUS, INDOOR_SCALE } from '../src/model/constants';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// Open tiles the hero can walk to from where they start.
function reachable(model: GameModel): Set<string> {
  const seen = new Set<string>();
  const start = spawnOf(model.size);
  const todo: Array<[number, number]> = [[start.x, start.z]];
  while (todo.length > 0) {
    const [x, z] = todo.pop()!;
    const k = `${x},${z}`;
    if (seen.has(k) || !model.isOpenTile(x, z)) continue;
    seen.add(k);
    todo.push([x + 1, z], [x - 1, z], [x, z + 1], [x, z - 1]);
  }
  return seen;
}

describe('every building in every test world', () => {
  for (const seed of TEST_SEEDS) {
    it(`can be walked to, gone into and come out of (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      const open = reachable(model);
      const problems: string[] = [];
      for (const [i, door] of model.entrances.entries()) {
        const at = `${door.type} ${i} at ${door.x.toFixed(1)},${door.z.toFixed(1)}`;
        if (model.isBlocked(door.x + door.outX * 0.4, door.z + door.outZ * 0.4, HERO_RADIUS)) problems.push(`${at}: blocked just past its doorstep`);
        if (!open.has(`${Math.round(door.x)},${Math.round(door.z)}`)) problems.push(`${at}: not to be walked to from the start`);
        model.teleport(door.x, door.z);
        if (!model.useDoor()) {
          problems.push(`${at}: its door won't open`);
          continue;
        }
        const inside = model.inside!;
        if (inside.entrance !== door) problems.push(`${at}: into another building`);
        if (bumpsFurniture(inside.furniture, model.hero.x, model.hero.z, HERO_RADIUS * INDOOR_SCALE)) problems.push(`${at}: stepped in onto furniture`);
        if (!model.useDoor()) {
          problems.push(`${at}: can't get out`);
          continue;
        }
        // Out on the doorstep (just past the building's edge): a few steps away from the door.
        const [x0, z0] = [model.hero.x, model.hero.z];
        for (let t = 0; t < 0.3; t += 1 / 30) model.update(door.outX, door.outZ, 1 / 30);
        if (Math.hypot(model.hero.x - x0, model.hero.z - z0) < 0.3) problems.push(`${at}: stuck on its doorstep`);
      }
      expect(problems).toEqual([]);
    });

    it(`has every villager's home, and the inns (barmaids, a bouncer) and smithies staffed (seed ${seed})`, () => {
      const model = new GameModel(seed, TEST_MAP_SIZE);
      for (const npc of model.npcs) {
        expect(model.entrances).toContain(npc.home);
        if (npc.inn) expect(npc.inn.type).toBe('inn');
        const kind = { villager: 'house', barkeep: 'inn', server: 'inn', smith: 'smithy', bouncer: 'inn', herbalist: 'house' }[npc.role];
        expect(npc.home.type, `${npc.name} (${npc.role})`).toBe(kind);
      }
      for (const inn of model.entrances.filter((e) => e.type === 'inn')) {
        for (const role of ['barkeep', 'server', 'bouncer'] as const) expect(model.npcs.filter((n) => n.role === role && n.home === inn)).toHaveLength(1);
      }
      for (const smithy of model.entrances.filter((e) => e.type === 'smithy')) expect(model.npcs.filter((n) => n.role === 'smith' && n.home === smithy)).toHaveLength(1);
    });
  }
});
