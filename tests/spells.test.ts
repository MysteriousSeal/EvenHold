// Spells (model/spells/): a charm known (not twice; no one teaching it), kept in a save; put on
// the action bar by its key; cast at the focused foe in range, or the nearest ahead: Breath spent, the harm of two
// blows done, its wait begun and run down; not cast unknown, waiting, out of Breath, or with no foe in reach. A foe
// it kills is slain as by a blow.
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { makeEnemy } from '../src/model/enemies/enemies';
import { setAction } from '../src/model/hero/actionBar';
import { blowOf, maxHpOf } from '../src/model/hero/attributes';
import { healthOf } from '../src/model/hero/selection';
import { castSpell, castTarget } from '../src/model/spells/casting';
import { SPELLS, isSpellKey, knows, learn, readSpells, spellKey, waitOf } from '../src/model/spells/spells';

// A foe of so much health, so far ahead of the hero (who faces +z), the only one about.
function facing(distance: number, hp = 1000) {
  const model = fresh();
  const { hero } = model;
  hero.facing = 0;
  model.enemies.length = 0;
  const foe = { ...makeEnemy(900_001, 'wolf', hero.x, hero.z + distance), hp, maxHp: hp };
  model.enemies.push(foe);
  return { model, hero, foe };
}

describe('a charm known', () => {
  it('is learned once, and no one in the world teaches or sells it', () => {
    const model = fresh();
    const { hero } = model;
    expect(knows(hero, 'hex')).toBe(false);
    expect(learn(hero, 'hex')).toBe(true);
    expect(learn(hero, 'hex')).toBe(false); // (not twice)
    expect(hero.spells).toEqual(['hex']);
    expect(model.npcs.some((npc) => (npc.role as string) === 'hedgewitch')).toBe(false); // (no hedge-witch any more)
    expect('price' in SPELLS.hex || 'level' in SPELLS.hex).toBe(false);
  });

  it('is kept in a save, sound: what is known, nothing unknown', () => {
    expect(readSpells(['hex', 'fireball', 3])).toEqual(['hex']);
    expect(readSpells(undefined)).toEqual([]);
  });
});

describe('a charm on the action bar', () => {
  it('goes on it by its key, and is cast with the slot', () => {
    const { model, hero, foe } = facing(2);
    learn(hero, 'hex');
    expect(isSpellKey(spellKey('hex'))).toBe(true);
    expect(isSpellKey('spell:nonsense')).toBe(false);
    expect(setAction(hero, 2, spellKey('hex'))).toBe(true);
    expect(model.useAction(2)).toBe(true);
    expect(foe.hp).toBe(1000 - blowOf(hero) * SPELLS.hex.harm!);
    expect(model.useAction(2)).toBe(false); // (waiting)
  });
});

describe('a charm cast', () => {
  it('spends Breath, harms the foe, and waits before the next; the wait runs down', () => {
    const { model, hero, foe } = facing(3);
    expect(castSpell(model, 'hex')).toBe('unknown');
    learn(hero, 'hex');
    const breath = model.moves.breath;
    const told: string[] = [];
    const report = model.report;
    model.report = (event) => [told.push(event.kind), report.call(model, event)];
    expect(castSpell(model, 'hex')).toBe('cast');
    expect(model.moves.breath).toBe(breath - SPELLS.hex.breath);
    expect(foe.hp).toBeLessThan(1000);
    expect(told).toEqual(expect.arrayContaining(['cast', 'hit']));
    expect(waitOf(hero, 'hex')).toBe(SPELLS.hex.cooldown);
    expect(castSpell(model, 'hex')).toBe('waiting');
    for (let t = 0; t < SPELLS.hex.cooldown + 0.5; t += 0.1) model.update(0, 0, 0.1);
    expect(waitOf(hero, 'hex')).toBe(0);
  });

  it('is cast at the focused foe if in range, else at the nearest ahead; at no one behind them or too far, nor under the ground, nor behind a wall', () => {
    const { model, hero, foe } = facing(3);
    expect(castTarget(model, 'hex')).toEqual({ foe });
    foe.buried = true; // (a cave's worm, burrowed)
    expect(castTarget(model, 'hex')).toBeNull();
    foe.buried = false;
    const sees = model.clear;
    model.clear = () => false; // (a wall between, a palisade)
    expect(castTarget(model, 'hex')).toBeNull();
    model.focus(foe.id);
    expect(castTarget(model, 'hex')).toBeNull();
    [model.clear] = [sees];
    model.focus(null);
    foe.z = hero.z - 3; // (behind them)
    expect(castTarget(model, 'hex')).toBeNull();
    model.focus(foe.id); // (focused: wherever it stands, in range)
    expect(castTarget(model, 'hex')).toEqual({ foe });
    foe.z = hero.z + SPELLS.hex.range + 1;
    expect(castTarget(model, 'hex')).toBeNull();
    learn(hero, 'hex');
    expect(castSpell(model, 'hex')).toBe('noTarget');
    expect(waitOf(hero, 'hex')).toBe(0); // (nothing spent)
  });

  it('of the kind for anyone goes to whoever is picked out, foe or not; no one, to the hero themselves', () => {
    const { model, hero, foe } = facing(3, 100);
    learn(hero, 'mend');
    expect(SPELLS.hex.aim).toBe('foes');
    expect(SPELLS.mend.aim).toBe('anyone');
    // No one picked out (a foe about, unfocused, is not a mending's to find): their own health.
    expect(castTarget(model, 'mend')).toEqual({ self: true });
    const most = maxHpOf(hero);
    hero.hp = 1;
    expect(castSpell(model, 'mend')).toBe('cast');
    expect(hero.hp).toBe(1 + Math.round(most * SPELLS.mend.heal!));
    expect(foe.hp).toBe(100);
    // A foe focused: its.
    hero.spellWait = {};
    model.moves.breath = 100;
    model.focus(foe.id);
    foe.hp = 10;
    expect(castSpell(model, 'mend')).toBe('cast');
    expect(foe.hp).toBe(10 + Math.round(foe.maxHp * SPELLS.mend.heal!));
    // Someone picked out who's no foe: theirs mended, the hero's own untouched.
    hero.spellWait = {};
    model.moves.breath = 100;
    const one = model.travellers.list[0];
    Object.assign(one, { x: hero.x + 1, z: hero.z, hp: 2 });
    model.select(one);
    hero.hp = 1;
    expect(castTarget(model, 'mend')).toEqual({ person: one });
    expect(castSpell(model, 'mend')).toBe('cast');
    expect(hero.hp).toBe(1);
    const theirs = healthOf(one, model.size);
    expect(theirs.hp).toBe(Math.min(theirs.max, 2 + Math.round(theirs.max * SPELLS.mend.heal!)));
    // Too far off: not cast, nothing spent.
    hero.spellWait = {};
    Object.assign(one, { x: hero.x + SPELLS.mend.range + 2 });
    expect(castSpell(model, 'mend')).toBe('noTarget');
    expect(waitOf(hero, 'mend')).toBe(0);
  });

  it('never mends past whole', () => {
    const { model, hero } = facing(3);
    learn(hero, 'mend');
    hero.hp = maxHpOf(hero) - 1;
    castSpell(model, 'mend');
    expect(hero.hp).toBe(maxHpOf(hero));
  });

  it('is not cast short of Breath, nothing spent', () => {
    const { model, hero, foe } = facing(2);
    learn(hero, 'hex');
    model.moves.breath = SPELLS.hex.breath - 1;
    expect(castSpell(model, 'hex')).toBe('breath');
    expect(foe.hp).toBe(1000);
    expect(waitOf(hero, 'hex')).toBe(0);
  });

  it('slays a foe as a blow does: dead, and its experience had', () => {
    const { model, hero, foe } = facing(2, 1);
    learn(hero, 'hex');
    const xp = hero.xp + hero.level * 1e6;
    castSpell(model, 'hex');
    expect(foe.state).toBe('dead');
    expect(hero.xp + hero.level * 1e6).toBeGreaterThan(xp);
  });
});
