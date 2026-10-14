// What every creature foe's rig shares (the wild beasts': beastRig.ts; a cave's bat, spider and worm; a ghost; a
// stronghold's war hound), past what every creature's does (creatureRig.ts: its own clock, its turning): the health
// bar over it (its name, its level), set as big as the scene draws it and kept each frame to how it stands
// (`marked`); and what it bursts into once slain, if it does, let go with it. (Those with a body like a person's:
// humanRig.ts's, banditRig.ts, undeadRig.ts.)
import type { Enemy } from '../../../model/types';
import { CreatureRig } from '../common/creatureRig';
import { drawnAt } from '../common/overhead';
import { HealthBar, VoxelBurst, type EnemyRig } from './enemyParts';

export abstract class FoeRig extends CreatureRig implements EnemyRig {
  protected readonly bar: HealthBar;
  private readonly burst: VoxelBurst | null;

  // `time`: its own clock's start; `bar`: over it; `burst`: the colours it bursts in, and from how high (none: it
  // doesn't). Each adds the bar to its root itself, after its body.
  protected constructor(time: number, bar: HealthBar, burst?: { colors: number[]; height: number }) {
    super(time);
    this.bar = bar;
    this.burst = burst ? new VoxelBurst(this.root, burst.colors, burst.height) : null;
  }

  abstract update(enemy: Enemy, dt: number, heroX: number, heroZ: number): void;

  drawnAt(scale: number): void {
    drawnAt(this.root, scale, this.bar.group);
  }

  // Its bar kept to how it stands: shown while it's alive (`shown`), red once it's set on the hero (`fighting`).
  protected marked(enemy: Enemy, shown = enemy.state !== 'dead', fighting = enemy.state === 'chase'): void {
    this.bar.update(enemy.hp, enemy.maxHp, shown, this.facing, enemy.level, fighting);
  }

  // Its burst, `deadFor` seconds slain: true once it's burst (the body to be hidden), as VoxelBurst.play.
  protected bursting(deadFor: number, dt: number): boolean {
    return this.burst?.play(deadFor, dt) ?? true;
  }

  override dispose(): void {
    super.dispose();
    this.burst?.dispose();
  }
}
