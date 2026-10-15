// The fifty-five new pieces of gear (the sets': model/human/items/sets.ts; the Reliquary's five in v0.9): each in
// its slot, each drawn (a stand-in at least), each to be had somewhere, none
// stronger or dearer than the old ones of its slot allow, and every set's
// pieces of one set, on different slots, in one palette.

import { describe, expect, it } from 'vitest';
import { EQUIP_SLOTS, ITEMS, ITEM_IDS, gearOf as wearersGear, isHeldSlot, type EquipSlot, type ItemId, type Wearer } from '../src/model/human/equipment';
import { RARITIES, gearKey, gearOf, gearSpecs, rollGear, tierOf } from '../src/model/human/items/gear';
import { GEAR_SETS, type GearSet } from '../src/model/human/items/sets';
import { dropsGear, rollGearDrop } from '../src/model/loot/gearDrops';
import { rollHoard } from '../src/model/loot/hoard';
import { makeEnemy } from '../src/model/enemies/enemies';
import { SMITH_WARES } from '../src/model/smithy/smithShop';
import { PEDLAR_TRINKETS } from '../src/model/travellers/pedlarShop';
import { ITEM_MODELS } from '../src/view/meshes/human/gear/itemModels';
import { SET_PALETTES } from '../src/view/meshes/human/gear/setPalettes';
import { mulberry32 } from '../src/util/random';
import type { EnemyKind } from '../src/model/types';

const NEW: Record<EquipSlot, ItemId[]> = {
  head: ['headsmansHood', 'barrowHelm', 'ossuaryMask', 'cinderCowl', 'palmerHat', 'sunwardArmet'],
  shoulders: ['barrowSpaulders', 'ribcagePauldrons', 'flayersMantle', 'palmersCape', 'sunwardPauldrons', 'reliquaryPauldrons'],
  torso: ['headsmansApron', 'barrowHauberk', 'cinderRobe', 'watchBrigandine', 'sunwardCuirass', 'velvetDoublet', 'reliquaryDalmatic'],
  hands: ['headsmansGloves', 'knucklebones', 'cinderWraps', 'watchVambraces', 'sunwardGauntlets', 'reliquaryGauntlets'],
  legs: ['barrowGreaves', 'flayedLeggings', 'watchCuisses', 'particolouredHose', 'blackbannerTrews'],
  feet: ['headsmansBoots', 'flayersBoots', 'ashSandals', 'sunwardSabatons', 'poulaines'],
  mainHand: ['headsmansAxe', 'barrowBlade', 'flensingKnife', 'pilgrimsStaff', 'watchGlaive', 'courtSword', 'blackbannerFalchion'],
  offHand: ['ossuaryWard', 'smokingCenser', 'watchShield', 'sunwardAegis', 'blackbannerPavise', 'reliquaryTriptych'],
  neck: ['barrowTorc', 'trophyCord', 'scallopShell', 'saintsFinger'],
  ring: ['fingerboneRing', 'emberRing', 'ducalSignet'],
};
const ALL = Object.values(NEW).flat();
const OLD = ITEM_IDS.filter((id) => !ALL.includes(id));
const power = (id: ItemId) => (ITEMS[id].armor ?? 0) + Object.values(ITEMS[id].stats ?? {}).reduce((a, b) => a + b, 0);
const WEARERS: Wearer[] = ['bandit', 'bouncer', 'pedlar', 'pilgrim', 'guard'];

describe('the fifty-five new pieces', () => {
  it('fifty-five, each in its own slot, every slot given its share (five or so; jewellery six between neck and ring)', () => {
    expect(ALL).toHaveLength(55);
    expect(new Set(ALL).size).toBe(55);
    for (const slot of EQUIP_SLOTS) for (const id of NEW[slot]) expect(ITEMS[id]?.slot, id).toBe(slot);
    for (const slot of EQUIP_SLOTS.filter((s) => s !== 'neck' && s !== 'ring')) expect(NEW[slot].length, slot).toBeGreaterThanOrEqual(5);
    expect(NEW.neck.length + NEW.ring.length).toBeGreaterThanOrEqual(5);
    expect(OLD).toHaveLength(120); // (the old ones)
  });

  it('each drawn: a model to wear or hold, or a jewel for the bag', () => {
    for (const id of ALL) {
      const model = ITEM_MODELS[id];
      expect(model, id).toBeDefined();
      if (isHeldSlot(ITEMS[id].slot)) expect(model.held, id).toBeDefined();
      else if (ITEMS[id].slot === 'neck' || ITEMS[id].slot === 'ring') expect(model.jewel, id).toBeDefined();
      else expect(model.headgear ?? model.worn, id).toBeDefined();
    }
  });

  it('each to be had: worn by someone out in the world, sold, or left by a foe who leaves gear', () => {
    for (const id of ALL) {
      const { wornBy = {}, soldBy = {}, droppedBy = {} } = ITEMS[id];
      const worn = WEARERS.some((w) => wearersGear(w)[ITEMS[id].slot].some(([item]) => item === id) && (wornBy[w] ?? 0) > 0);
      const sold = SMITH_WARES.includes(id) || PEDLAR_TRINKETS.includes(id);
      const dropped = Object.keys(droppedBy).length > 0;
      expect(worn || sold || dropped, id).toBe(true);
      for (const kind of Object.keys(droppedBy) as EnemyKind[]) expect(dropsGear(kind), `${id}: ${kind}`).toBe(true);
      if (soldBy.pedlar) expect(ITEMS[id].slot === 'neck' || ITEMS[id].slot === 'ring', id).toBe(true); // (pedlars deal in trinkets)
    }
  });

  it('each to be had by the hero, not only seen: sold, or left by a foe (its own, or what a bandit wore)', () => {
    for (const id of ALL) {
      const { soldBy, droppedBy, wornBy } = ITEMS[id];
      expect(Boolean(soldBy) || Boolean(droppedBy) || Boolean(wornBy?.bandit), id).toBe(true);
    }
  });

  it("Sunward plate only in kings' tombs: no foe but a crypt lord favours it", () => {
    for (const id of ALL.filter((id) => ITEMS[id].set === 'sunward')) expect(Object.keys(ITEMS[id].droppedBy ?? {}), id).toEqual(['cryptLord']);
  });

  it("a set's pieces only in the chests of their own keepers: no Sunward plate in a brood mother's hoard, nor any set's in a chest kept by no one", () => {
    for (const level of [6, 10, 16, 20]) {
      for (let i = 0; i < 300; i++) {
        for (const keeper of ['broodMother', 'cryptLord', 'banditChief', undefined] as const) {
          const id = gearOf(rollHoard(i, i * 13, 9137, level, { worth: 100, base: 60, spread: 40, keeper }).item).item;
          if (ITEMS[id].set) expect(keeper && ITEMS[id].droppedBy?.[keeper], `${id} in ${keeper ?? "no one"}'s chest`).toBeTruthy();
        }
      }
    }
  });

  it("a camp chief's chest holds stolen gear worth having, its own kind of piece no less", () => {
    for (const level of [1, 3, 6, 10]) {
      for (let i = 0; i < 300; i++) {
        const { item } = rollHoard(i, i * 11, 7717, level, { worth: 60, base: 25, spread: 15, keeper: 'banditChief' });
        expect(ITEMS[gearOf(item).item].value ?? 0, gearOf(item).item).toBeGreaterThanOrEqual(60);
      }
    }
  });

  it('every piece a foe favours does fall from that kind of foe, deep enough in', () => {
    const kinds = [...new Set(ALL.flatMap((id) => Object.keys(ITEMS[id].droppedBy ?? {})))] as EnemyKind[];
    for (const kind of kinds) {
      const seen = new Set(Array.from({ length: 3000 }, (_, i) => rollGearDrop(makeEnemy(i, kind, i, i * 3, i, i * 3, 20), 1000)).map((key) => key && gearOf(key).item));
      for (const id of ALL.filter((id) => ITEMS[id].droppedBy?.[kind])) expect(seen.has(id), `${id} from ${kind}`).toBe(true);
    }
  });

  it('what folk wear and the shops sell is plain (level 1, common); what is found has a floor fit to it', () => {
    for (const id of ALL) {
      const { wornBy, soldBy, level = 1, rarity = 'common' } = ITEMS[id];
      if (wornBy || soldBy) expect([level, rarity], id).toEqual([1, 'common']);
      expect(level).toBeGreaterThanOrEqual(1);
      expect(level).toBeLessThanOrEqual(20);
      if (tierOf(rarity) >= tierOf('epic')) expect(level, id).toBeGreaterThanOrEqual(12); // (the showpieces: deep in, at the top of the table)
      if (level >= 12) expect(tierOf(rarity), id).toBeGreaterThanOrEqual(tierOf('epic'));
    }
  });

  it('within the old pieces of its slot: its armour and stats no more than a point over the strongest, its worth within theirs (a showpiece to 600)', () => {
    for (const slot of EQUIP_SLOTS) {
      const old = OLD.filter((id) => ITEMS[id].slot === slot);
      const strongest = Math.max(...old.map(power));
      const weakest = Math.min(...old.map(power));
      const dearest = Math.max(...old.map((id) => ITEMS[id].value ?? 0));
      for (const id of NEW[slot]) {
        expect(power(id), id).toBeGreaterThanOrEqual(weakest);
        expect(power(id), id).toBeLessThanOrEqual(strongest + 1);
        expect(ITEMS[id].value ?? 0, id).toBeLessThanOrEqual(Math.max(dearest, 600));
        for (const n of Object.values(ITEMS[id].stats ?? {})) expect(n).toBeLessThanOrEqual(5);
        const rare = tierOf(ITEMS[id].rarity ?? 'common') >= tierOf('epic');
        if (rare) expect(power(id), `${id}: a showpiece, among its slot's strongest`).toBeGreaterThanOrEqual(strongest - 1);
        if (rare) expect(ITEMS[id].value ?? 0, id).toBeGreaterThanOrEqual(300);
      }
    }
  });

  it('found no lower than its level, no plainer than its rarity, wherever it is found', () => {
    const rng = mulberry32(7);
    for (const id of ALL) {
      const { level = 1, rarity = 'common' } = ITEMS[id];
      for (let i = 0; i < 20; i++) {
        const got = gearOf(rollGear(id, 1 + (i % 4), rng));
        expect(got.level, id).toBeGreaterThanOrEqual(level);
        expect(RARITIES.indexOf(got.rarity), id).toBeGreaterThanOrEqual(tierOf(rarity));
      }
    }
  });

  it('a shallow crypt never gives up the deep pieces: a level 3 skeleton leaves nothing over its level of its own', () => {
    for (let i = 0; i < 2000; i++) {
      const key = rollGearDrop(makeEnemy(i, 'skeleton', i, i * 5, i, i * 5, 3), 1000);
      if (key && ALL.includes(gearOf(key).item)) expect(ITEMS[gearOf(key).item].level ?? 1).toBeLessThanOrEqual(3);
    }
  });

  it("the Gilded Deacon's hoard holds the Reliquary's pieces now and then, and his saints leave them; no one else's", () => {
    const items = Array.from({ length: 400 }, (_, i) => gearOf(rollHoard(i, i * 7, 7717, 15, { worth: 150, base: 90, spread: 60, keeper: 'gildedDeacon' }).item).item);
    expect(items.some((id) => ITEMS[id].set === 'reliquary')).toBe(true);
    for (const id of ALL.filter((id) => ITEMS[id].set === 'reliquary')) expect(Object.keys(ITEMS[id].droppedBy ?? {}).sort(), id).toEqual(['gildedDeacon', 'gildedSaint']);
  });

  it("a deep crypt lord's hoard holds Sunward plate now and then", () => {
    const items = Array.from({ length: 400 }, (_, i) => gearOf(rollHoard(i, i * 7, 9091, 16, { worth: 100, base: 60, spread: 40, keeper: 'cryptLord' }).item).item);
    expect(items.some((id) => ITEMS[id].set === 'sunward')).toBe(true);
    expect(items.some((id) => !ALL.includes(id))).toBe(true); // (and still the old fine things)
  });
});

describe('the sets', () => {
  const sets = Object.keys(GEAR_SETS) as GearSet[];

  it('eleven, every new piece in one, each of three pieces or more on as many slots, in its own palette', () => {
    expect(sets).toHaveLength(11);
    for (const id of ALL) expect(sets, id).toContain(ITEMS[id].set);
    for (const set of sets) {
      const pieces = ALL.filter((id) => ITEMS[id].set === set);
      expect(pieces.length, set).toBeGreaterThanOrEqual(3);
      expect(new Set(pieces.map((id) => ITEMS[id].slot)).size, set).toBe(pieces.length);
      expect(Object.keys(SET_PALETTES[set]).length, set).toBeGreaterThanOrEqual(5);
    }
    for (const id of OLD) expect(ITEMS[id].set, id).toBeUndefined();
  });

  it("a set's pieces are found together: the same foes, the same shops, or the same wearers", () => {
    for (const set of sets) {
      const pieces = ALL.filter((id) => ITEMS[id].set === set);
      const sources = (id: ItemId) => [...Object.keys(ITEMS[id].droppedBy ?? {}), ...Object.keys(ITEMS[id].soldBy ?? {}), ...Object.keys(ITEMS[id].wornBy ?? {})];
      const shared = sources(pieces[0]).filter((s) => pieces.every((id) => sources(id).includes(s)));
      const linked = pieces.every((a) => pieces.some((b) => b !== a && sources(a).some((s) => sources(b).includes(s))));
      expect(shared.length > 0 || linked, set).toBe(true);
    }
  });

  it("rolls a set piece's crit and dodge at half, its other lines as any piece's (a whole set never at their caps a tier early)", () => {
    const plain = ITEM_IDS.find((id) => ITEMS[id].slot === 'torso' && !ITEMS[id].set)!;
    let seen = 0;
    for (let roll = 0; roll < 400; roll++) {
      const [set, other] = (['sunwardCuirass', plain] as ItemId[]).map((item) => gearSpecs(gearKey({ item, level: 16, rarity: 'legendary', roll })));
      for (const a of ['crit', 'dodge'] as const) {
        expect(set.affixes[a]).toBeCloseTo(other.affixes[a] / 2, 6);
        if (other.affixes[a] > 0) seen++;
      }
      for (const a of ['regen', 'speed', 'leech'] as const) expect(set.affixes[a]).toBe(other.affixes[a]);
    }
    expect(seen).toBeGreaterThan(20); // (rolled often enough to count)
  });
});
