// What the model looks up each frame, kept to hand (not the world's every door, inn or foe gone through), and still
// right: the door in reach, after going far off; a room's let run out, this world's only; the foe focused on; and
// every dungeon's run sharing its base (model/dungeons/dungeonFoes.ts): its post's record, its boss's point once,
// cleared once all are down, its chest opened once.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { checkOut, letUntil, setLet } from '../src/model/inn/roomLetting';
import { Focus } from '../src/model/hero/focus';
import { makeEnemy } from '../src/model/enemies/enemies';
import { CryptFoes } from '../src/model/crypts/cryptFoes';
import { CaveRun } from '../src/model/caves/caveFoes';
import { cryptInside } from '../src/model/crypts/crypts';
import { caveInside } from '../src/model/caves/caves';
import { AWARD_POST, BOSS_POST, CHEST_POST } from '../src/model/dungeons/dungeonRecord';
import type { DungeonHooks } from '../src/model/dungeons/dungeonTypes';
import type { DungeonFoes } from '../src/model/dungeons/dungeonFoes';
import type { GameEvent } from '../src/model/types';

const MID = { width: 256, depth: 256 };

describe('the door in reach', () => {
  it('found by the door, none away from any; still found after going far off and coming to another', () => {
    const model = new GameModel(1, MID);
    const doors = model.entrances.filter((e) => e.type === 'house');
    const [a, b] = [doors[0], doors.at(-1)!];
    model.teleport(a.x, a.z + 0.3);
    expect(model.doorInReach).toBe(a);
    model.teleport(a.x + 6, a.z + 6);
    expect(model.doorInReach === a).toBe(false);
    model.teleport(b.x, b.z + 0.3); // (far off: the doors round the hero looked for afresh)
    expect(model.doorInReach).toBe(b);
  });
});

describe("a room's let running out", () => {
  it("checks out this world's inn at its time; another world's let left be", () => {
    const [one, two] = [new GameModel(1, MID), new GameModel(2, MID)];
    const [inn1, inn2] = [one.entrances.find((e) => e.type === 'inn')!, two.entrances.find((e) => e.type === 'inn')!];
    setLet(inn1, 100);
    setLet(inn2, 100);
    checkOut({ minutes: 50, inside: null, hero: one.hero }, one.entrances);
    expect([letUntil(inn1), letUntil(inn2)]).toEqual([100, 100]); // (not yet)
    checkOut({ minutes: 150, inside: null, hero: one.hero }, one.entrances);
    expect([letUntil(inn1), letUntil(inn2)]).toEqual([null, 100]); // (this world's out; the other's left be)
    checkOut({ minutes: 150, inside: null, hero: two.hero }, two.entrances);
    expect(letUntil(inn2)).toBe(null);
  });
});

describe('the foe focused on', () => {
  it('a living one by id, kept; none, nothing; a dead one never; let go once it dies or goes far off', () => {
    const foes = [makeEnemy(1, 'wolf', 5, 5), makeEnemy(2, 'wolf', 6, 5)];
    const focus = new Focus(() => foes);
    expect(focus.focused).toBe(null);
    focus.focus(2);
    expect(focus.focused).toBe(foes[1]);
    focus.keep({ x: 5, z: 5 });
    expect(focus.focused).toBe(foes[1]);
    foes[1].state = 'dead';
    focus.keep({ x: 5, z: 5 });
    expect(focus.focused).toBe(null);
    focus.focus(2);
    expect(focus.focused).toBe(null); // (a dead one never)
    focus.focus(1);
    focus.keep({ x: 200, z: 200 });
    expect(focus.focused).toBe(null); // (far off)
  });
});

describe("every dungeon's run, on its shared base", () => {
  const hooks = (told: GameEvent[], drops: string[]): DungeonHooks => ({
    strike: () => {},
    arrow: () => {},
    blow: () => {},
    frost: () => {},
    web: () => {},
    report: (e) => told.push(e),
    dropLoot: (item) => drops.push(`loot:${item}`),
    dropCoins: (n) => drops.push(`coins:${n}`),
  });
  const runs: Array<[string, (told: GameEvent[], drops: string[]) => { run: DungeonFoes; slain: Set<number> }]> = [
    ['a crypt', (told, drops) => {
      const model = new GameModel(1, MID);
      const crypt = model.entrances.find((e) => e.type === 'crypt')!;
      const slain = new Set<number>();
      return { run: new CryptFoes(model.seed, cryptInside(model.seed, crypt), slain, model.hero, hooks(told, drops)), slain };
    }],
    ['a cave', (told, drops) => {
      const model = new GameModel(1, MID);
      const cave = model.entrances.find((e) => e.type === 'cave')!;
      const slain = new Set<number>();
      return { run: new CaveRun(model.seed, caveInside(model.seed, cave), slain, model.hero, hooks(told, drops)), slain };
    }],
  ];
  it.each(runs)('%s: its foes slain kept by post; its boss a point once; cleared once all are down; its chest opened once', (_, make) => {
    const [told, drops] = [[] as GameEvent[], [] as string[]];
    const { run, slain } = make(told, drops);
    const hero = { statPoints: 0 } as Parameters<DungeonFoes['slay']>[1];
    const boss = run.foes.find((f) => f.id % 1_000_000 === BOSS_POST) ?? null;
    const rest = run.foes.filter((f) => f !== boss);
    const said = rest.flatMap((f) => run.slay(f, hero));
    expect(slain.size).toBe(rest.length);
    expect(said.filter((e) => e.kind === 'cleared')).toEqual([]); // (its boss still standing, or not yet risen)
    expect(run.share).toBeLessThan(1);
    if (!boss) return; // (a crypt's lord: risen only once most of it's cleared)
    const last = run.slay(boss, hero);
    expect(hero.statPoints).toBe(1);
    expect(last.map((e) => e.kind)).toEqual(['point', 'cleared']);
    expect(slain.has(AWARD_POST)).toBe(true);
    expect(run.slay(boss, hero).filter((e) => e.kind === 'point')).toEqual([]); // (a point once)
    run.chest = { x: 3, z: 3, open: false };
    expect(run.chestInReach({ x: 3.2, z: 3 })).toBe(true);
    run.openChest();
    run.openChest();
    expect(slain.has(CHEST_POST)).toBe(true);
    expect(drops).toHaveLength(2); // (its gear and its coins, once)
  });
});
