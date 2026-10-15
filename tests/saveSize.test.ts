// The save's size as a hero roams (model/save.ts): a streamed world's foes as the seed spawns them aren't saved, only
// what's changed of them that matters (the slain, the hurt); so an hour or two's roaming, region after region, leaves
// the save about as small as it began (a big one, with its backups, filled the browser's storage: two worlds wouldn't fit).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { parseSave, restore, snapshot } from '../src/model/save';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { spawnOf } from '../src/model/map/grid';

const SEED = 7;
const kb = (data: unknown) => Math.round(JSON.stringify(data).length / 1024);

describe("a streamed world's save", () => {
  it('stays small however far the hero roams', () => {
    const model = new GameModel(SEED, STREAMED_SIZE);
    const spawn = spawnOf(model.size);
    // Five hundred steps along a widening spiral, some 1,500 tiles of it: the foes of every region passed waking and wandering.
    for (let i = 0; i < Number(process.env.ROAM ?? 500); i++) {
      const [a, r] = [i * 0.09, 8 + i * 0.5];
      model.teleport(spawn.x + Math.cos(a) * r, spawn.z + Math.sin(a) * r);
      for (let f = 0; f < 3; f++) model.update(0, 0, 1 / 10);
    }
    const data = snapshot(model);
    if (process.env.ROAM) console.log(Object.entries(data).map(([k, v]) => `${k} ${kb(v)}`).join(', '));
    console.log(`roamed ${kb(data)} KB (enemies.changed ${kb(data.enemies.changed)} KB, ${data.enemies.changed.length} foes; gone ${data.enemies.gone.length})`);
    expect(kb(data.enemies.changed)).toBeLessThan(8);
    expect(kb(data.npcs)).toBeLessThan(60); // (only the villagers near the hero, where they are in their day: save.ts NPCS_KEPT)
    expect(kb(data)).toBeLessThan(150);
    // An older save, its every wanderer kept: still read (each where it was), saved small after.
    const old = { ...data, enemies: { ...data.enemies, changed: model.enemies.filter((e) => e.state !== 'dead').map((e) => ({ id: e.id, x: Math.round((e.homeX + 1) * 100) / 100, z: e.homeZ, hp: e.maxHp })) } };
    expect(old.enemies.changed.length).toBeGreaterThan(100);
    const again = new GameModel(SEED, STREAMED_SIZE);
    restore(again, parseSave(JSON.stringify(old), SEED)!);
    const listed = new Set(old.enemies.changed.map((c) => c.id));
    const here = again.enemies.filter((e) => listed.has(e.id)); // (those of the regions made round where they stand; the rest, once theirs are)
    expect(here.length).toBeGreaterThan(100);
    expect(here.every((e) => Math.abs(e.x - (e.homeX + 1)) < 0.02)).toBe(true);
    expect(kb(snapshot(again).enemies.changed)).toBeLessThan(8);
  }, 600_000);

  it('keeps a hurt foe hurt, where it stood', () => {
    const model = new GameModel(SEED, STREAMED_SIZE);
    for (let f = 0; f < 3; f++) model.update(0, 0, 1 / 10);
    const foe = model.enemies.find((e) => e.state !== 'dead')!;
    Object.assign(foe, { hp: foe.maxHp - 1, x: foe.homeX + 0.5 });
    const again = new GameModel(SEED, STREAMED_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), SEED)!);
    for (let f = 0; f < 3; f++) again.update(0, 0, 1 / 10);
    const same = again.enemies.find((e) => e.id === foe.id)!;
    expect(same.hp).toBe(foe.maxHp - 1);
  }, 120_000);
});
