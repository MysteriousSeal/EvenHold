// A bandit camp's chief (model/camps/campChief.ts) and what hangs on him (campLife.ts): one to each camp, a level
// over it, in the best of their gear, three bandits' health, named for his camp when it's his; while he stands,
// its chest locked; once he's down, opened once (gear and coins out on the rug before it), empty for good after, a
// save and a reload too; and the camp's last foe slain, "Camp cleared", once (not for camps cleared before).
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { CHIEF_OUTFIT, chiefName } from '../src/model/camps/campChief';
import { campLevel } from '../src/model/camps/camps';
import { CAMP_NAMES, campName } from '../src/model/camps/campNames';
import { CAMP_NEAR, chestOf } from '../src/model/camps/campLife';
import { restore, snapshot } from '../src/model/save';
import { chestInReach } from '../src/model/loot/chests';
import { enemyPower } from '../src/model/enemies/enemyLevels';
import type { Camp } from '../src/model/camps/camps';
import { FRAME } from './support/testWorld';

const MID = { width: 256, depth: 256 };
const crewOf = (model: GameModel, camp: Camp) => model.enemies.filter((e) => e.homeX === camp.x && e.homeZ === camp.z && (e.kind === 'bandit' || e.kind === 'banditChief'));
const chiefOf = (model: GameModel, camp: Camp) => crewOf(model, camp).find((e) => e.kind === 'banditChief')!;

describe("a bandit camp's chief", () => {
  it('one to each camp, a level over it, in the best of their gear, three bandits\' health, named for his camp when it\'s his', () => {
    for (const seed of [1, 2, 3]) {
      const model = new GameModel(seed, MID);
      for (const camp of model.camps) {
        const chief = chiefOf(model, camp);
        expect(chief.level).toBe(campLevel(camp, model.size) + 1);
        expect(chief.human?.equipment).toEqual(CHIEF_OUTFIT);
        expect(chief.maxHp).toBeGreaterThanOrEqual(enemyPower('bandit', chief.level).maxHp * 2.5);
        expect(chief.name).toBe(chiefName(camp, model.seed));
        const owner = CAMP_NAMES.owners.find((o) => campName(camp, model.seed).startsWith(`${o} `) && !(o.startsWith('the ') && o.endsWith("s'")));
        if (owner) expect(chief.name!.toLowerCase()).toBe(owner.replace(/'s$|'$/, '').toLowerCase()); // ("Redhand's Lair": Redhand)
        expect(chief.name!.length).toBeGreaterThan(2);
      }
    }
  });
});

describe("a bandit camp's chest", () => {
  it('locked while its chief stands; once he\'s down, opened once, gear and coins out before it; empty for good, a reload too', () => {
    const model = new GameModel(1, MID);
    const camp = model.camps[0];
    const chest = chestOf(camp);
    model.teleport(chest.x + Math.sign(camp.x - chest.x) * 0.5, chest.z + Math.sign(camp.z - chest.z) * 0.5);
    expect(model.campLife.chestInReach(model.hero)).toBe(camp);
    expect(model.campLife.locked(camp)).toBe(true);
    const [loot, coins] = [model.loot.length, model.coins.length];
    expect(chestInReach(model)?.what).toBe('locked'); // (what E finds there)
    expect(model.campLife.openChest(camp)).toBe(false); // (locked)
    expect([model.loot.length, model.coins.length]).toEqual([loot, coins]);
    chiefOf(model, camp).state = 'dead';
    expect(model.campLife.locked(camp)).toBe(false);
    expect(chestInReach(model)?.what).toBe('chest');
    chestInReach(model)!.open(); // (E)
    expect(model.loot.length).toBe(loot + 1);
    expect(model.coins.length).toBe(coins + 1);
    for (const thing of [model.loot.at(-1)!, model.coins.at(-1)!]) expect(Math.hypot(thing.x - chest.x, thing.z - chest.z)).toBeLessThan(0.8);
    expect(model.campLife.opened(camp)).toBe(true);
    expect(model.campLife.chestInReach(model.hero)).toBe(null);
    expect(chestInReach(model)).toBe(null);
    expect(model.campLife.openChest(camp)).toBe(false); // (once)
    const again = new GameModel(1, MID);
    restore(again, JSON.parse(JSON.stringify(snapshot(model))));
    expect(again.campLife.opened(again.camps[0])).toBe(true);
    expect(again.campLife.opened(again.camps[1])).toBe(false);
  });
});

describe('a bandit camp cleared', () => {
  it('told once its last foe falls (its chief and all his bandits), not before; not for a camp cleared already', () => {
    const model = new GameModel(2, MID);
    const camp = model.camps[1];
    model.teleport(camp.x + 40, camp.z + 40);
    const cleared = () => model.takeEvents().filter((e) => e.kind === 'cleared');
    model.update(0, 0, FRAME);
    expect(cleared()).toEqual([]);
    const crew = crewOf(model, camp);
    for (const e of crew.filter((e) => e.kind === 'bandit')) e.state = 'dead';
    model.update(0, 0, FRAME);
    expect(cleared()).toEqual([]); // (its chief still standing)
    chiefOf(model, camp).state = 'dead';
    model.update(0, 0, FRAME);
    expect(cleared()).toEqual([{ kind: 'cleared', name: campName(camp, model.seed), place: 'camp' }]);
    model.update(0, 0, FRAME);
    expect(cleared()).toEqual([]);
    // A world whose camp was cleared before: nothing told for it.
    const later = new GameModel(2, MID);
    for (const e of crewOf(later, later.camps[1])) e.state = 'dead';
    later.update(0, 0, FRAME);
    expect(later.takeEvents().filter((e) => e.kind === 'cleared')).toEqual([]);
  });
});

describe('how a bandit camp stands, as the hero comes about it', () => {
  it('its name, its bandits slain of all of them, its chief; cleared once all are down; its chest; none away from it', () => {
    const model = new GameModel(2, MID);
    const camp = model.camps[1];
    model.teleport(camp.x + CAMP_NEAR + 2, camp.z);
    expect(model.campLife.status(model.hero)).toBe(null);
    model.teleport(camp.x + CAMP_NEAR - 1, camp.z);
    const bandits = crewOf(model, camp).filter((e) => e.kind === 'bandit');
    expect(model.campLife.status(model.hero)).toEqual({ name: campName(camp, model.seed), bandits: { slain: 0, of: camp.bandits }, chief: { slain: 0, of: 1 }, cleared: false, chestOpened: false });
    bandits[0].state = 'dead';
    expect(model.campLife.status(model.hero)?.bandits).toEqual({ slain: 1, of: camp.bandits });
    for (const e of crewOf(model, camp)) e.state = 'dead';
    expect(model.campLife.status(model.hero)).toMatchObject({ bandits: { slain: camp.bandits }, chief: { slain: 1 }, cleared: true, chestOpened: false });
  });
});
