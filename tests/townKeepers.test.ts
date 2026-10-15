// The cathedral town's keepers (model/town/stallKeepers.ts, stallShop.ts): one at each stall, at it by day, home by
// night, selling what no village does and buying back its own sort; the town itself and the hero in it kept through a
// save (the town made again the same, the hero where they were, a stall's stock as it was left).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { STREAMED_SIZE } from '../src/model/worldgen/regions';
import { townSite } from '../src/model/town/townSite';
import { stallSpot } from '../src/model/town/stallKeepers';
import { buyAtStall, sellAtStall, stallShopAt, stallWares } from '../src/model/town/stallShop';
import { titleOf } from '../src/model/npcs/npcs';
import { parseSave, restore, snapshot } from '../src/model/save';
import { addToBag } from '../src/model/hero/bag';
import { villagerInReach } from '../src/model/npcs/chat';
import { bearing, travellerSays } from '../src/model/travellers/travellerTalk';
import { spawnTravellers } from '../src/model/travellers/travellers';

const SEED = 3;
const site = townSite(SEED, STREAMED_SIZE)!;
let made: GameModel | null = null;
const inTown = () => {
  if (made) return made;
  made = new GameModel(SEED, STREAMED_SIZE);
  made.teleport(site.x, site.z + 3);
  return made;
};
const mongers = (model: GameModel) => model.npcs.filter((n) => n.role === 'monger');

describe('the stalls\' keepers', () => {
  it('keep each stall, titled by their trade, living in the town', () => {
    const model = inTown();
    const town = model.towns[0];
    expect(mongers(model).map((n) => n.stall)).toEqual(town.stalls);
    for (const npc of mongers(model)) {
      expect(titleOf(npc)).toMatch(/\((Relic-monger|Vintner|Clothier|Apothecary)\)$/);
      expect(npc.village).toEqual(expect.objectContaining({ town: true }));
      expect(Math.max(Math.abs(npc.home.x - site.x), Math.abs(npc.home.z - site.z))).toBeLessThan(18);
    }
  }, 120_000);

  it('stand behind their stalls by day, to be spoken to across them, and go home at night', () => {
    const model = inTown();
    model.minutes = 10 * 60;
    for (let t = 0; t < 90; t += 0.1) model.update(0, 0, 0.1);
    for (const npc of mongers(model)) {
      const spot = stallSpot(npc.stall!);
      expect(npc.where).toBeNull();
      expect(Math.hypot(npc.x - spot.x, npc.z - spot.z), titleOf(npc)).toBeLessThan(0.3);
      // The hero before the counter: them, to talk to (their trade).
      const [fx, fz] = npc.stall!.front;
      model.teleport(npc.stall!.x + fx * 0.7, npc.stall!.z + fz * 0.7); // (up at the counter)
      expect(villagerInReach(model)).toBe(npc);
    }
    model.minutes = 22 * 60;
    for (let t = 0; t < 200; t += 0.1) model.update(0, 0, 0.1);
    for (const npc of mongers(model)) expect(npc.where).toBe(npc.home);
  }, 120_000);

  it('sell what no village does and buy back their own sort', () => {
    const model = inTown();
    for (const stall of model.towns[0].stalls) {
      const shop = stallShopAt(model.shops, model.seed, stall);
      const [id] = stallWares(stall.kind)[0];
      model.hero.money = 10_000;
      const before = model.hero.money;
      expect(buyAtStall(shop, model.hero, id)).toBe('bought');
      expect(model.hero.bag[id]).toBeGreaterThan(0);
      expect(model.hero.money).toBeLessThan(before);
      expect(sellAtStall(shop, model.hero, stall.kind, id)).toBe('sold');
      addToBag(model.hero.bag, 'bread');
      expect(sellAtStall(shop, model.hero, stall.kind, 'bread')).toBe('not wanted');
    }
    expect(stallWares('relics').map(([id]) => id)).toEqual(expect.arrayContaining(['pilgrimAmpulla', 'saintsKnuckle', 'martyrsThorn', 'scallopShell']));
    expect(stallWares('wine').map(([id]) => id)).toEqual(expect.arrayContaining(['hippocras', 'bishopsReserve']));
    expect(stallWares('cloth').some(([id]) => String(id).startsWith('velvetDoublet@5'))).toBe(true);
  }, 120_000);

  it('is the same town after a save, the hero where they were in it, a stall\'s stock as it was', () => {
    const model = inTown();
    model.teleport(site.x + 2, site.z - 4);
    const stall = model.towns[0].stalls[0];
    const shop = stallShopAt(model.shops, model.seed, stall);
    model.hero.money = 10_000;
    buyAtStall(shop, model.hero, stallWares(stall.kind)[0][0]);
    const left = { ...shop.stock };
    const again = new GameModel(SEED, STREAMED_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), SEED)!);
    expect([again.hero.x, again.hero.z]).toEqual([site.x + 2, site.z - 4]);
    expect(again.towns).toEqual(model.towns);
    expect(again.buildings.filter((b) => b.kind === 'cathedral')).toEqual(model.buildings.filter((b) => b.kind === 'cathedral'));
    expect(stallShopAt(again.shops, again.seed, stall).stock).toEqual(left);
    expect(mongers(again)).toHaveLength(model.towns[0].stalls.length);
  }, 180_000);
});

describe('pilgrims on the roads to it', () => {
  it('walk the roads into the town, more of them than anywhere else, and every pilgrim tells the way to it', () => {
    const model = inTown();
    const town = model.villages.findIndex((v) => v.town);
    const index = model.world.indexAt(site.x, site.z);
    const known = model.world.contents(index)!;
    const holy = new Set(known.roads.flatMap((r, i) => (known.villages[r.from]?.town || known.villages[r.to]?.town ? [i] : [])));
    expect(town).toBeGreaterThanOrEqual(0);
    expect(holy.size).toBeGreaterThan(0);
    const into = model.travellers.list.filter((t) => t.role === 'pilgrim' && model.world.indexAt(Math.floor(t.x), Math.floor(t.z)) === index && holy.has(t.road)); // (the town's region's band)
    expect(into.length).toBeGreaterThanOrEqual(holy.size);
    const plain = spawnTravellers(SEED, known.roads, site).filter((t) => holy.has(t.road) && t.role === 'pilgrim').length;
    const busy = spawnTravellers(SEED, known.roads, site, 0, holy).filter((t) => holy.has(t.road) && t.role === 'pilgrim').length;
    expect(busy).toBeGreaterThan(plain);
    const pilgrim = { ...into[0], x: site.x + 300, z: site.z };
    travellerSays(pilgrim, []);
    expect(travellerSays(pilgrim, [], site)).toContain(`to the ${bearing(pilgrim, site)}`);
  }, 120_000);
});
