// QA: a monkey at the keys (model/GameModel.ts, whole): minutes of play, every frame something done at random (walking
// any way, a blow, a roll, the guard up and down, E: picking up, sitting, a door; eating, wearing, dropping; chopping,
// making), now and then a frame of no time or a long one. Every second, the hero as the game needs them: on the map,
// health and energy within their most, a whole purse never below nothing, what they carry in whole numbers, what they
// wear in the slot it goes in, each skill within its range; and never a fall over. Rolled from seeds: any failure plays
// again.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { maxEnergyOf, maxHpOf } from '../src/model/hero/attributes';
import { slotOfGear, type GearKey } from '../src/model/human/items/gear';
import { SKILL_IDS, SKILL_MAX } from '../src/model/skills/skills';
import { RECIPE_IDS } from '../src/model/skills/woodworking';
import type { BagItem } from '../src/model/hero/bag';
import { isLootItem } from '../src/model/hero/bag';
import { mulberry32, oneOf } from '../src/util/random';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

const SECONDS = Number(process.env.QA_SECONDS ?? 240);
const FRAME = 1 / 30;

function unsound(model: GameModel): string | null {
  const h = model.hero;
  const finite = (...v: number[]) => v.every(Number.isFinite);
  if (!finite(h.x, h.z, h.y, h.facing)) return `position ${h.x},${h.z},${h.y}`;
  if (!model.inside && (h.x < 0 || h.z < 0 || h.x > model.size.width || h.z > model.size.depth)) return `off the map at ${h.x},${h.z}`;
  if (!finite(h.hp) || h.hp < 0 || h.hp > maxHpOf(h) + 1e-6) return `health ${h.hp} of ${maxHpOf(h)}`;
  if (!finite(h.energy) || h.energy < 0 || h.energy > maxEnergyOf(h) + 1e-6) return `energy ${h.energy} of ${maxEnergyOf(h)}`;
  if (!Number.isInteger(h.money) || h.money < 0) return `money ${h.money}`;
  for (const [item, n] of Object.entries(h.bag)) if (!Number.isInteger(n) || (n as number) < 1) return `bag ${item} × ${n}`;
  for (const [slot, item] of Object.entries(h.equipment)) if (item && slotOfGear(item) !== slot) return `${item} worn in ${slot}`;
  for (const id of SKILL_IDS) {
    const level = h.skills?.[id]?.level ?? 1;
    if (!Number.isInteger(level) || level < 1 || level > SKILL_MAX) return `${id} ${level}`;
  }
  return null;
}

// A game played at random for SECONDS: what went wrong, if anything (and when).
function monkey(seed: number): string | null {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const rng = mulberry32(seed * 7 + 1);
  Object.assign(model.hero, { money: 200 });
  model.hero.bag = { ale: 2, birchLog: 6, wolfFang: 2, leatherCap: 1, hatchet: 1 } as never;
  let dir: [number, number] = [0, 0];
  for (let t = 0, second = 0; t < SECONDS; ) {
    const r = rng();
    try {
      if (r < 0.04) dir = rng() < 0.2 ? [0, 0] : [Math.sin(rng() * 7), Math.cos(rng() * 7)];
      else if (r < 0.06) model.startAttack();
      else if (r < 0.065) model.roll(dir[0] || 1, dir[1]);
      else if (r < 0.07) model.raiseGuard(rng() < 0.5);
      else if (r < 0.08) [model.pickUp(), model.sitOrStand()];
      else if (r < 0.083) model.useDoor();
      else if (r < 0.086) {
        const items = Object.keys(model.hero.bag) as BagItem[];
        const item = items.length ? oneOf(items, rng()) : null;
        if (item && isLootItem(item)) [model.consume(item), model.dropFromBag(item)];
        else if (item) model.equipFromBag(item as GearKey);
      } else if (r < 0.088) model.dropEquipped(oneOf(['head', 'mainHand', 'torso'] as const, rng()));
      else if (r < 0.091) model.lumber.use();
      else if (r < 0.093) model.woodworking.start(oneOf(RECIPE_IDS, rng()), 1 + Math.floor(rng() * 3));
      else if (r < 0.094) model.fall();
      const dt = r > 0.998 ? 0 : r > 0.996 ? 0.5 : FRAME; // (now and then a frame of no time, or a long one)
      model.update(dir[0], dir[1], dt);
      model.takeEvents();
      t += dt;
    } catch (e) {
      return `at ${t.toFixed(1)} s: fell over (${(e as Error).stack?.split('\n').slice(0, 3).join(' | ')})`;
    }
    if (t >= second) {
      second += 1;
      const wrong = unsound(model);
      if (wrong) return `at ${t.toFixed(1)} s: ${wrong}`;
    }
  }
  return null;
}

describe('a monkey at the keys', () => {
  for (const seed of TEST_SEEDS.slice(0, 3)) {
    it(`plays ${SECONDS} s at random (seed ${seed}) with the hero sound throughout, never falling over`, () => {
      expect(monkey(seed)).toBeNull();
    }, 300_000);
  }
});
