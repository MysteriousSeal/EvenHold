// The fighter's arena (tests/ai/arena.ts), kept working as the game changes: a fight the same every time from its
// seed; what's seen always its fixed size; damage dealt paid, and the fight won once its foes are down; the watch
// page's way (the same game, fight after fight, cleared between) as good as a fresh one; and a decision made, played
// out a frame at a time and settled, the same as one step.
import { describe, expect, it } from 'vitest';
import { Arena, FRAME, FRAMES_PER_DECISION, NAMED_FIGHTS, OBSERVATION_SIZE } from './ai/arena';

// Straight at the nearest foe, a blow once close (the bots' way, evaluate.ts).
const charge = (o: number[]): [number, number] => {
  if (o[17] === 0) return [0, 0];
  const way = 1 + ((Math.round(Math.atan2(o[18], o[19]) / (Math.PI / 4)) + 8) % 8);
  return o[21] ? [0, 1] : [way, 0];
};

const fightOut = (arena: Arena, first: number[]) => {
  let observation = first;
  let paid = 0;
  for (let n = 0; n < 500; n++) {
    const step = arena.step(...charge(observation));
    expect(step.observation).toHaveLength(OBSERVATION_SIZE);
    paid += step.reward;
    if (step.done || step.truncated) return { ...step.info, paid };
    observation = step.observation;
  }
  throw new Error('a fight that never ended');
};

describe("the fighter's arena", () => {
  it('plays a fight the same every time from its seed, what it sees always its size', () => {
    const [a, b] = [new Arena(), new Arena()];
    const [first, again] = [a.reset(7, NAMED_FIGHTS[0]), b.reset(7, NAMED_FIGHTS[0])];
    expect(first).toHaveLength(OBSERVATION_SIZE);
    expect(again).toEqual(first);
    expect(fightOut(a, first)).toEqual(fightOut(b, again));
  });

  it('pays for damage dealt and a fight won (a lone wolf, charged at)', () => {
    const arena = new Arena();
    const result = fightOut(arena, arena.reset(3, NAMED_FIGHTS[0]));
    expect(result.won).toBe(true);
    expect(result.dealt).toBeGreaterThan(0);
    expect(result.paid).toBeGreaterThan(1);
  });

  it("the watch page's way: the same game, fight after fight, cleared between", () => {
    const arena = new Arena();
    arena.reset(1, NAMED_FIGHTS[1], true);
    const game = arena.model;
    arena.reset(2, NAMED_FIGHTS[3], true);
    expect(arena.model).toBe(game);
    expect(arena.model.enemies.map((e) => e.kind)).toEqual(NAMED_FIGHTS[3].foes.map((f) => f.kind));
    expect(arena.model.groundHere.loot).toEqual([]);
  });

  it('a decision played out a frame at a time and settled, the same as one step', () => {
    const [a, b] = [new Arena(), new Arena()];
    const [oa, ob] = [a.reset(5, NAMED_FIGHTS[3]), b.reset(5, NAMED_FIGHTS[3])];
    const one = a.step(...charge(oa));
    b.decide(...charge(ob));
    for (let f = 0; f < FRAMES_PER_DECISION; f++) b.advance(FRAME);
    expect(b.settle()).toEqual(one);
  });
});
