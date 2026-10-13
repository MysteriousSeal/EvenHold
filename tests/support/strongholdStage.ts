// A stronghold's run staged for its foes' ways (strongholdPack.test.ts,
// strongholdBosses.test.ts): the real moves, the game's side of it stood in
// for (the hooks: every blow, shot, banner and drop kept to look at), the hero
// stood wherever a test wants them, never hurt; whoever isn't in a scene put
// out of it.
import { vi, type Mock } from 'vitest';
import { GameModel } from '../../src/model/GameModel';
import type { DungeonHooks } from '../../src/model/dungeons/dungeonTypes';
import { maxHpAt } from '../../src/model/hero/attributes';
import { strongholdInside } from '../../src/model/strongholds/strongholds';
import { StrongholdRun } from '../../src/model/strongholds/strongholdFoes';
import { strongholdMoves, type StrongholdFight } from '../../src/model/strongholds/strongholdMoves';
import { HARDEST } from '../../src/model/strongholds/strongholdStage';
import type { Enemy, EnemyKind, GameEvent } from '../../src/model/types';
import { FRAME, TEST_MAP_SIZE, TEST_SEEDS } from './testWorld';

type Mocked = { [K in keyof DungeonHooks]: Mock<DungeonHooks[K]> };
export type Staged = ReturnType<typeof staged>;

export function staged(seed = TEST_SEEDS[0]) {
  const model = new GameModel(seed, TEST_MAP_SIZE);
  const inside = strongholdInside(model.seed, model.strongholds[0].entrance);
  const hero = Object.assign(model.hero, { x: inside.plan.door, z: inside.plan.depth - 1 });
  const game: Mocked = { strike: vi.fn(), arrow: vi.fn(), blow: vi.fn(), frost: vi.fn(), web: vi.fn(), report: vi.fn(), dropLoot: vi.fn(), dropCoins: vi.fn() };
  const slain = new Set<number>();
  let fight!: StrongholdFight;
  const run = new StrongholdRun(model.seed, inside, slain, hero, game, (f) => strongholdMoves((fight = f)));
  const far = (a: { x: number; z: number }, b: { x: number; z: number } = hero) => Math.hypot(a.x - b.x, a.z - b.z);
  return {
    model, inside, hero, game, slain, run, fight, far,
    moves: run.moves,
    level: inside.stronghold.level,
    // The frames run, `seconds` of them, or till `until` (looked at after each); whether it came.
    tick(seconds: number, until: () => boolean = () => false): boolean {
      for (let t = 0; t < seconds; t += FRAME) {
        run.update(FRAME);
        if (until()) return true;
      }
      return false;
    },
    // Only these left in it (the rest out of the scene: gone as the slain go, their posts not kept).
    only(...keep: Enemy[]): void {
      for (const foe of run.foes) if (!keep.includes(foe)) foe.state = 'dead';
    },
    // The hero stood `away` from `foe`, on a side with open floor and a clear view of it (the first of the four that has).
    // (`fits`: a side to a test's liking.)
    face(foe: Enemy, away: number, fits: (dx: number, dz: number) => boolean = () => true): { dx: number; dz: number } {
      const h = Math.SQRT1_2;
      for (const [dx, dz] of [[0, 1], [1, 0], [0, -1], [-1, 0], [h, h], [h, -h], [-h, h], [-h, -h]]) {
        const at = { x: foe.x + dx * away, z: foe.z + dz * away };
        const clear = Array.from({ length: Math.ceil(away * 5) + 3 }, (_, i) => 0.4 + i * 0.2).every((d) => !fight.blocked(foe.x + dx * d, foe.z + dz * d, 0.2)); // (nothing solid between, nor just past)
        if (!clear || !run.director.inView(at, foe) || !fits(dx, dz)) continue;
        Object.assign(hero, at);
        return { dx, dz };
      }
      throw new Error(`nowhere ${away} from the ${foe.kind} to stand`);
    },
    // One slain, as the game slays it (its run and its moves told).
    slay(foe: Enemy): GameEvent[] {
      Object.assign(foe, { hp: 0, state: 'dead' });
      return run.slay(foe, hero);
    },
    // A blow of the hero's landed on it (as hero/fighting.ts lands one: off its health, a flash, its own blow stopped).
    hit(foe: Enemy, damage = 1): void {
      Object.assign(foe, { hp: foe.hp - damage, hurtFor: 0.25, swingFor: null, state: 'chase' });
    },
    banners: (): string[] => game.report.mock.calls.map(([e]) => e).filter((e): e is Extract<GameEvent, { kind: 'banner' }> => e.kind === 'banner').map((e) => e.line),
    // Those called up mid-fight (not at a post), of a kind.
    called: (kind?: EnemyKind): Enemy[] => run.foes.filter((f) => f.state !== 'dead' && fight.placeOf(f)?.kind !== f.kind && (!kind || f.kind === kind)),
    // The hardest any one told blow may be here: never a hero of its level's whole health.
    hardest: Math.max(2, Math.floor(maxHpAt(inside.stronghold.level) * HARDEST)),
    blows: (): number[] => game.blow.mock.calls.map(([, damage]) => damage),
  };
}

// The first stronghold of the test seeds' with a pack to a test's liking: staged, and that pack's.
export function stagedWith(pick: (s: Staged) => Enemy[] | null): { s: Staged; pack: Enemy[] } {
  for (const seed of TEST_SEEDS) {
    if (new GameModel(seed, TEST_MAP_SIZE).strongholds.length === 0) continue;
    const s = staged(seed);
    const pack = pick(s);
    if (pack) return { s, pack };
  }
  throw new Error('no stronghold of the test seeds has such a pack');
}

// The packs of a staged run (each those posted together), in the wings' rooms.
export const packsOf = (s: Staged): Enemy[][] => {
  const packs = new Map<number, Enemy[]>();
  for (const foe of s.run.foes) {
    const pack = s.fight.placeOf(foe)!.pack;
    packs.set(pack, [...(packs.get(pack) ?? []), foe]);
  }
  return [...packs.values()];
};
