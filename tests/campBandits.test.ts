import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { MAX_BANDITS, MIN_BANDITS } from '../src/model/camps/camps';

const SEEDS = Array.from({ length: 18 }, (_, i) => i + 1); // (every camp of each looked at, the far ones and the last too: some three hundred and seventy camps)
const SIZE = { width: 256, depth: 256 }; // big enough for well over ten camps a world (eleven to thirty-odd)
const CAMPS = 7; // in each, at the least (none within sixty tiles of the start: a test world is small)

describe('bandits in their camps (three to six each), every camp of eighteen worlds (some three hundred and seventy)', () => {
  it(`are each camp's own number, every one on a free tile inside its palisade`, () => {
    const problems: string[] = [];
    const counts = new Set<number>(); // (every number from three to six turning up)
    for (const seed of SEEDS) {
      const model = new GameModel(seed, SIZE);
      if (model.camps.length < CAMPS) problems.push(`seed ${seed}: only ${model.camps.length} camps`);
      for (const [i, camp] of model.camps.entries()) {
        const at = `seed ${seed}, camp ${i} at ${camp.x},${camp.z}`;
        const theirs = model.enemies.filter((e) => e.kind === 'bandit' && e.homeX === camp.x && e.homeZ === camp.z);
        if (theirs.length !== camp.bandits) problems.push(`${at}: ${theirs.length} bandits, not ${camp.bandits}`);
        if (camp.bandits < MIN_BANDITS || camp.bandits > MAX_BANDITS) problems.push(`${at}: ${camp.bandits} bandits, not ${MIN_BANDITS} to ${MAX_BANDITS}`);
        counts.add(camp.bandits);
        const tiles = new Set<string>();
        for (const b of theirs) {
          if (Math.abs(b.x - camp.x) > 2 || Math.abs(b.z - camp.z) > 2) problems.push(`${at}: a bandit outside its palisade at ${b.x},${b.z}`);
          if (!model.isOpenTile(b.x, b.z)) problems.push(`${at}: a bandit in a tent, the fire or the crates at ${b.x},${b.z}`);
          if (tiles.has(`${b.x},${b.z}`)) problems.push(`${at}: two bandits on one tile`);
          tiles.add(`${b.x},${b.z}`);
        }
        // Their chief: one, inside, on a free tile of his own (none of theirs).
        const chiefs = model.enemies.filter((e) => e.kind === 'banditChief' && e.homeX === camp.x && e.homeZ === camp.z);
        if (chiefs.length !== 1) problems.push(`${at}: ${chiefs.length} chiefs`);
        for (const c of chiefs) {
          if (Math.abs(c.x - camp.x) > 2 || Math.abs(c.z - camp.z) > 2 || !model.isOpenTile(c.x, c.z)) problems.push(`${at}: its chief not on a free tile inside, at ${c.x},${c.z}`);
          if (tiles.has(`${c.x},${c.z}`)) problems.push(`${at}: its chief on a bandit's tile`);
        }
        // And no other foe starts inside.
        const others = model.enemies.filter((e) => e.kind !== 'bandit' && e.kind !== 'banditChief' && Math.abs(e.x - camp.x) <= 2 && Math.abs(e.z - camp.z) <= 2);
        if (others.length > 0) problems.push(`${at}: a ${others[0].kind} inside`);
      }
    }
    expect(problems.slice(0, 10)).toEqual([]);
    expect([...counts].sort()).toEqual([3, 4, 5, 6]);
  });
});
