// Each of the ten new charms cast through the real game (support/charmStage.ts), on every test seed, at everyone a
// player might cast it at: a wolf, a bandit, a villager out of doors and one at home, a smith, a barkeep, a server
// and a herbalist where they work, someone on the road, and a foe down a crypt, a cave and a stronghold. Each time:
// taken or refused as the charm's meant to be (a painting under a roof only, a doll never under one), Breath spent
// only when it's taken, whoever it was gone the once (a foe as if slain, a villager lost, a traveller off the road)
// or wholly as they were, what they became where they stood, and the game played on and saved and loaded after it.
import { describe, expect, it } from 'vitest';
import { NEW_CHARMS, WHERE, about, reloaded, scene, type NewCharm, type Scene, type Where } from './support/charmStage';
import { TEST_SEEDS } from './support/testWorld';
import { isWorldFoe } from '../src/model/enemies/foeIds';
import { castSpell } from '../src/model/spells/casting';
import { isFoe, isNpc } from '../src/model/spells/beings';
import { hungAt } from '../src/model/spells/hung';
import { SPELLS } from '../src/model/spells/spells';
import { COATS, ROAM, coatsOf, placeOf } from '../src/model/spells/turned';

// Whether the charm's meant to take, there (the engineer's: turned.ts may).
const meant = (charm: NewCharm, place: Scene['place']): boolean => (charm === 'painting' ? place === 'room' : charm === 'doll' ? place !== 'room' : true);

function cast(seed: number, where: Where, charm: NewCharm): 'cast' | 'refused' | 'none' {
  const made = scene(seed, where);
  if (!made) return 'none';
  const { model, who, place, told } = made;
  const said = `${charm} at ${where}, seed ${seed}`;
  const [breath, stood] = [model.moves.breath, { x: who.x, z: who.z }];
  const before = { hens: model.chickens.hens.length, loot: model.groundHere.loot.length, foes: model.foes.length, npcs: model.npcs.length, road: model.travellers.list.length, slain: model.slain.size, lost: model.chickens.lost.size, xp: model.hero.xp, money: model.hero.money };
  const result = castSpell(model, charm);
  const turned = told.filter((e) => e.kind === 'transformed');
  if (!meant(charm, place)) {
    // Refused: nothing spent, nothing told, no one and nothing changed.
    expect(result, said).toBe('noTarget');
    expect([model.moves.breath, turned.length, told.filter((e) => e.kind === 'cast').length], said).toEqual([breath, 0, 0]);
    expect({ hens: model.chickens.hens.length, loot: model.groundHere.loot.length, foes: model.foes.length, npcs: model.npcs.length, road: model.travellers.list.length, slain: model.slain.size, lost: model.chickens.lost.size, xp: model.hero.xp, money: model.hero.money }, said).toEqual(before);
    expect(about(model, who), said).toBe(true);
    expect(isFoe(who) ? model.focused : model.chosen.person, said).toBe(who); // (picked out still)
    return 'refused';
  }
  expect(result, said).toBe('cast');
  expect(model.moves.breath, said).toBe(breath - SPELLS[charm].breath);
  expect(turned, said).toHaveLength(1);
  expect(turned[0], said).toMatchObject({ into: charm, who: { id: who.id } });
  // Gone, the once.
  expect(about(model, who), said).toBe(false);
  expect([model.focused, model.chosen.person], said).toEqual([null, null]);
  expect([model.hero.xp, model.hero.money], said).toEqual([before.xp, before.money]); // (nothing had for it)
  if (isFoe(who)) {
    expect([who.state, model.foes.length], said).toEqual(['dead', before.foes - 1]);
    expect(model.slain.size - before.slain, said).toBe(isWorldFoe(who.id) ? 1 : 0);
  } else if (isNpc(who)) {
    expect([model.npcs.length, model.chickens.lost.size, model.chickens.lost.has(who.id)], said).toEqual([before.npcs - 1, before.lost + 1, true]);
  } else expect(model.travellers.list.length, said).toBe(before.road - 1);
  // What they became, where they stood.
  const at = place === 'out' ? null : placeOf(model.inside!.entrance);
  if (charm === 'doll') {
    expect(model.chickens.hens.length, said).toBe(before.hens);
    expect(model.groundHere.loot.slice(before.loot).map((l) => ({ item: l.item, x: l.x, z: l.z })), said).toEqual([{ item: 'doll', ...stood }]);
  } else {
    expect(model.groundHere.loot.length, said).toBe(before.loot);
    expect(model.chickens.hens.length, said).toBe(before.hens + 1);
    const beast = model.chickens.hens[model.chickens.hens.length - 1];
    expect(beast, said).toMatchObject({ kind: charm, at, from: stood });
    expect(model.chickens.here, said).toContain(beast);
    if (charm === 'painting') expect({ x: beast.x, z: beast.z }, said).toEqual(hungAt(beast.hung!));
    else expect({ x: beast.x, z: beast.z }, said).toEqual(stood);
    // In a coat of its kind's, the one told.
    const coats = coatsOf(charm);
    if (coats) expect(beast.coat! >= 0 && beast.coat! < coats && Number.isInteger(beast.coat), said).toBe(true);
    else expect(beast.coat, said).toBeUndefined();
    expect((turned[0] as { coat?: number }).coat, said).toBe(beast.coat);
    if (charm === 'ghost' || charm === 'painting') expect(beast.stone, said).toMatchObject({ id: who.id });
    // Played on a while: it keeps to where it was turned, and nothing breaks.
    for (let t = 0; t < 15; t += 0.1) {
      model.update(0, 0, 0.1);
      if (!model.chickens.hens.includes(beast)) break; // (the hero fallen and woken elsewhere: no more to watch)
      expect(Math.hypot(beast.x - stood.x, beast.z - stood.z), said).toBeLessThanOrEqual(charm === 'painting' ? 99 : ROAM + 1e-6);
      expect([beast.x, beast.y, beast.z].every(Number.isFinite), said).toBe(true);
    }
  }
  // Saved and loaded (a case in three: every charm, every seed, every kind of target among them): gone still, and
  // what they became kept. (The last one on the roads comes back: transformationsKnown.test.ts.)
  if ((seed + NEW_CHARMS.indexOf(charm)) % 3 !== 0) return 'cast';
  const again = reloaded(model);
  const lone = !isFoe(who) && !isNpc(who) && model.travellers.list.length === 0;
  expect(!lone && (!isFoe(who) || isWorldFoe(who.id)) ? about(again, who) : false, said).toBe(false); // (a dungeon's foes are made afresh: its record of the cleared is its own)
  expect(again.chickens.hens.map((h) => [h.kind, h.at, h.coat, h.hung]), said).toEqual(model.chickens.hens.map((h) => [h.kind, h.at, h.coat, h.hung]));
  for (let t = 0; t < 3; t += 0.1) again.update(0, 0, 0.1);
  return 'cast';
}

describe('each new charm, through the real game', () => {
  for (const where of WHERE)
    it(`cast at ${where}, on every test seed: taken or refused as meant, the target gone once or not at all`, () => {
      const seen = { cast: 0, refused: 0, none: 0 };
      for (const seed of TEST_SEEDS) for (const charm of NEW_CHARMS) seen[cast(seed, where, charm)]++;
      expect(seen.cast + seen.refused, where).toBeGreaterThan(0); // (some seed has it)
    });

  it('has a coat for every coated kind among the new ones, and none for a ghost, a painting or a doll', () => {
    expect(NEW_CHARMS.filter((c) => coatsOf(c) > 0)).toEqual(['pig', 'sheep', 'goat', 'donkey', 'toad', 'rat', 'cat']);
    expect(Object.keys(COATS).sort()).toEqual(['bull', 'cat', 'cow', 'donkey', 'goat', 'pig', 'rat', 'sheep', 'toad']);
  });
});
