// A stronghold's four wings' bosses (strongholdMoves.ts puts them on its
// stage, strongholdStage.ts; the king: strongholdKing.ts), each a fight of
// his own, in phases turning as his health falls, each turn told (a banner),
// every move of his told before it lands:
// - the HOUNDMASTER (the kennels): a long whip, lashed down a strip, and two
//   hounds at heel; under two thirds he whistles the kennels open (three
//   more); under a third, enraged: two more, every hound of his frenzied,
//   his own lash and blows coming faster;
// - the QUARTERMASTER (the stores and powder): fire pots, and the powder kegs
//   standing in his room, lit one at a time (a fuse told, then a wide burst
//   that throws and burns); under half he falls back behind his crossbowmen
//   (two more called if he's short) and fights only from afar; under a
//   quarter every keg left goes up in turn, and he lays fuses in a chain
//   along the floor at the hero;
// - the GAOLER (the gaol): a hook on a chain thrown down a strip, dragging
//   whoever it catches to him, then his cleaver down on them; under three
//   fifths he throws the cages open (two wolves); under three tenths, the
//   last cage (a bear), his hook thrown oftener;
// - the CAPTAIN (the barracks): a duellist. His guard turns every blow but
//   in the opening just after his own (or after his lunge); he rallies his
//   guard (mended, quick a while; one called if none's left); under half he
//   draws a second blade, his blows in twos, the opening after the second;
//   under a fifth, his last stand: no guard, blows in threes, never put off.
// (strongholdProps.ts: the kennels, kegs and cages are those standing in
// each one's room.)

import { ENEMY_STATS } from '../constants';
import type { Enemy, EnemyKind } from '../types';
import { FACINGS } from '../map/grid';
import { onStrip, rush, type ToldMove } from '../enemies/toldMoves';
import { WINGS, bossRoom, type StrongholdRoom } from './strongholdLayout';
import type { StrongholdProp, StrongholdPropKind } from './strongholdProps';
import type { StrongholdPart } from './strongholdMoves';
import type { Pack } from './strongholdPack';
import { Phases, type Stage } from './strongholdStage';

type Point = { x: number; z: number };

export const HOUNDMASTER = { under: [2 / 3, 1 / 3], lash: { tell: 0.8, long: 3.2, half: 0.35 }, loosed: [3, 2] } as const;
export const QUARTERMASTER = { under: [1 / 2, 1 / 4], pot: { flight: 1.0, radius: 1.3, burn: 3 }, keg: { fuse: 1.8, radius: 2.2, burn: 3, near: 5.5, every: 9 }, chain: { links: 5, apart: 1.5, radius: 1.1, tell: 1.1, lag: 0.3, every: 6.5 }, crossbowmen: 2 } as const;
export const GAOLER = { under: [0.6, 0.3], hook: { tell: 0.9, long: 6.5, half: 0.4, left: 0.9 }, cleave: { tell: 0.75, long: 2.1, half: 0.5 } } as const;
export const CAPTAIN = { under: [0.5, 0.2], open: 0.8, lunge: { tell: 0.6, long: 3.6, half: 0.35, time: 0.3 }, rally: { every: 14, first: 6, mend: 0.3, quick: 6 } } as const;

// The props of a kind standing in a room, and the floor before one (the way it faces).
export const propsIn = (stage: Stage, room: StrongholdRoom, kind: StrongholdPropKind): StrongholdProp[] => stage.fight.props.filter((p) => p.kind === kind && p.x >= room.x0 && p.x <= room.x1 && p.z >= room.z0 && p.z <= room.z1);
export const before = (p: StrongholdProp): Point => ({ x: p.x + (p.w - 1) / 2 + FACINGS[p.facing][0], z: p.z + (p.d - 1) / 2 + FACINGS[p.facing][1] });

// `kinds` called up for `by`, each at the next of `spots` (round and round; none: by him), set on the hero.
export function callUp(stage: Stage, by: Enemy, kinds: readonly EnemyKind[], spots: readonly Point[]): Enemy[] {
  const called = kinds.map((kind, i) => {
    const at = spots.length > 0 ? spots[i % spots.length] : by;
    return stage.fight.summon(kind, at.x, at.z, by) ?? stage.fight.summon(kind, by.x, by.z, by);
  });
  const up = called.filter((foe): foe is Enemy => !!foe);
  for (const foe of up) stage.setOn(foe, ENEMY_STATS[foe.kind].sight * 0.9, ENEMY_STATS[foe.kind].run);
  return up;
}

// What every one of them shares: his room, his phases, a wait or two of his own.
export abstract class Boss implements StrongholdPart {
  protected readonly phases: Phases;
  protected readonly room: StrongholdRoom;

  constructor(
    protected readonly stage: Stage,
    protected readonly boss: Enemy,
    protected readonly title: string,
    under: readonly number[],
    met: string,
  ) {
    this.room = stage.fight.plan.rooms[stage.fight.placeOf(boss)!.room];
    this.phases = new Phases(boss, under, () => stage.banner(title, met), (phase) => this.turn(phase));
  }

  protected get phase(): number {
    return this.phases.phase;
  }
  // Up, met, and free to start something of his own.
  protected get free(): boolean {
    return this.boss.state === 'chase' && this.phases.met && !this.stage.busy(this.boss);
  }
  protected abstract turn(phase: number): void;

  update(dt: number): void {
    this.phases.update();
    if (this.boss.state !== 'dead' && this.phases.met) this.fights(dt);
  }
  protected abstract fights(dt: number): void;
}

class Houndmaster extends Boss {
  constructor(stage: Stage, boss: Enemy, private readonly pack: Pack) {
    super(stage, boss, 'The Houndmaster', HOUNDMASTER.under, 'Two hounds at his heel, and a long whip');
    const { tell, long, half } = HOUNDMASTER.lash;
    // His lash (enraged: oftener), down a strip before him: caught, cut and knocked back along it.
    for (const [every, enraged] of [[4.5, false], [2.6, true]] as const) {
      const lash: ToldMove = { told: 'cleave', by: 'houndmaster', tell, after: 0.4, every, first: 1.5, near: long, far: 1.0, staunch: true, hits: (m, hero) => onStrip(m, hero, long + 0.2, half) };
      stage.act(lash, (foe, m) => stage.fight.hooks.blow(foe, stage.harm(foe, 1.4), { dx: m.dx * 0.6, dz: m.dz * 0.6 }), { unless: () => (this.phase >= 2) !== enraged, mark: (m) => ({ shape: 'strip', tone: 'blow', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long, half }) });
    }
  }

  protected turn(phase: number): void {
    this.stage.banner(this.title, phase === 1 ? 'He whistles: the kennels are thrown open' : 'Enraged: his hounds frenzied');
    this.stage.call(this.boss, 'whistle', 1.0, () => {
      const kennels = propsIn(this.stage, this.room, 'kennel');
      callUp(this.stage, this.boss, Array(HOUNDMASTER.loosed[phase - 1]).fill('warHound'), (kennels.length > 0 ? kennels : propsIn(this.stage, this.room, 'cage')).map(before));
      if (phase === 2) for (const hound of this.stage.fight.packOf(this.boss)) if (hound.kind === 'warHound') this.pack.frenzy(hound);
    });
  }

  protected fights(): void {
    if (this.phase >= 2) this.boss.cooldown = Math.min(this.boss.cooldown, 0.5);
  }
}

class Quartermaster extends Boss {
  private readonly spent = new Set<StrongholdProp>(); // kegs gone up
  private fuse: number = QUARTERMASTER.keg.every / 2; // seconds before he lights another
  private chain: number = QUARTERMASTER.chain.every / 2;

  constructor(stage: Stage, boss: Enemy) {
    super(stage, boss, 'The Quartermaster', QUARTERMASTER.under, 'Fire pots, and powder kegs all round him');
    const { hero, director } = stage.fight;
    const { flight, radius, burn } = QUARTERMASTER.pot;
    // His pots (fallen back: oftener), lobbed at where the hero stands.
    for (const [every, back] of [[4.5, false], [3, true]] as const) {
      const pot: ToldMove = { told: 'firebomb', by: 'quartermaster', tell: 0.7, after: 0.3, every, first: 1, near: 8, far: 1.8, staunch: true, hits: () => true };
      stage.act(pot, (foe) => stage.lob(foe, { x: hero.x, z: hero.z, r: radius, by: foe, damage: stage.harm(foe, 1.4), tell: flight, burn }), { unless: (foe) => (this.phase >= 1) !== back || !director.inView(foe, hero) });
    }
  }

  // The kegs in his room not yet gone up, the nearest the hero first.
  get kegs(): StrongholdProp[] {
    return propsIn(this.stage, this.room, 'keg').filter((k) => !this.spent.has(k)).sort((a, b) => this.stage.far(a) - this.stage.far(b));
  }

  // A keg lit: its fuse told (after `wait`), then a wide burst, throwing whoever's by it, burning after.
  private light(keg: StrongholdProp, wait = 0): void {
    const { fuse, radius, burn } = QUARTERMASTER.keg;
    this.spent.add(keg);
    this.stage.blast({ x: keg.x, z: keg.z, r: radius, by: this.boss, damage: this.stage.harm(this.boss, 2), tell: fuse, wait, knock: 1.5, burn });
  }

  protected turn(phase: number): void {
    const { stage, boss, room } = this;
    if (phase === 1) {
      stage.banner(this.title, 'He falls back behind his crossbowmen');
      stage.call(boss, 'rally', 0.8, () => {
        const short = QUARTERMASTER.crossbowmen - stage.fight.packOf(boss).filter((f) => f.kind === 'crossbowman').length;
        const far = room.from === 1 ? room.x0 + 1 : room.x1 - 1; // (by his room's far wall, from its way in)
        callUp(stage, boss, Array(Math.max(0, short)).fill('crossbowman'), [{ x: far, z: room.z0 + 2 }, { x: far, z: room.z1 - 2 }]);
      });
    } else {
      stage.banner(this.title, 'The powder goes up: fuses in a chain');
      this.kegs.forEach((keg, i) => this.light(keg, i * 0.7));
    }
  }

  protected fights(dt: number): void {
    const { stage, boss } = this;
    const { hero } = stage.fight;
    if (this.phase >= 1) stage.standOff(boss, 3.2, 6, ENEMY_STATS.quartermaster.run * 0.85, dt);
    this.fuse -= dt;
    if (this.fuse <= 0 && this.free) {
      const keg = this.kegs.find((k) => stage.far(k) < QUARTERMASTER.keg.near);
      this.fuse = keg ? QUARTERMASTER.keg.every : 1;
      if (keg) stage.call(boss, 'firebomb', 0.5, () => this.light(keg));
    }
    if (this.phase < 2) return;
    this.chain -= dt;
    if (this.chain > 0 || !this.free) return;
    // A chain of fuses laid from him at the hero, bursting one after the other along it.
    const { links, apart, radius, tell, lag, every } = QUARTERMASTER.chain;
    this.chain = every;
    const d = stage.far(boss) || 1;
    const [dx, dz] = [(hero.x - boss.x) / d, (hero.z - boss.z) / d];
    stage.call(boss, 'firebomb', 0.6, () => {
      for (let i = 0; i < links; i++) {
        const at = { x: boss.x + dx * (1.4 + apart * i), z: boss.z + dz * (1.4 + apart * i) };
        if (!stage.fight.blocked(at.x, at.z, 0.02)) stage.blast({ ...at, r: radius, by: boss, damage: stage.harm(boss, 1.3), tell, wait: i * lag, burn: 2 });
      }
    });
  }
}

class Gaoler extends Boss {
  private hook = 2; // seconds before he throws it again
  private cleave = 2;

  constructor(stage: Stage, boss: Enemy) {
    super(stage, boss, 'The Gaoler', GAOLER.under, 'A hook on a chain, and a cleaver');
    const { hooks, director, hero } = stage.fight;
    const reach = (m: Point & { dx: number; dz: number }) => stage.reach(m.x, m.z, m.dx, m.dz, GAOLER.hook.long);
    // His hook, thrown down a strip (to the first wall): caught, dragged up to him, and his cleaver next.
    const hook: ToldMove = { told: 'shot', by: 'gaoler', tell: GAOLER.hook.tell, after: 0.5, every: 1, first: 1, near: GAOLER.hook.long, far: 2.2, staunch: true, hits: (m, at) => onStrip(m, at, reach(m), GAOLER.hook.half) };
    const hooked = stage.act(hook, (foe, m) => {
      const pull = Math.max(0, stage.far(m) - GAOLER.hook.left);
      hooks.blow(foe, stage.harm(foe, 0.8), { dx: -m.dx * pull, dz: -m.dz * pull });
      this.cleave = 0.25;
    }, { unless: (foe) => this.hook > 0 || !director.inView(foe, hero), mark: (m) => ({ shape: 'strip', tone: 'hook', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long: reach(m), half: GAOLER.hook.half }) });
    const { tell, long, half } = GAOLER.cleave;
    const cleave: ToldMove = { told: 'cleave', by: 'gaoler', tell, after: 0.45, every: 1, first: 1, near: 1.8, staunch: true, hits: (m, at) => onStrip(m, at, long, half) };
    const cleft = stage.act(cleave, (foe, m) => hooks.blow(foe, stage.harm(foe, 1.8), { dx: m.dx * 0.6, dz: m.dz * 0.6 }), { unless: () => this.cleave > 0, mark: (m) => ({ shape: 'strip', tone: 'blow', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long, half }) });
    this.doing = () => [hooked.doing(boss), cleft.doing(boss)];
  }
  private readonly doing: () => boolean[];

  protected turn(phase: number): void {
    this.stage.banner(this.title, phase === 1 ? 'He throws the cages open' : 'The last cage: what he kept for the pit');
    this.stage.call(this.boss, 'rally', 0.9, () => callUp(this.stage, this.boss, phase === 1 ? ['wolf', 'wolf'] : ['bear'], propsIn(this.stage, this.room, 'cage').map(before)));
  }

  protected fights(dt: number): void {
    const [hooking, cleaving] = this.doing();
    this.hook = hooking ? (this.phase >= 2 ? 4.5 : 7) : this.hook - dt;
    this.cleave = cleaving ? (this.phase >= 2 ? 3.5 : 5) : this.cleave - dt;
  }
}

class Captain extends Boss {
  private hp: number; // his health as it last stood (a blow turned: back to it)
  private swing: number | null = null; // how far into his blow he last was (a blow turned doesn't stop it)
  private openTill = 0; // the opening after his own blow: till then (the stage's clock) his guard's down
  private links = 0; // of his chain of blows, those struck
  private again = false; // another's to follow at once
  private lunge = 3;
  private rally: number = CAPTAIN.rally.first;
  private called = 0;
  private readonly quick = new Map<Enemy, number>(); // his guard rallied: quick till then
  private readonly lunging: () => boolean;

  constructor(stage: Stage, boss: Enemy) {
    super(stage, boss, 'The Captain', CAPTAIN.under, 'A duellist: his guard turns every blow but just after his own');
    this.hp = boss.hp;
    const { tell, long, half, time } = CAPTAIN.lunge;
    // His lunge, from a few tiles off: a rush down a strip, his point through whoever's on it; over, an opening.
    const lunge = rush({ told: 'charge', by: 'captain', tell, after: time + 0.5, every: 1, first: 1, near: 4.8, far: 2.2, staunch: true }, (x, z) => stage.fight.blocked(x, z, ENEMY_STATS.captain.radius), { long, time, half });
    const lunged = stage.act(lunge, (foe, m) => stage.fight.hooks.blow(foe, stage.harm(foe, 1.4), { dx: m.dx * 0.8, dz: m.dz * 0.8 }), { unless: () => this.lunge > 0, mark: (m) => ({ shape: 'strip', tone: 'blow', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long: stage.reach(m.x, m.z, m.dx, m.dz, long) + half, half }) });
    this.lunging = () => lunged.doing(boss);
  }

  // Whether his guard's up: met, not in the opening after his own blow, not at his last stand.
  get guarding(): boolean {
    return this.phases.met && this.phase < 2 && this.boss.state === 'chase' && this.stage.clock >= this.openTill;
  }

  // A blow of his lands: the last of his chain (one; two, his second blade drawn; three, at his last stand), an opening.
  strike(foe: Enemy): boolean {
    if (foe !== this.boss) return false;
    if (++this.links > this.phase) {
      this.links = 0;
      this.openTill = this.stage.clock + CAPTAIN.open;
    } else this.again = true;
    return false;
  }

  protected turn(phase: number): void {
    this.stage.banner(this.title, phase === 1 ? 'He draws a second blade' : 'His last stand: no guard, no quarter');
  }

  update(dt: number): void {
    const { boss, stage } = this;
    // A blow taken on his guard: turned (his health as it was, his own blow not stopped); at his last stand, taken, but never stopping his arm.
    if (boss.state !== 'dead' && boss.hp < this.hp && this.phases.met) {
      if (this.guarding) {
        Object.assign(boss, { hp: this.hp, hurtFor: 0 });
        stage.fight.hooks.report({ kind: 'guard', outcome: 'blocked', x: boss.x, y: boss.y, z: boss.z });
      }
      if (this.swing !== null && (this.guarding || this.phase >= 2)) boss.swingFor = this.swing;
    }
    super.update(dt);
    this.hp = boss.hp;
    this.swing = boss.swingFor;
  }

  protected fights(dt: number): void {
    const { boss, stage } = this;
    if (this.again && boss.swingFor === null) {
      boss.cooldown = Math.min(boss.cooldown, 0.2); // (the next of his chain, at once)
      this.again = false;
    }
    if (this.phase >= 2) boss.cooldown = Math.min(boss.cooldown, 0.6);
    if (this.lunging()) {
      this.lunge = this.phase >= 1 ? 5 : 7;
      this.openTill = stage.clock + CAPTAIN.open + 0.2; // (spent: open a moment after it)
    } else this.lunge -= dt;
    for (const [mate, till] of this.quick) if (till > stage.clock && mate.state !== 'dead') mate.cooldown = Math.min(mate.cooldown, 0.45);
    this.rally -= dt;
    if (this.rally > 0 || !this.free) return;
    this.rally = CAPTAIN.rally.every;
    stage.call(boss, 'rally', 0.9, () => {
      const guard = stage.fight.packOf(boss).filter((f) => f !== boss);
      if (guard.length === 0 && this.called++ < 2) guard.push(...callUp(stage, boss, ['bruiser'], []));
      for (const mate of guard) {
        mate.hp = Math.min(mate.maxHp, mate.hp + Math.round(mate.maxHp * CAPTAIN.rally.mend));
        this.quick.set(mate, stage.clock + CAPTAIN.rally.quick);
      }
    });
  }
}

// The four of them still standing, each in his wing.
export function wingBosses(stage: Stage, pack: Pack): StrongholdPart[] {
  const parts: StrongholdPart[] = [];
  for (const wing of WINGS) {
    const boss = stage.fight.bossOf(wing);
    if (!boss || !stage.fight.placeOf(boss) || stage.fight.plan.rooms[stage.fight.placeOf(boss)!.room] !== bossRoom(stage.fight.plan, wing)) continue;
    parts.push(boss.kind === 'houndmaster' ? new Houndmaster(stage, boss, pack) : boss.kind === 'quartermaster' ? new Quartermaster(stage, boss) : boss.kind === 'gaoler' ? new Gaoler(stage, boss) : new Captain(stage, boss));
  }
  return parts;
}
