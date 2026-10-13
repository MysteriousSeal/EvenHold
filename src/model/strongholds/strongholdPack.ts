// A stronghold's packs' roles (strongholdMoves.ts puts them on its stage,
// strongholdStage.ts), so a room's pack is a small puzzle, not five bandits:
// - a bruiser holds the front: close up, now and then, a slow smash on the
//   ground round him (told: a ring), throwing the hero back; not to be put
//   off it by a blow;
// - a crossbowman keeps his distance, levels his crossbow (told: its line,
//   fixed as he starts) and looses a bolt down it, stopped by a wall or
//   anything solid; struck as he aims, he's lost the shot;
// - a firebrand lobs a fire pot at where the hero stands: its circle told on
//   the floor while it flies, then it bursts, and burns there a moment;
// - a sawbones stays back, never fighting: it mends the most wounded of its
//   pack (told, a long while: struck meanwhile, it's lost), and backs off as
//   the hero comes; the one to kill first;
// - a runner, its pack set upon, runs for the nearest other pack of its wing
//   and brings them back with it, unless it's cut down on the way;
// - a war hound lunges from a few tiles off (told: a streak to where it'll
//   land), then worries at the hero, its bites coming fast a while.
// Those that fight from afar never close to strike (the stage's standOff).

import { ENEMY_STATS } from '../constants';
import type { Enemy, EnemyKind } from '../types';
import { isBoss } from '../enemies/enemyLevels';
import { knockAway, leap, type ToldMove } from '../enemies/toldMoves';
import type { StrongholdPart } from './strongholdMoves';
import { BOLT, type Stage } from './strongholdStage';

export const SMASH_TELL = 1.0;
export const SMASH_RADIUS = 1.35; // tiles round a bruiser his smash reaches
const SMASH_KNOCK = 1.6;
export const SHOT_TELL = 0.9; // seconds a crossbowman aims
export const POT_WINDUP = 0.65; // seconds a firebrand's arm is back
export const POT_FLIGHT = 0.9; // seconds its pot flies: its circle told that long
export const POT_RADIUS = 1.15;
export const POT_BURN = 2.6; // seconds its ground burns after
export const MEND_TELL = 1.6; // seconds a sawbones is at its mending (to be struck in)
const MEND_REACH = 6.5; // tiles from it, at most, whoever it mends
export const MEND_SHARE = 1.2; // of its own health: what it mends at a time
const FETCH_NEAR = 1.6; // tiles from one of the pack it's gone for: there
const CALL = 0.6; // seconds it shouts them up
export const LUNGE_TELL = 0.4;
const LUNGE = { reach: 3.8, time: 0.25, bite: 0.55 };
export const WORRY = 2.5; // seconds a hound's bites come fast, its lunge landed
const WORRIED = 0.3; // seconds between them, at most

// Who fights from afar, and how near the hero may come before it backs away (it stands off at its `stop`).
const AFAR: Partial<Record<EnemyKind, number>> = { crossbowman: 2.6, firebrand: 2.2, sawbones: 3 };

export const SMASH: ToldMove = { told: 'smash', by: 'bruiser', tell: SMASH_TELL, after: 0.5, every: 6.5, first: 2, near: 1.5, staunch: true, hits: (m, hero) => Math.hypot(hero.x - m.x, hero.z - m.z) < SMASH_RADIUS };
export const SHOT: ToldMove = { told: 'shot', by: 'crossbowman', tell: SHOT_TELL, after: 0.35, every: 3.4, first: 1, near: 7.5, far: 1.2, hits: () => true };
export const THROW: ToldMove = { told: 'firebomb', by: 'firebrand', tell: POT_WINDUP, after: 0.3, every: 5, first: 1.5, near: 6, far: 1.6, hits: () => true };
export const MEND: ToldMove = { told: 'mend', by: 'sawbones', tell: MEND_TELL, after: 0.3, every: 5, first: 1, near: 12, hits: () => true };

export class Pack implements StrongholdPart {
  private readonly posted: ReadonlySet<Enemy>; // those at their posts as the hero came in (not those called up since)
  private readonly gone = new Set<Enemy>(); // runners that have run (once each)
  private readonly worrying = new Map<Enemy, number>(); // hounds, till when
  private readonly frenzied = new Set<Enemy>();

  constructor(private readonly stage: Stage) {
    const { fight } = stage;
    const { hero, hooks, director } = fight;
    this.posted = new Set(fight.foes);
    const unseen = (foe: Enemy) => foe.state !== 'chase' || !director.inView(foe, hero);
    stage.act(SMASH, (foe, m) => hooks.blow(foe, stage.harm(foe, 1.6), knockAway(m, hero, SMASH_KNOCK)), { mark: (m) => ({ shape: 'ring', tone: 'blow', x: m.x, z: m.z, r: SMASH_RADIUS }) });
    stage.act(SHOT, (foe, m) => stage.loose(foe, m.dx, m.dz, stage.harm(foe, 1)), {
      unless: unseen,
      mark: (m) => ({ shape: 'strip', tone: 'shot', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long: stage.reach(m.x, m.z, m.dx, m.dz, BOLT.range), half: 0.08 }),
    });
    stage.act(THROW, (foe) => stage.lob(foe, { x: hero.x, z: hero.z, r: POT_RADIUS, by: foe, damage: stage.harm(foe, 1.2), tell: POT_FLIGHT, burn: POT_BURN }), { unless: unseen });
    stage.act(MEND, (foe) => this.mend(foe), { unless: (foe) => foe.state !== 'chase' || !this.wounded(foe) });
    // A hound's lunge, and a frenzied one's (its master enraged: strongholdBosses.ts), coming twice as often.
    for (const [every, frenzied] of [[4.5, false], [2.4, true]] as const) {
      const lunge = leap({ told: 'lunge', by: 'warHound', tell: LUNGE_TELL, after: LUNGE.time + 0.3, every, first: 0.5, near: 3.6, far: 1.4 }, (x, z) => fight.blocked(x, z, ENEMY_STATS.warHound.radius), LUNGE);
      stage.act(lunge, (foe, m) => {
        hooks.blow(foe, stage.harm(foe, 1.3), { dx: m.dx * 0.4, dz: m.dz * 0.4 });
        this.worrying.set(foe, stage.clock + WORRY);
      }, { unless: (foe) => this.frenzied.has(foe) !== frenzied, mark: (m) => ({ shape: 'strip', tone: 'blow', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long: Math.min(LUNGE.reach, Math.hypot(m.tx - m.x, m.tz - m.z) + 0.3), half: 0.25 }) });
    }
  }

  // A hound frenzied for good (its bites fast, its lunges often).
  frenzy(hound: Enemy): void {
    this.frenzied.add(hound);
  }

  update(dt: number): void {
    const { stage } = this;
    for (const foe of stage.fight.foes) {
      if (foe.state === 'dead') continue;
      const min = AFAR[foe.kind];
      if (min !== undefined) stage.standOff(foe, min, ENEMY_STATS[foe.kind].stop, ENEMY_STATS[foe.kind].run * 0.8, dt);
      else if (foe.kind === 'runner') this.run(foe);
      else if (foe.kind === 'warHound' && (this.frenzied.has(foe) || (this.worrying.get(foe) ?? 0) > stage.clock)) foe.cooldown = Math.min(foe.cooldown, WORRIED);
    }
  }

  // One that fights from afar never lands a plain blow (should it ever come to one).
  strike(foe: Enemy): boolean {
    return AFAR[foe.kind] !== undefined;
  }

  slain(foe: Enemy): void {
    this.worrying.delete(foe);
    this.frenzied.delete(foe);
  }

  // The most wounded of a sawbones's pack within its reach (not itself, nor a boss), or null.
  wounded(sawbones: Enemy): Enemy | null {
    const hurt = this.stage.fight.packOf(sawbones).filter((f) => f !== sawbones && !isBoss(f.kind) && f.hp < f.maxHp && this.stage.far(f, sawbones) < MEND_REACH); // (never a boss: a king mended by every wave's sawbones can't be brought down)
    return hurt.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0] ?? null;
  }

  private mend(sawbones: Enemy): void {
    const one = this.wounded(sawbones);
    if (one) one.hp = Math.min(one.maxHp, one.hp + Math.max(2, Math.round(sawbones.maxHp * MEND_SHARE)));
  }

  // The pack a runner would fetch: the nearest other of its wing (the watch's: of any wing) still at its posts,
  // no boss's; those of it standing.
  fetched(runner: Enemy): Enemy[] {
    const { fight } = this.stage;
    const place = fight.placeOf(runner);
    if (!place) return [];
    const wing = fight.plan.rooms[place.room].wing;
    let best: Enemy[] = [];
    for (const foe of this.posted) {
      const at = fight.placeOf(foe)!;
      const room = fight.plan.rooms[at.room];
      if (foe.state !== 'wander' || at.pack === place.pack || room.wing === null || (wing !== null && room.wing !== wing)) continue;
      const pack = fight.packOf(foe);
      if (pack.some((f) => isBoss(f.kind) || f.state !== 'wander')) continue;
      if (best.length === 0 || this.stage.far(foe, runner) < Math.min(...best.map((f) => this.stage.far(f, runner)))) best = pack;
    }
    return best;
  }

  // A runner, its pack set upon: off to the nearest other pack, shouting them up, and back with them at the hero.
  private run(runner: Enemy): void {
    const { stage } = this;
    const { fight } = stage;
    if (this.gone.has(runner) || !this.posted.has(runner) || !fight.packOf(runner).some((f) => f.state === 'chase' || f.hurtFor > 0)) return;
    this.gone.add(runner);
    const pack = this.fetched(runner);
    if (pack.length === 0) return; // (no one to fetch: it fights)
    const speed = ENEMY_STATS.runner.run;
    const nearest = () => [...pack].filter((f) => f.state !== 'dead').sort((a, b) => stage.far(a, runner) - stage.far(b, runner))[0] ?? runner;
    stage.banner('A runner breaks away', 'Cut them down before they fetch the next room');
    const back = (foe: Enemy) => stage.setOn(foe, ENEMY_STATS[foe.kind].sight * 0.9, ENEMY_STATS[foe.kind].run);
    stage.walk(runner, nearest, speed, (f) => stage.far(f, nearest()) < FETCH_NEAR, (arrived) => {
      if (!arrived) return back(runner);
      stage.call(runner, 'whistle', CALL, () => {
        for (const foe of pack) if (foe.state === 'wander') back(foe);
        back(runner);
      });
    });
  }
}
