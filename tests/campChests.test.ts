// @vitest-environment happy-dom
// Every bandit camp has its chest, every camp of a dozen worlds (some two
// hundred and fifty): one loot piece, inside its palisade, on a tile no other
// piece shares; solid where it stands (the rug round it walked over); drawn,
// its chest shut or open and its gold glowing; and to be walked up to from the camp's gate,
// in on open ground (never through the palisade, nor anything standing).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { buildCampGeometry } from '../src/view/meshes/camp/campMesh';
import { chestGeometry } from '../src/view/meshes/camp/campChests';
import type { Camp } from '../src/model/camps/camps';

const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);
const SIZE = { width: 256, depth: 256 };
const worlds = SEEDS.map((seed) => new GameModel(seed, SIZE));
const each = (check: (model: GameModel, camp: Camp, at: string) => void) => {
  let camps = 0;
  for (const model of worlds) for (const [i, camp] of model.camps.entries()) [check(model, camp, `seed ${model.seed}, camp ${i} at ${camp.x},${camp.z}`), camps++];
  expect(camps).toBeGreaterThan(150);
};

// Whether a walker can go from tile a to tile b beside it (each a step along the way not blocked).
const step = (model: GameModel, a: { x: number; z: number }, b: { x: number; z: number }) =>
  [0.25, 0.5, 0.75, 1].every((t) => !model.isBlocked(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t, 0.12));

describe('every bandit camp has its chest', () => {
  it('one loot piece, inside its palisade, on a tile of its own', () => {
    each((_model, camp, at) => {
      const loot = camp.pieces.filter((p) => p.kind === 'loot');
      expect(loot, at).toHaveLength(1);
      const [chest] = loot;
      expect(Math.max(Math.abs(chest.x - camp.x), Math.abs(chest.z - camp.z)), at).toBeLessThanOrEqual(2);
      const sharing = camp.pieces.filter((p) => p !== chest && p.kind !== 'palisade' && p.kind !== 'gate' && p.x === chest.x && p.z === chest.z);
      expect(sharing, at).toEqual([]); // (the palisade and the gatehouse stand on tiles' edges: nothing else on its tile)
    });
  });

  it('solid where it stands; the rug round it, toward the camp\'s middle, walked over', () => {
    each((model, camp, at) => {
      const chest = camp.pieces.find((p) => p.kind === 'loot')!;
      expect(model.isBlocked(chest.x, chest.z, 0.1), at).toBe(true);
      const inward = { x: Math.sign(camp.x - chest.x) * 0.42, z: Math.sign(camp.z - chest.z) * 0.42 };
      expect(model.isBlocked(chest.x + inward.x, chest.z + inward.z, 0.06), at).toBe(false);
    });
  });

  it('drawn: its rug and the gold spilt on it aglow; its chest shut (a glint of gold under the lid) or thrown open (a coin or two left)', () => {
    for (const glowing of [false, true]) expect(buildCampGeometry('loot', glowing).getAttribute('position').count).toBeGreaterThan(0);
    for (const open of [false, true]) for (const glowing of [false, true]) expect(chestGeometry(open, glowing).getAttribute('position').count).toBeGreaterThan(0);
    expect(chestGeometry(false, false).getAttribute('position').count).not.toBe(chestGeometry(true, false).getAttribute('position').count);
  });

  it('to be walked up to from the camp\'s gate, in on open ground', () => {
    each((model, camp, at) => {
      const chest = camp.pieces.find((p) => p.kind === 'loot')!;
      const inside = (t: { x: number; z: number }) => Math.max(Math.abs(t.x - camp.x), Math.abs(t.z - camp.z)) <= 2;
      // From just outside its way in, tile to tile (only into the camp and the tile before it), to a tile beside the chest.
      const seen = new Set([`${camp.way.x},${camp.way.z}`]);
      const queue = [camp.way];
      let reached = false;
      while (queue.length && !reached) {
        const t = queue.shift()!;
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = { x: t.x + dx, z: t.z + dz };
          const key = `${n.x},${n.z}`;
          if (seen.has(key) || !inside(n) || (n.x === chest.x && n.z === chest.z) || !step(model, t, n)) continue;
          seen.add(key);
          if (Math.abs(n.x - chest.x) + Math.abs(n.z - chest.z) === 1) reached = true;
          queue.push(n);
        }
      }
      expect(reached, at).toBe(true);
    });
  });
});
