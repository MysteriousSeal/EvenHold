// A stronghold's five bosses (model/strongholds/strongholdBosses.ts, its
// king's: strongholdKing.ts), each a fight in phases: told as it begins and
// as each phase turns at its share of his health; every move of his told
// before it lands, none a hero's whole health; those he calls up never
// counted toward clearing the place nor kept. And what each leaves that's
// found nowhere else (strongholdLoot.ts, human/items/namedGear.ts).
// (Their packs' roles: strongholdPack.test.ts; the seam: strongholdMoves.test.ts.)
import { describe, expect, it } from 'vitest';
import { SUMMONED } from '../src/model/dungeons/dungeonRecord';
import { baseOf, gearName, gearSpecs, levelOf, namedIn, rarityOf, rollGear, tierOf, type GearKey } from '../src/model/human/items/gear';
import { ITEM_IDS } from '../src/model/human/equipment';
import { NAMED, NAMED_FROM } from '../src/model/human/items/namedGear';
import { WINGS, type Wing } from '../src/model/strongholds/strongholdLayout';
import { STRONGHOLD_FOE_ID, strongholdHoard } from '../src/model/strongholds/strongholdFoes';
import { CAPTAIN, GAOLER, HOUNDMASTER, QUARTERMASTER } from '../src/model/strongholds/strongholdBosses';
import { KING, WAVES, WAVE_EVERY } from '../src/model/strongholds/strongholdKing';
import { BOSS_PIECE, bossPiece } from '../src/model/strongholds/strongholdLoot';
import type { Enemy } from '../src/model/types';
import { mulberry32 } from '../src/util/random';
import { FRAME } from './support/testWorld';
import { staged, type Staged } from './support/strongholdStage';

// A boss's scene: the hero a while in the place first (off at its way in), then only him and `guard` of his pack left.
const scene = (who: Wing | 'king', guard = false) => {
  const s = staged();
  const boss = who === 'king' ? s.fight.king! : s.fight.bossOf(who)!;
  s.only(...(guard ? s.fight.packOf(boss) : [boss]));
  s.tick(3);
  return { s, boss };
};
// Brought under `share` of his health (as blows would bring him), and a moment on.
const bring = (s: Staged, boss: Enemy, share: number) => {
  boss.hp = Math.floor(boss.maxHp * share);
  s.tick(2 * FRAME);
};
// The hero stood `away` from him on the side they face him from, and he kept where he is (not let come on) till `until`.
const keepOff = (s: Staged, boss: Enemy, away: number, dir: { dx: number; dz: number }, seconds: number, until: () => boolean) => {
  const at = { x: boss.x, z: boss.z };
  Object.assign(s.hero, { x: at.x + dir.dx * away, z: at.z + dir.dz * away });
  for (let t = 0; t < seconds; t += FRAME) {
    Object.assign(boss, at);
    if (s.tick(FRAME, until)) return true;
  }
  return false;
};
const strips = (s: Staged, tone: string) => s.moves.marks.filter((m) => m.shape === 'strip' && m.tone === tone);
const rings = (s: Staged, r: number) => s.moves.marks.filter((m) => m.shape === 'ring' && m.r === r);
const uncounted = (s: Staged, called: Enemy[]) => {
  const [share, kept] = [s.run.share, s.slain.size];
  for (const foe of called) {
    expect(foe.id).toBeGreaterThanOrEqual(STRONGHOLD_FOE_ID + SUMMONED);
    expect(s.slay(foe)).toEqual([]);
  }
  expect([s.run.share, s.slain.size]).toEqual([share, kept]);
};

describe('a stronghold\'s bosses', () => {
  it('the houndmaster: told as he\'s met; his whip lashed down a strip, told; under two thirds the kennels whistled open, under a third more and every hound of his frenzied, himself quicker', () => {
    const { s, boss } = scene('kennels', true);
    const dir = s.face(boss, 2.5);
    expect(s.tick(1, () => boss.told === 'cleave')).toBe(true);
    expect(s.banners()).toEqual(['Two hounds at his heel, and a long whip']);
    s.tick(0.1);
    expect(strips(s, 'blow')).toContainEqual(expect.objectContaining({ x: boss.x, z: boss.z, long: HOUNDMASTER.lash.long, half: HOUNDMASTER.lash.half }));
    expect(s.game.blow.mock.calls.filter(([by]) => by === boss)).toEqual([]);
    keepOff(s, boss, 2.5, dir, HOUNDMASTER.lash.tell, () => false);
    const lashes = s.game.blow.mock.calls.filter(([by]) => by === boss);
    expect(lashes).toHaveLength(1);
    expect(lashes[0][1]).toBeLessThanOrEqual(s.hardest);
    expect(Math.sign(lashes[0][2]!.dx * dir.dx + lashes[0][2]!.dz * dir.dz)).toBe(1); // (back along it)
    // The kennels open, then again, his hounds frenzied.
    expect(s.called()).toEqual([]);
    bring(s, boss, 0.7);
    expect(s.banners()).toHaveLength(1);
    bring(s, boss, 0.65);
    expect(s.banners()[1]).toBe('He whistles: the kennels are thrown open');
    expect(s.tick(2, () => boss.told === 'whistle')).toBe(true); // (once he's done with his lash, if he's at it)
    expect(s.called()).toEqual([]);
    s.tick(1.2);
    expect(s.called('warHound')).toHaveLength(HOUNDMASTER.loosed[0]);
    expect(s.called().every((h) => s.fight.packOf(boss).includes(h))).toBe(true);
    bring(s, boss, 0.3);
    expect(s.banners()[2]).toBe('Enraged: his hounds frenzied');
    s.tick(1.2);
    expect(s.called('warHound')).toHaveLength(HOUNDMASTER.loosed[0] + HOUNDMASTER.loosed[1]);
    s.tick(4);
    const hounds = s.fight.packOf(boss).filter((f) => f.kind === 'warHound');
    expect(hounds.length).toBeGreaterThanOrEqual(5);
    expect(hounds.every((h) => h.cooldown <= 0.3 + 1e-9)).toBe(true);
    expect(boss.cooldown).toBeLessThanOrEqual(0.5);
    uncounted(s, s.called());
    for (const damage of s.blows()) expect(damage).toBeLessThanOrEqual(s.hardest);
  });

  it('the quartermaster: pots lobbed, and the kegs in his room lit (a fuse told, then a wide burst, burning after); under half, fallen back behind his crossbowmen, never closing; under a quarter every keg left going up, and fuses in a chain', () => {
    const { s, boss } = scene('stores');
    const room = s.fight.plan.rooms[s.fight.placeOf(boss)!.room];
    const kegs = s.fight.props.filter((p) => p.kind === 'keg' && p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1);
    expect(kegs.length).toBeGreaterThanOrEqual(1);
    // Stood by a keg, in his sight: he lights it.
    const keg = kegs.find((k) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dz]) => !s.fight.blocked(k.x + dx, k.z + dz, 0.2)))!;
    const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]].find(([dx, dz]) => !s.fight.blocked(keg.x + dx, keg.z + dz, 0.2))!;
    Object.assign(s.hero, { x: keg.x + dx, z: keg.z + dz });
    const fuse = () => rings(s, QUARTERMASTER.keg.radius).some((m) => m.x === keg.x && m.z === keg.z);
    let pots = 0;
    expect(s.tick(9, () => ((pots = Math.max(pots, s.moves.shots.filter((p) => p.kind === 'pot' && p.by === boss).length)), fuse()))).toBe(true);
    expect(s.banners()).toEqual(['Fire pots, and powder kegs all round him']);
    expect(pots).toBeGreaterThan(0);
    const before = s.game.blow.mock.calls.length;
    let told = 0;
    expect(s.tick(3, () => (fuse() ? (told++, false) : s.moves.fires.some((f) => f.x === keg.x && f.z === keg.z)))).toBe(true);
    expect(told * FRAME).toBeGreaterThan(QUARTERMASTER.keg.fuse - 0.1); // (told all its fuse long)
    const burst = s.game.blow.mock.calls.slice(before).find(([, , knock]) => !!knock)!;
    expect(burst[0]).toBe(boss);
    expect(burst[1]).toBeLessThanOrEqual(s.hardest);
    expect(Math.hypot(burst[2]!.dx, burst[2]!.dz)).toBeCloseTo(1.5);
    // Fallen back: his crossbowmen about him, himself keeping off, never a plain blow.
    bring(s, boss, 0.45);
    expect(s.banners()[1]).toBe('He falls back behind his crossbowmen');
    s.tick(1);
    expect(s.fight.packOf(boss).filter((f) => f.kind === 'crossbowman')).toHaveLength(QUARTERMASTER.crossbowmen);
    expect(s.called('crossbowman')).toHaveLength(QUARTERMASTER.crossbowmen);
    s.only(boss);
    const blows = s.game.strike.mock.calls.length;
    keepOff(s, boss, 1.2, s.face(boss, 1.2), 0.1, () => false);
    s.tick(2.5);
    expect(s.far(boss)).toBeGreaterThan(2.4);
    expect(s.game.strike.mock.calls.length).toBe(blows);
    // The powder goes up: every keg left, one after the other; then chains of fuses at the hero.
    bring(s, boss, 0.2);
    expect(s.banners()[2]).toBe('The powder goes up: fuses in a chain');
    const [lit, chain] = [new Set<string>(), new Set<string>()];
    s.tick(12, () => {
      for (const m of rings(s, QUARTERMASTER.keg.radius)) lit.add(`${m.x},${m.z}`);
      for (const m of rings(s, QUARTERMASTER.chain.radius)) chain.add(`${m.x.toFixed(2)},${m.z.toFixed(2)}`);
      return false;
    });
    expect(lit.size).toBe(kegs.length - 1);
    expect(chain.size).toBeGreaterThanOrEqual(3);
    for (const damage of s.blows()) expect(damage).toBeLessThanOrEqual(s.hardest);
    // Slain, his fires are out.
    s.slay(boss);
    expect(s.moves.fires).toEqual([]);
  });

  it('the gaoler: his hook thrown down a strip (told), dragging whoever\'s on it up to him, then his cleaver (told) on them there; under three fifths the cages thrown open, under three tenths the last', () => {
    const { s, boss } = scene('gaol');
    const dir = s.face(boss, 4);
    expect(keepOff(s, boss, 4, dir, 5, () => boss.told === 'shot')).toBe(true);
    expect(s.banners()).toEqual(['A hook on a chain, and a cleaver']);
    s.tick(0.1);
    expect(strips(s, 'hook')).toContainEqual(expect.objectContaining({ x: boss.x, z: boss.z, half: GAOLER.hook.half }));
    expect(s.game.blow).not.toHaveBeenCalled();
    const off = s.far(boss);
    expect(s.tick(1.2, () => s.game.blow.mock.calls.length > 0)).toBe(true);
    const [by, damage, pull] = s.game.blow.mock.calls[0];
    expect(by).toBe(boss);
    expect(damage).toBeLessThanOrEqual(boss.damage);
    expect(Math.sign(pull!.dx * dir.dx + pull!.dz * dir.dz)).toBe(-1); // (to him)
    expect(Math.hypot(pull!.dx, pull!.dz)).toBeCloseTo(off - GAOLER.hook.left, 1);
    // Dragged up to him: his cleaver raised at once, down along a strip; stepped off it, it falls on no one.
    Object.assign(s.hero, { x: boss.x + dir.dx * GAOLER.hook.left, z: boss.z + dir.dz * GAOLER.hook.left });
    expect(s.tick(1.5, () => boss.told === 'cleave')).toBe(true);
    s.tick(0.1);
    expect(strips(s, 'blow')).toContainEqual(expect.objectContaining({ long: GAOLER.cleave.long, half: GAOLER.cleave.half }));
    Object.assign(s.hero, { x: s.hero.x + dir.dz * 1.5, z: s.hero.z + dir.dx * 1.5 });
    s.tick(GAOLER.cleave.tell);
    expect(s.game.blow).toHaveBeenCalledTimes(1);
    // The cages.
    bring(s, boss, 0.55);
    expect(s.banners()[1]).toBe('He throws the cages open');
    s.tick(1.2);
    expect(s.called().map((f) => f.kind)).toEqual(['wolf', 'wolf']);
    bring(s, boss, 0.25);
    expect(s.banners()[2]).toBe('The last cage: what he kept for the pit');
    s.tick(1.2);
    expect(s.called('bear')).toHaveLength(1);
    expect(s.called().every((f) => s.fight.placeOf(f) === s.fight.placeOf(boss) && f.level === s.level)).toBe(true);
    uncounted(s, s.called());
    for (const hit of s.blows()) expect(hit).toBeLessThanOrEqual(s.hardest);
  });

  it('the captain: his guard turns every blow but in the opening after his own; his second blade drawn under half, his blows in twos, the opening after the second; under a fifth his last stand, no guard at all', () => {
    const { s, boss } = scene('barracks');
    s.face(boss, 0.8);
    const still = (seconds = 2 * FRAME) => ((boss.cooldown = 99), s.tick(seconds)); // (his own blows the test's to land: strike)
    still();
    expect(s.banners()).toEqual(['A duellist: his guard turns every blow but just after his own']);
    const blocked = () => s.game.report.mock.calls.filter(([e]) => e.kind === 'guard' && e.outcome === 'blocked').length;
    const full = boss.hp;
    s.hit(boss, 3);
    still();
    expect([boss.hp, blocked()]).toEqual([full, 1]); // (turned)
    expect(s.moves.strike(boss)).toBe(false); // (his blow lands as any foe's: and there's the opening)
    s.hit(boss, 3);
    still();
    expect([boss.hp, blocked()]).toEqual([full - 3, 1]);
    still(CAPTAIN.open + 0.1);
    s.hit(boss, 3);
    still();
    expect([boss.hp, blocked()]).toEqual([full - 3, 2]); // (shut again)
    // Hurt to half (in an opening): his second blade, his blows in twos.
    s.moves.strike(boss);
    bring(s, boss, 0.45);
    expect(s.banners()[1]).toBe('He draws a second blade');
    still(CAPTAIN.open + 0.1);
    const half = boss.hp;
    s.moves.strike(boss); // (the first of two: no opening yet)
    s.hit(boss, 3);
    still();
    expect(boss.hp).toBe(half);
    s.moves.strike(boss);
    s.hit(boss, 3);
    still();
    expect(boss.hp).toBe(half - 3);
    // His last stand: no guard.
    bring(s, boss, 0.15);
    expect(s.banners()[2]).toBe('His last stand: no guard, no quarter');
    still(CAPTAIN.open + 0.5);
    const last = boss.hp;
    const turned = blocked();
    s.hit(boss, 1);
    still();
    expect([boss.hp, blocked()]).toEqual([last - 1, turned]);
  });

  it('the captain lunges from a few tiles off (told: a strip), an opening after it; and rallies his guard: mended, or one called up if none\'s left', () => {
    const { s, boss } = scene('barracks');
    const dir = s.face(boss, 3.5);
    expect(keepOff(s, boss, 3.5, dir, 6, () => boss.told === 'charge')).toBe(true);
    const from = { x: boss.x, z: boss.z };
    s.tick(0.1);
    expect(strips(s, 'blow')).toContainEqual(expect.objectContaining({ x: from.x, z: from.z, half: CAPTAIN.lunge.half }));
    expect(s.game.blow).not.toHaveBeenCalled();
    expect(s.tick(1.5, () => s.game.blow.mock.calls.length > 0)).toBe(true);
    expect(s.game.blow.mock.calls[0][1]).toBeLessThanOrEqual(s.hardest);
    s.tick(0.5);
    expect(s.far(boss, from)).toBeGreaterThan(2); // (carried down it)
    const hp = boss.hp;
    s.hit(boss, 2);
    s.tick(2 * FRAME);
    expect(boss.hp).toBe(hp - 2); // (spent: open)
    // No guard left: one called to him (never counted).
    expect(s.tick(CAPTAIN.rally.every + 2, () => s.called('bruiser').length > 0)).toBe(true);
    uncounted(s, s.called());
    // His guard about him, the worse for wear: mended as he rallies them.
    const again = scene('barracks', true);
    const mate = again.s.fight.packOf(again.boss).find((f) => f.kind === 'bruiser')!;
    again.s.face(again.boss, 1);
    mate.hp = 1;
    expect(again.s.tick(CAPTAIN.rally.first + 3, () => mate.hp > 1)).toBe(true);
    expect(mate.hp).toBe(Math.min(mate.maxHp, 1 + Math.round(mate.maxHp * CAPTAIN.rally.mend)));
    expect(again.s.called()).toEqual([]);
  });

  it('the king: told by his name as he\'s met; his axe swept round him and the floor smashed in a line, both told; under two thirds a horn and three waves in at the doors; under a third the braziers over, burning from then on, and himself faster; slain, the fires out and no more coming', () => {
    const { s, boss } = scene('king');
    const dir = s.face(boss, 1.2);
    expect(keepOff(s, boss, 1.2, dir, 4, () => boss.told === 'sweep')).toBe(true);
    expect(s.banners()).toEqual([`King of ${s.inside.stronghold.name}`]);
    expect(s.game.report).toHaveBeenCalledWith({ kind: 'banner', title: boss.name, line: `King of ${s.inside.stronghold.name}` });
    s.tick(0.1);
    expect(rings(s, KING.sweep.radius)).toContainEqual(expect.objectContaining({ x: boss.x, z: boss.z, tone: 'blow' }));
    expect(s.game.blow).not.toHaveBeenCalled();
    s.tick(KING.sweep.tell);
    expect(s.game.blow).toHaveBeenCalledTimes(1);
    expect(Math.hypot(s.game.blow.mock.calls[0][2]!.dx, s.game.blow.mock.calls[0][2]!.dz)).toBeCloseTo(KING.sweep.knock);
    // His smash, from off a way: its strip told, then three bursts along it, each told.
    expect(keepOff(s, boss, 4.4, dir, 12, () => boss.told === 'smash')).toBe(true);
    s.tick(0.1);
    expect(strips(s, 'blow')).toContainEqual(expect.objectContaining({ x: boss.x, z: boss.z, half: KING.smash.radius }));
    const bursts = new Set<string>();
    s.tick(2.5, () => (rings(s, KING.smash.radius).forEach((m) => bursts.add(`${m.x.toFixed(2)},${m.z.toFixed(2)}`)), false));
    expect(bursts.size).toBe(KING.smash.bursts);
    expect(s.game.blow).toHaveBeenCalledTimes(2); // (the last of them, where the hero stood)
    // The horn: three waves in at the doors, WAVE_EVERY apart, at the hero; none counted.
    expect(s.called()).toEqual([]);
    bring(s, boss, 0.6);
    expect(s.banners()[1]).toBe('A horn sounds: they come in at the doors');
    s.tick(1.4);
    expect(s.called().map((f) => f.kind).sort()).toEqual([...WAVES[0]].sort());
    s.tick(WAVE_EVERY);
    expect(s.called()).toHaveLength(WAVES[0].length + WAVES[1].length);
    expect(s.called().some((f) => f.state === 'chase')).toBe(true);
    s.tick(WAVE_EVERY);
    const all = WAVES.flat().length;
    expect(s.called()).toHaveLength(all);
    s.tick(WAVE_EVERY + 1);
    expect(s.called()).toHaveLength(all);
    uncounted(s, s.called());
    // The braziers over: told, then burning on; stood in, it bites.
    const room = s.fight.plan.rooms[s.fight.placeOf(boss)!.room];
    const braziers = s.fight.props.filter((p) => p.kind === 'brazier' && p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1);
    expect(braziers.length).toBeGreaterThanOrEqual(2);
    bring(s, boss, 0.3);
    expect(s.banners()[2]).toBe('The braziers go over: keep out of the fire');
    expect(s.moves.fires.filter((f) => f.by === boss)).toEqual([]);
    s.tick(0.5);
    expect(rings(s, KING.brazier.radius).length).toBeGreaterThanOrEqual(1);
    s.tick(KING.brazier.tell + braziers.length * 0.25);
    const fires = s.moves.fires.filter((f) => f.by === boss);
    expect(fires.map((f) => [f.x, f.z])).toEqual(expect.arrayContaining(braziers.map((b) => [b.x, b.z])));
    expect(fires.every((f) => f.left > 60)).toBe(true);
    expect(boss.cooldown).toBeLessThanOrEqual(0.55); // (faster)
    s.only(boss);
    boss.state = 'wander'; // (the king out of it a moment: the fire alone)
    Object.assign(s.hero, { x: fires[0].x + 1, z: fires[0].z + 1 });
    const bitten = s.game.blow.mock.calls.length;
    s.tick(2 * FRAME);
    boss.cooldown = 99;
    s.tick(1.6);
    expect(s.game.blow.mock.calls.slice(bitten).filter(([by, , knock]) => by === boss && !knock).length).toBeGreaterThanOrEqual(2);
    for (const damage of s.blows()) expect(damage).toBeLessThanOrEqual(s.hardest);
    s.slay(boss);
    expect(s.moves.fires).toEqual([]);
    expect(s.game.dropLoot).not.toHaveBeenCalled(); // (his piece is in his chest)
  });
});

describe('what a stronghold\'s bosses leave, found nowhere else', () => {
  it('a named piece each: an item of the catalog under a name of its own, its lines fixed, at the stronghold\'s level; a wing\'s boss\'s where he falls, the king\'s in his chest', () => {
    const s = staged();
    // No other foe's: a bruiser slain leaves nothing of the moves' doing.
    s.slay(s.run.foes.find((f) => f.kind === 'bruiser')!);
    expect(s.game.dropLoot).not.toHaveBeenCalled();
    const pieces: GearKey[] = [];
    for (const wing of WINGS) {
      const boss = s.fight.bossOf(wing)!;
      s.slay(boss);
      const piece = bossPiece(boss.kind, s.level)!;
      expect(s.game.dropLoot).toHaveBeenLastCalledWith(piece, expect.closeTo(boss.x, 0), expect.closeTo(boss.z, 0));
      pieces.push(piece);
    }
    expect(s.game.dropLoot).toHaveBeenCalledTimes(WINGS.length);
    // The king's: what his chest holds, with its coins.
    const king = s.fight.king!;
    s.slay(king);
    s.tick(2 * FRAME);
    const hoard = strongholdHoard(s.inside, s.model.seed);
    expect(hoard.item).toBe(bossPiece('banditKing', s.level));
    expect(hoard.coins).toBeGreaterThan(0);
    s.run.openChest();
    expect(s.game.dropLoot).toHaveBeenLastCalledWith(hoard.item, expect.any(Number), expect.any(Number));
    expect(s.game.dropCoins).toHaveBeenCalledWith(hoard.coins, expect.any(Number), expect.any(Number));
    pieces.push(hoard.item);
    // Each its own: named, on its base, of the stronghold's level, its lines those listed and no others.
    expect(new Set(pieces).size).toBe(5);
    for (const piece of pieces) {
      const named = namedIn(piece)!;
      expect(Object.values(NAMED)).toContain(named);
      expect([gearName(piece), baseOf(piece), levelOf(piece), rarityOf(piece)]).toEqual([named.name, named.item, s.level, named.rarity]);
      expect(named.lines).toHaveLength(tierOf(named.rarity));
    }
    expect(Object.values(BOSS_PIECE).sort()).toEqual(Object.keys(NAMED).map(Number).sort());
  });

  it('its lines never rolled: the same at any level but stronger; nothing found is ever one; its number on another base is nothing', () => {
    for (const id of Object.keys(NAMED).map(Number) as Array<keyof typeof NAMED>) {
      const named = NAMED[id];
      const boss = (Object.keys(BOSS_PIECE) as Array<keyof typeof BOSS_PIECE>).find((k) => BOSS_PIECE[k] === id)!;
      const [low, high] = [bossPiece(boss, 1)!, bossPiece(boss, 24)!];
      for (const piece of [low, high]) expect(gearSpecs(piece).lines.filter((l) => l.extra).map((l) => l.kind)).toEqual([...named.lines]);
      const sum = (key: GearKey) => gearSpecs(key).lines.reduce((a, l) => a + l.amount, 0);
      expect(sum(high)).toBeGreaterThan(sum(low));
      const other = ITEM_IDS.find((item) => item !== named.item)!;
      expect(gearName(`${other}@5e${id}` as GearKey)).not.toBe(named.name);
      expect(namedIn(`${other}@5e${id}` as GearKey)).toBeNull();
    }
    const rng = mulberry32(77);
    for (let i = 0; i < 3000; i++) {
      const found = rollGear(ITEM_IDS[i % ITEM_IDS.length], 1 + (i % 20), rng, 3, 'rare');
      expect(namedIn(found)).toBeNull();
      expect(+found.split(/[curel]/).pop()!).toBeLessThan(NAMED_FROM);
    }
  });
});
