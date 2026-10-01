// Crypt layouts swept over 50 seeds, two crypts each (their ruins' places
// rolled from the seed: a crypt's plan needs only the seed and its ruin),
// looking for anything wrong: the same every time; big, with side rooms and
// one great hall at the end; one crypt, no island of rock, no passage narrower
// than two; the stairs' row its edge; and what's in it never shutting the way, nor any wall off,
// nothing overlapping, everything where it belongs (cryptLayout.ts, cryptProps.ts).
import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/util/random';
import { inFullView, isFloor, planCrypt, type CryptPlan } from '../src/model/crypts/cryptLayout';
import { furnishCrypt, type CryptProp } from '../src/model/crypts/cryptProps';
import { FACINGS } from '../src/model/map/grid';
import { floorReached, rockJoined } from './support/cryptChecks';

const seeds = Array.from({ length: 50 }, (_, i) => Math.floor(mulberry32(7000 + i)() * 2 ** 31));
const ruinsOf = (seed: number) => {
  const rng = mulberry32(seed ^ 0x51ed);
  return [0, 1].map(() => ({ x: 20 + Math.floor(rng() * 1900), z: 20 + Math.floor(rng() * 1900) }));
};

// Floor reached from the foot of the stairs, round `solid` tiles: how many.
const reach = (plan: CryptPlan, solid: ReadonlySet<string> = new Set()): number => floorReached(plan, solid).size;

// What's wrong with a crypt's plan and what's in it (nothing: an empty list).
function problemsOf(plan: CryptPlan, props: readonly CryptProp[]): string[] {
  const problems: string[] = [];
  const say = (problem: string) => problems.length < 12 && problems.push(problem);
  const tiles = plan.floor.reduce((a, b) => a + b, 0);
  const kinds = plan.places.map((p) => p.kind);
  if (tiles < 400) say(`small: ${tiles} tiles`);
  if (kinds.filter((k) => k === 'great').length !== 1) say(`${kinds.filter((k) => k === 'great').length} great halls`);
  if (kinds.filter((k) => k === 'side').length < 3) say(`${kinds.filter((k) => k === 'side').length} side rooms`);
  if (plan.width > 250 || plan.depth > 250) say(`huge: ${plan.width} x ${plan.depth}`);
  if (!isFloor(plan, plan.door, plan.depth - 1)) say('no floor at the foot of the stairs');
  // The edges: rock all round but the stairs' row.
  for (let x = 0; x < plan.width; x++) if (isFloor(plan, x, 0)) say(`floor on the far edge at ${x}`);
  for (let z = 0; z < plan.depth; z++) if (isFloor(plan, 0, z) || isFloor(plan, plan.width - 1, z)) say(`floor on a side edge at ${z}`);
  // One crypt; no island of rock.
  if (reach(plan) !== tiles) say(`floor cut off: ${tiles - reach(plan)} tiles`);
  const rock = rockJoined(plan);
  if (rock + tiles !== plan.width * plan.depth) say(`${plan.width * plan.depth - rock - tiles} tiles of rock islanded`);
  // No sliver: every floor tile in some 2 x 2 of floor.
  for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) {
    if (!isFloor(plan, x, z)) continue;
    const wide = [[0, 0], [-1, 0], [0, -1], [-1, -1]].some(([dx, dz]) => isFloor(plan, x + dx, z + dz) && isFloor(plan, x + dx + 1, z + dz) && isFloor(plan, x + dx, z + dz + 1) && isFloor(plan, x + dx + 1, z + dz + 1));
    if (!wide) say(`a sliver of floor at ${x},${z}`);
  }
  // What's in it.
  const solid = new Set<string>();
  const onFloor = new Map<string, string>();
  for (const p of props) {
    if (p.kind === 'sconce' || p.kind === 'niche') {
      const [ox, oz] = FACINGS[p.facing];
      if (isFloor(plan, p.x, p.z) || !isFloor(plan, p.x + ox, p.z + oz) || !inFullView(plan, p.x, p.z)) say(`${p.kind} misplaced at ${p.x},${p.z}`);
      continue;
    }
    for (let x = p.x; x < p.x + p.w; x++) for (let z = p.z; z < p.z + p.d; z++) {
      const k = `${x},${z}`;
      if (!isFloor(plan, x, z)) say(`${p.kind} in the rock at ${k}`);
      if (p.solid) solid.add(k);
      if (p.kind === 'dais' || p.kind === 'cobweb') continue; // (under, or over, what else is there)
      if (onFloor.has(k)) say(`${p.kind} on ${onFloor.get(k)} at ${k}`);
      onFloor.set(k, p.kind);
    }
  }
  if (reach(plan, solid) !== tiles - solid.size) say('the way shut by something solid');
  // Every wall walked up to: each tile of rock beside the floor with open floor reached from the stairs
  // right by it (diagonally too: an urn against a wall is fine, the rock beside it in reach; a row of them not).
  const reached = floorReached(plan, solid);
  const around = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  for (let x = 0; x < plan.width; x++) for (let z = 0; z < plan.depth; z++) {
    if (isFloor(plan, x, z) || !around.slice(0, 4).some(([dx, dz]) => isFloor(plan, x + dx, z + dz))) continue;
    if (!around.some(([dx, dz]) => reached.has(`${x + dx},${z + dz}`))) say(`the wall at ${x},${z} can't be got to`);
  }
  const dais = props.find((p) => p.kind === 'dais');
  const great = props.find((p) => p.kind === 'greatSarcophagus');
  if (!dais || !great) say('no dais, or no great sarcophagus');
  else if (great.x < dais.x || great.z < dais.z || great.x + great.w > dais.x + dais.w || great.z + great.d > dais.z + dais.d) say('the great sarcophagus off its dais');
  if (!props.some((p) => p.kind === 'sconce') || !props.some((p) => p.kind === 'candles')) say('no lights');
  return problems;
}

describe('crypts on 50 seeds, two each', () => {
  for (const seed of seeds) {
    it(`seed ${seed}`, () => {
      for (const ruin of ruinsOf(seed)) {
        const plan = planCrypt(seed, ruin);
        const props = furnishCrypt(seed, ruin, plan);
        expect(planCrypt(seed, ruin), 'the same every time').toEqual(plan);
        expect(furnishCrypt(seed, ruin, plan), 'the same every time').toEqual(props);
        expect(problemsOf(plan, props), `the crypt at ${ruin.x},${ruin.z}`).toEqual([]);
      }
    });
  }
});
