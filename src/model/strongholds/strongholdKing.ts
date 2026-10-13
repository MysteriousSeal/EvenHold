// A stronghold's king (strongholdMoves.ts puts him on its stage,
// strongholdStage.ts; his four wings' bosses: strongholdBosses.ts): before
// his throne in the great hall, his guard beside him, a fight in three:
// - from the first, his great axe: a SWEEP all round him (told: a ring),
//   throwing whoever's in it back; and from a little way off a SMASH, the
//   floor breaking in three bursts along a line at the hero (told: its
//   strip, then each burst's ring in turn);
// - under two thirds, a horn: three waves come in at the hall's doors, one
//   every WAVE_EVERY seconds while he stands;
// - under a third, the braziers go over: the floor round each burning from
//   then on (told first, a wide ring), ground to keep out of; and he's
//   faster: on the hero quicker, his blows and his axe's moves coming oftener.
// Slain, the fires go out with him, and no more come in.

import { ENEMY_STATS } from '../constants';
import type { Enemy, EnemyKind } from '../types';
import { knockAway, type ToldMove } from '../enemies/toldMoves';
import { greatHall } from './strongholdLayout';
import { Boss, callUp, propsIn } from './strongholdBosses';
import type { Stage } from './strongholdStage';

export const KING = {
  under: [2 / 3, 1 / 3],
  sweep: { tell: 1.0, radius: 1.9, knock: 0.9 },
  smash: { tell: 0.7, bursts: 3, apart: 1.4, radius: 1.0, fuse: 0.45, lag: 0.22 },
  brazier: { tell: 1.6, radius: 2.4, burn: 600 },
} as const;
export const WAVE_EVERY = 12;
export const WAVES: ReadonlyArray<readonly EnemyKind[]> = [['bruiser', 'crossbowman', 'firebrand'], ['warHound', 'warHound', 'bruiser'], ['bruiser', 'crossbowman', 'sawbones']];
const HASTE = 0.7; // tiles a second more, on the hero, once the braziers are over

export class King extends Boss {
  private sweep = 2; // seconds before the next of each
  private smash = 3;
  private waves = 0; // still to come in
  private wave = 0; // seconds before the next
  private readonly doing: () => boolean[];

  constructor(stage: Stage, boss: Enemy) {
    super(stage, boss, boss.name ?? 'The Bandit King', KING.under, `King of ${stage.fight.name}`);
    const { hero, hooks, director } = stage.fight;
    const { tell, radius, knock } = KING.sweep;
    const sweep: ToldMove = { told: 'sweep', by: 'banditKing', tell, after: 0.45, every: 1, first: 1, near: radius, staunch: true, hits: (m, at) => Math.hypot(at.x - m.x, at.z - m.z) < radius };
    const swept = stage.act(sweep, (foe, m) => hooks.blow(foe, stage.harm(foe, 1.5), knockAway(m, hero, knock)), { unless: () => this.sweep > 0, mark: (m) => ({ shape: 'ring', tone: 'blow', x: m.x, z: m.z, r: radius }) });
    const s = KING.smash;
    const long = 1.6 + s.apart * (s.bursts - 1) + s.radius;
    const smash: ToldMove = { told: 'smash', by: 'banditKing', tell: s.tell, after: 0.5, every: 1, first: 1, near: 6.5, far: 2.1, staunch: true, hits: () => true };
    const smashed = stage.act(
      smash,
      (foe, m) => {
        for (let i = 0; i < s.bursts; i++) {
          const at = { x: m.x + m.dx * (1.6 + s.apart * i), z: m.z + m.dz * (1.6 + s.apart * i) };
          if (!stage.fight.blocked(at.x, at.z, 0.02)) stage.blast({ ...at, r: s.radius, by: foe, damage: stage.harm(foe, 1.5), tell: s.fuse, wait: i * s.lag, knock: 0.8, tone: 'blow' });
        }
      },
      { unless: (foe) => this.smash > 0 || !director.inView(foe, hero), mark: (m) => ({ shape: 'strip', tone: 'blow', x: m.x, z: m.z, dx: m.dx, dz: m.dz, long: Math.min(long, stage.reach(m.x, m.z, m.dx, m.dz, long) + s.radius), half: s.radius }) },
    );
    this.doing = () => [swept.doing(boss), smashed.doing(boss)];
  }

  // Where his waves come in: along the hall's near wall, either side of its doors, well apart (side by side in
  // the way in, whoever of them holds back to shoot stops the rest behind them).
  get doors(): Array<{ x: number; z: number }> {
    const { plan } = this.stage.fight;
    const hall = greatHall(plan);
    return [0.5, -2.5, 3.5, -5.5, 6.5].map((dx) => ({ x: Math.max(hall.x0 + 1.5, Math.min(hall.x1 - 0.5, plan.door + dx)), z: hall.z1 - 1.5 }));
  }

  protected turn(phase: number): void {
    const { stage, boss } = this;
    if (phase === 1) {
      stage.banner(this.title, 'A horn sounds: they come in at the doors');
      stage.call(boss, 'rally', 1.2, () => (this.waves = WAVES.length));
    } else {
      stage.banner(this.title, 'The braziers go over: keep out of the fire');
      const { tell, radius, burn } = KING.brazier;
      propsIn(stage, this.room, 'brazier').forEach((b, i) => stage.blast({ x: b.x, z: b.z, r: radius, by: boss, damage: stage.harm(boss, 1.2), tell, wait: i * 0.25, burn }));
    }
  }

  protected fights(dt: number): void {
    const { stage, boss } = this;
    const fast = this.phase >= 2;
    const [sweeping, smashing] = this.doing();
    this.sweep = sweeping ? (fast ? 5 : 8) : this.sweep - dt;
    this.smash = smashing ? (fast ? 6 : 9) : this.smash - dt;
    if (this.waves > 0 && (this.wave -= dt) <= 0) {
      callUp(stage, boss, WAVES[WAVES.length - this.waves--], this.doors);
      this.wave = WAVE_EVERY;
    }
    if (!fast) return;
    boss.cooldown = Math.min(boss.cooldown, 0.55);
    const d = stage.far(boss);
    const { hero, director } = stage.fight;
    if (this.free && boss.swingFor === null && d > ENEMY_STATS.banditKing.stop + 0.3 && director.inView(boss, hero)) director.move(boss, ((hero.x - boss.x) / d) * HASTE * dt, ((hero.z - boss.z) / d) * HASTE * dt);
  }

  slain(foe: Enemy): void {
    if (foe === this.boss) this.waves = 0;
  }
}
