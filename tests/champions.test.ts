// Named champions in the deep (model/champions/): now and then a crypt, a cave or a stronghold has one, the same
// every time; standing among its foes deeper in, a level over the place, harder, steadier, worth more; its trait
// played out (wakes again, its brood at half, quickened, its pots three at a throw); slain, it leaves a rare piece at
// the least (its kind's set's, half the time), stays slain (kept in a save), and the place's share cleared is the same
// with it or without.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { CHAMPIONS, CHAMPION_CHANCE, CHAMPION_DAMAGE, CHAMPION_HP, CHAMPION_IDS, championName, championOf, type ChampionHome, type ChampionId } from '../src/model/champions/champions';
import { BROOD_AT, ChampionRun, FRENZY_AT, UNBURIED_BACK, makeChampion, potsAt } from '../src/model/champions/championRun';
import { CHAMPION_POST } from '../src/model/dungeons/dungeonRecord';
import { makeEnemy } from '../src/model/enemies/enemies';
import { flinches } from '../src/model/enemies/poise';
import { phaseFloor } from '../src/model/enemies/bossPhases';
import { enemyPower } from '../src/model/enemies/enemyLevels';
import { rollGearDrop } from '../src/model/loot/gearDrops';
import { gearOf, tierOf } from '../src/model/human/items/gear';
import { ITEMS } from '../src/model/human/equipment';
import { coinDrop } from '../src/model/hero/money';
import { strike } from '../src/model/hero/fighting';
import { parseSave, restore, snapshot } from '../src/model/save';
import { cryptInside } from '../src/model/crypts/crypts';
import { CRYPT_FOE_ID } from '../src/model/crypts/cryptFoes';
import { FRAME, fresh } from './support/testWorld';
import { STAGES, fight } from './support/fightCurve';
import type { Enemy, GameEvent } from '../src/model/types';

const MID = { width: 512, depth: 512 };
const HOMES: ChampionHome[] = ['crypt', 'cave', 'stronghold'];

describe('which dungeons have a champion', () => {
  it('about one in three of each kind, the same every time, and only its own kind of place\'s', () => {
    for (const home of HOMES) {
      let had = 0;
      for (let i = 0; i < 3000; i++) {
        const at = { x: (i * 37) % 2048, z: Math.floor(i / 7) * 13 };
        const id = championOf(home, 11, at);
        expect(championOf(home, 11, at)).toBe(id);
        if (!id) continue;
        had++;
        expect(CHAMPIONS[id].home, id).toBe(home);
      }
      expect(had / 3000, home).toBeGreaterThan(CHAMPION_CHANCE - 0.04);
      expect(had / 3000, home).toBeLessThan(CHAMPION_CHANCE + 0.04);
    }
  });

  it('every kind of place has three, each told by name and trait', () => {
    for (const home of HOMES) expect(CHAMPION_IDS.filter((id) => CHAMPIONS[id].home === home)).toHaveLength(3);
    expect(championName('brannoc')).toBe('Old Brannoc the Unburied');
    expect(championName('hob')).toBe('Gutless Hob');
  });
});

describe('a champion', () => {
  it('is its kind a level over the place: more health, harder blows, worth more, its own name', () => {
    for (const id of CHAMPION_IDS) {
      const champion = makeChampion(1, id, 0, 0, 8);
      const plain = enemyPower(CHAMPIONS[id].kind, 9);
      expect(champion.level).toBe(9);
      expect(champion.maxHp).toBe(Math.round(plain.maxHp * CHAMPION_HP));
      expect(champion.damage).toBe(Math.round(plain.damage * CHAMPION_DAMAGE));
      expect(champion.xp).toBeGreaterThan(plain.xp * 3);
      expect(champion.name).toBe(championName(id));
    }
  });

  it('takes a blow more to flinch than its kind', () => {
    const [skeleton, champion] = [makeEnemy(1, 'skeleton', 0, 0), makeChampion(2, 'ysolde', 0, 0, 1)];
    expect([flinches(skeleton, 0, false), flinches(skeleton, 0.2, false)]).toEqual([false, true]);
    expect([flinches(champion, 0, false), flinches(champion, 0.2, false), flinches(champion, 0.4, false)]).toEqual([false, false, true]);
    expect(flinches(champion, 5, true)).toBe(true); // (caught open, as any)
  });

  it('carries thrice the coin of its kind, and always leaves a rare piece at the least; a crypt\'s, its set\'s half the time', () => {
    const plain = { ...makeEnemy(CRYPT_FOE_ID + 5, 'skeleton', 3, 4, 3, 4, 9) };
    const champion = makeChampion(CRYPT_FOE_ID + 5, 'ysolde', 3, 4, 8);
    expect(Math.abs(coinDrop(champion) - coinDrop(plain) * 3)).toBeLessThanOrEqual(1); // (rounded)
    let sets = 0;
    for (let i = 0; i < 400; i++) {
      const foe = makeChampion(CRYPT_FOE_ID + CHAMPION_POST, 'ysolde', i * 3, i * 7, 8);
      const piece = gearOf(rollGearDrop(foe)!);
      expect(tierOf(piece.rarity)).toBeGreaterThanOrEqual(tierOf('rare'));
      if (ITEMS[piece.item].set) sets++;
    }
    expect(sets / 400).toBeGreaterThan(0.35);
    expect(sets / 400).toBeLessThan(0.65);
    for (let i = 0; i < 100; i++) expect(rollGearDrop(makeChampion(CRYPT_FOE_ID + CHAMPION_POST, 'weeping', i, i, 8))).not.toBeNull(); // (a beast's: none of its kind's, a champion's always)
  });
});

describe("a champion's trait", () => {
  const run = (id: Parameters<typeof makeChampion>[1]) => {
    const foe = { ...makeChampion(1, id, 0, 0, 6), state: 'chase' as const } as Enemy & { champion: typeof id };
    const called: Array<{ kind: string; count: number }> = [];
    const told: GameEvent[] = [];
    return { foe, called, told, run: new ChampionRun(foe, (kind, _at, count) => called.push({ kind, count }), (e) => told.push(e)) };
  };

  it('unburied: felled the first time, held at its last breath and up again; the second time, down for good', () => {
    const model = fresh();
    const { foe, run: r, told } = run('brannoc');
    strike(model, foe, foe.maxHp * 3, false);
    expect([foe.hp, foe.state]).toEqual([1, 'chase']);
    r.update();
    expect(foe.hp).toBe(Math.round(foe.maxHp * UNBURIED_BACK));
    expect(told[0]).toMatchObject({ kind: 'banner', title: 'Old Brannoc the Unburied' });
    expect(phaseFloor(foe)).toBe(-Infinity);
    strike(model, foe, foe.maxHp * 3, false);
    expect(foe.state).toBe('dead');
  });

  it('brood: held at half, its brood called up round it, once', () => {
    const model = fresh();
    const { foe, run: r, called } = run('weeping');
    strike(model, foe, foe.maxHp * 3, false);
    expect(foe.hp).toBe(Math.floor(foe.maxHp * BROOD_AT));
    r.update();
    r.update();
    expect(called).toEqual([{ kind: 'hatchling', count: 5 }]);
  });

  it('frenzy: a third of its health left, its blows one on another', () => {
    const { foe, run: r } = run('wat');
    foe.cooldown = 1.4;
    r.update();
    expect(foe.cooldown).toBe(1.4);
    foe.hp = Math.floor(foe.maxHp * FRENZY_AT) - 1;
    r.update();
    expect(foe.cooldown).toBeLessThan(0.5);
  });

  it('pots: three at a throw, and only his', () => {
    expect(potsAt(makeChampion(1, 'hob', 0, 0, 6))).toBe(3);
    expect(potsAt(makeEnemy(1, 'firebrand', 0, 0))).toBe(1);
  });
});

describe('a champion down in a crypt', () => {
  // A crypt of a world that has a champion (Ser Godric's, seed 10's: his hanged men called at half), gone down into.
  const goDown = () => {
    const model = new GameModel(10, MID);
    const crypt = model.crypts.find((c) => championOf('crypt', model.seed, c.ruin))!;
    expect(crypt).toBeDefined();
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.useDoor();
    return { model, crypt };
  };
  const championIn = (model: GameModel) => model.foes.find((f) => f.champion);

  it('stands among its guards on open floor, out of its lord\'s great hall; the share cleared the same with it', () => {
    const { model, crypt } = goDown();
    const champion = championIn(model)!;
    expect(champion.id).toBe(CRYPT_FOE_ID + CHAMPION_POST);
    expect(champion.name).toBe(championName(championOf('crypt', model.seed, crypt.ruin)!));
    expect(model.crypt!.free(champion.x, champion.z, 0.14)).toBe(true);
    const great = cryptInside(model.seed, crypt.entrance).plan.places.find((p) => p.kind === 'great')!;
    expect(champion.x >= great.x0 && champion.x <= great.x1 && champion.z >= great.z0 && champion.z <= great.z1).toBe(false);
    const share = model.crypt!.share;
    champion.state = 'dead';
    model.takeEvents();
    model.slayGuard(champion);
    expect(model.crypt!.share).toBe(share);
    expect(model.takeEvents().some((e) => e.kind === 'banner' && e.title === `${champion.name} slain`)).toBe(true);
  });

  it('slain, stays slain: not there going down again, nor after a save is loaded', () => {
    const { model, crypt } = goDown();
    const champion = championIn(model)!;
    champion.state = 'dead';
    model.slayGuard(champion);
    model.useDoor(); // (up)
    model.teleport(crypt.entrance.x, crypt.entrance.z);
    model.useDoor();
    expect(championIn(model)).toBeUndefined();
    const saved = parseSave(JSON.stringify(snapshot(model)), model.seed)!;
    const other = new GameModel(10, MID);
    restore(other, saved);
    expect(other.cleared(`${crypt.ruin.x},${crypt.ruin.z}`).has(CHAMPION_POST)).toBe(true);
  });

  it('its brood, called up, not the crypt\'s to count', () => {
    const { model } = goDown();
    const champion = championIn(model)!;
    const before = model.foes.length;
    model.hero.x = -50;
    champion.hp = 1;
    model.update(0, 0, FRAME);
    expect(champion.champion).toBe('godric');
    const called = model.foes.slice(before);
    expect(called.map((f) => f.kind)).toEqual(['skeleton', 'skeleton']);
    const share = model.crypt!.share;
    for (const foe of called) expect(model.crypt!.slay({ ...foe, state: 'dead' }, model.hero)).toEqual([]);
    expect(model.crypt!.share).toBe(share);
  });
});

describe('a champion against the curve (support/fightCurve.ts)', () => {
  // Its kind at the place's level and one over, made a champion of it.
  const crowned = (id: ChampionId, level: number) => (foe: Enemy) => {
    const made = makeChampion(foe.id, id, foe.x, foe.z, level);
    Object.assign(foe, { maxHp: made.maxHp, hp: made.maxHp, damage: made.damage, champion: id });
  };
  it('a fight of its own: beaten by a player who steps back, longer than its kind\'s, shorter than the place\'s lord\'s', { timeout: 300_000 }, () => {
    for (const level of [8, 12]) {
      const stage = STAGES.find((s) => s.level === level)!;
      const lord = fight(stage, 'cryptLord', level + 2, 'average');
      for (const id of ['brannoc', 'wat'] as const) {
        const kind = CHAMPIONS[id].kind;
        const [plain, champion] = [fight(stage, kind, level + 1, 'average'), fight(stage, kind, level + 1, 'average', 300, crowned(id, level))];
        const told = `L${level} ${id}: ${JSON.stringify({ plain: [plain.t, plain.lost], champion: [champion.t, champion.lost], lord: [lord.t, lord.lost] })}`;
        expect(champion.won, told).toBe(true);
        expect(champion.t, told).toBeGreaterThan(plain.t * 1.5);
        expect(champion.t, told).toBeLessThan(lord.t);
        expect(champion.lost, told).toBeGreaterThan(plain.lost);
      }
    }
  });
});
