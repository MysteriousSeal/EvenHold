// A champion's trait while it fights (champions.ts; run with its dungeon's foes: dungeons/dungeonFoes.ts), each told
// large as it turns:
// - unburied: felled the first time, it's held at its last breath (its turn, enemies/bossPhases.ts) and gets up
//   again, UNBURIED_BACK of its health back;
// - brood: at half its health, its brood called up round it, set on the hero;
// - frenzy: a third of its health left, its blows come one on another;
// - pots: its fire-pots three at a throw (strongholds/strongholdPack.ts asks potsAt).
import type { Enemy, EnemyKind, GameEvent } from '../types';
import { makeEnemy } from '../enemies/enemies';
import { CHAMPIONS, CHAMPION_DAMAGE, CHAMPION_HP, CHAMPION_XP, championName, type ChampionId } from './champions';

export const UNBURIED_BACK = 0.6; // of its health, back as it gets up
export const BROOD_AT = 0.5; // of its health, under it: its brood called up
export const FRENZY_AT = 1 / 3; // of its health, under it: quickened
const FRENZY_COOLDOWN = 0.4; // seconds between its blows, at most, quickened
const LAST_BREATH = 1e-3; // (a turn just over nothing: held at a single point, enemies/bossPhases.ts)

// Whether a foe is a champion whose fire-pots fly three at a throw.
export const potsAt = (foe: Enemy): number => (foe.champion && CHAMPIONS[foe.champion].trait === 'pots' ? 3 : 1);

// The champion `champion` made, its id `id`, standing at (x, z), the place being of `level`.
export function makeChampion(id: number, champion: ChampionId, x: number, z: number, level: number): Enemy {
  const { kind } = CHAMPIONS[champion];
  const foe = makeEnemy(id, kind, x, z, x, z, level + 1);
  const maxHp = Math.round(foe.maxHp * CHAMPION_HP);
  return { ...foe, maxHp, hp: maxHp, damage: Math.round(foe.damage * CHAMPION_DAMAGE), xp: foe.xp * CHAMPION_XP, name: championName(champion), champion };
}

export class ChampionRun {
  private turned = false; // its trait's turn taken (risen, its brood called, quickened)

  constructor(
    readonly foe: Enemy & { champion: ChampionId },
    private readonly call: (kind: EnemyKind, at: { x: number; z: number }, count: number) => void, // its brood, called up round it
    private readonly report: (event: GameEvent) => void,
  ) {
    const { trait } = CHAMPIONS[foe.champion];
    if (trait === 'unburied') foe.phases = [LAST_BREATH];
    if (trait === 'brood') foe.phases = [BROOD_AT];
  }

  update(): void {
    const { foe, turned } = this;
    if (foe.state === 'dead') return;
    const champion = CHAMPIONS[foe.champion];
    const told = (line: string) => this.report({ kind: 'banner', title: foe.name ?? champion.name, line });
    if (champion.trait === 'unburied' && !turned && foe.hp <= 1) {
      this.turned = true;
      foe.phases = undefined;
      foe.hp = Math.round(foe.maxHp * UNBURIED_BACK);
      [foe.swingFor, foe.hurtFor] = [null, 0.6];
      told(champion.kind === 'caveSpider' ? 'She was only shamming: up again' : 'Will not stay down: up again');
    }
    if (champion.trait === 'brood' && !turned && foe.hp <= foe.maxHp * BROOD_AT) {
      this.turned = true;
      foe.phases = undefined;
      this.call(champion.brood!.kind, foe, champion.brood!.count);
      told(champion.told);
    }
    if (champion.trait === 'frenzy' && foe.hp < foe.maxHp * FRENZY_AT) {
      if (!turned) told(`${champion.told}: blow on blow`);
      this.turned = true;
      foe.cooldown = Math.min(foe.cooldown, FRENZY_COOLDOWN);
    }
  }
}
