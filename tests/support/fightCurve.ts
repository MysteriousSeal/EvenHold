// Fights played out whole to measure the difficulty curve (tests/difficulty.test.ts): a hero at a stage of the game
// (their level, the points a player would have spent, the gear they'd wear), set on one foe, played as a masher (the
// attack held), an average player (three blows, a step back) or a parrier (the guard raised just as each blow lands).
import { GameModel } from '../../src/model/GameModel';
import { ENEMY_STATS } from '../../src/model/constants';
import { enemyPower } from '../../src/model/enemies/enemyLevels';
import { ENEMY_STRIKE } from '../../src/model/enemies/enemies';
import { TEST_MAP_SIZE } from './testWorld';
import { gainXp } from '../../src/model/hero/heroStats';
import { gearKey, slotOfGear } from '../../src/model/human/items/gear';
import { armorOf, maxHpOf, blowOf, critChanceOf, dodgeChanceOf } from '../../src/model/hero/attributes';
import type { Enemy, EnemyKind } from '../../src/model/types';
import { mulberry32 } from '../../src/util/random';

const F = 1 / 60;
type Piece = [string, number, string]; // item, level, rarity
export interface Stage { level: number; str: number; sta: number; agi?: number; kit: Piece[] }
const C = 'common', U = 'uncommon', R = 'rare';
const smith = (lvl: number, r = C): Piece[] => ['bascinet', 'ironPauldrons', 'breastplate', 'gauntlets', 'plateGreaves', 'sabatons', 'heaterShield', 'warHammer'].map((i) => [i, lvl, r]);
// (Three points a level, those past a stage's spent on Endurance, out of a fight: the curve as it was with one a level.)
export const STAGES: Stage[] = [
  { level: 1, str: 0, sta: 0, kit: [['hatchet', 1, C]] },
  { level: 3, str: 3, sta: 3, kit: [['hatchet', 1, C], ['nasalCap', 1, C], ['studdedPauldrons', 1, C], ['hobnailBoots', 1, C]] },
  { level: 5, str: 10, sta: 2, kit: [['armingSword', 4, C], ['mailCoif', 4, C], ['brigandine', 4, C], ['mailChausses', 4, C], ['buckler', 4, C]] },
  { level: 8, str: 14, sta: 4, kit: [...smith(7), ['barrowTorc', 4, R]] },
  { level: 12, str: 16, sta: 9, kit: [...smith(11, U), ['barrowTorc', 4, R]] },
  { level: 16, str: 27, sta: 10, agi: 8, kit: [['sunwardArmet', 15, 'legendary'], ['sunwardPauldrons', 14, 'epic'], ['sunwardCuirass', 16, 'legendary'], ['sunwardGauntlets', 14, 'epic'], ['sunwardSabatons', 14, 'epic'], ['sunwardAegis', 16, 'legendary'], ['plateGreaves', 15, U], ['warHammer', 15, R]] },
  { level: 20, str: 31, sta: 10, agi: 10, kit: [['sunwardArmet', 15, 'legendary'], ['sunwardPauldrons', 14, 'epic'], ['sunwardCuirass', 16, 'legendary'], ['sunwardGauntlets', 14, 'epic'], ['sunwardSabatons', 14, 'epic'], ['sunwardAegis', 16, 'legendary'], ['plateGreaves', 19, R], ['warHammer', 19, R]] },
];
export type Style = 'masher' | 'parrier' | 'average';

export function heroAt(m: GameModel, s: Stage) {
  const h = m.hero;
  let xp = 0; for (let l = 1; l < s.level; l++) xp += (50 + 7 * l) * (4 * l - 1);
  gainXp(h, xp);
  h.trained.strength += s.str; h.trained.stamina += s.sta; h.trained.agility += s.agi ?? 0; h.statPoints = 0;
  h.equipment = {} as any;
  for (const [item, level, rarity] of s.kit) { const k = gearKey({ item: item as any, level, rarity: rarity as any, roll: 500 } as any); (h.equipment as any)[slotOfGear(k)] = k; }
  h.hp = maxHpOf(h);
  return { hp: h.hp, armour: armorOf(h), blow: blowOf(h), crit: critChanceOf(h), dodge: dodgeChanceOf(h) };
}

// Each fight's rolls (crits, dodges, the foe's) seeded: the same fight every run, a bound never missed by luck.
export function fight(s: Stage, kind: EnemyKind, level: number, style: Style, maxT = 300, make?: (foe: Enemy) => void) {
  const random = Math.random;
  Math.random = mulberry32(level * 7919 + kind.length);
  try {
    return fought(s, kind, level, style, maxT, make);
  } finally {
    Math.random = random;
  }
}

function fought(s: Stage, kind: EnemyKind, level: number, style: Style, maxT: number, make?: (foe: Enemy) => void) {
  const m = new GameModel(1, TEST_MAP_SIZE);
  const sheet = heroAt(m, s);
  const h = m.hero;
  const e = m.enemies[0];
  for (const o of m.enemies) if (o !== e) { o.state = 'dead' as any; o.hp = 0; o.x = -999; }
  const p = enemyPower(kind, level);
  Object.assign(e, { kind, level, maxHp: p.maxHp, hp: p.maxHp, damage: p.damage, xp: p.xp, x: h.x + 1.2, z: h.z, homeX: h.x + 1.2, homeZ: h.z, state: 'chase', cooldown: 0, swingFor: null });
  make?.(e); // (made otherwise: a champion's, model/champions/)
  const st = ENEMY_STATS[kind];
  const hp0 = h.hp; let t = 0, burst = 0, rest = 0;
  let fell = false; // (a fall heals them and sends them off: told by it, not by their health)
  m.fall = () => void (fell = true);
  let low = h.hp; // (the least health they had)
  m.takeEvents();
  while (t < maxT && e.state !== 'dead' && !fell) {
    const dx = e.x - h.x, dz = e.z - h.z, d = Math.max(1e-6, Math.hypot(dx, dz));
    let mx = 0, mz = 0;
    const landing = e.swingFor !== null ? st.swing * ENEMY_STRIKE - e.swingFor : 99;
    const reach = 0.75 + st.radius;
    if (style === 'parrier') {
      if (landing < 0.12 && landing > -0.01) m.raiseGuard(true); else { m.raiseGuard(false); if (d < reach && e.swingFor === null) m.startAttack(); } // (never a blow begun into its wind-up: the guard's wanted)
      if (d > reach - 0.1) { mx = dx / d; mz = dz / d; }
    } else if (style === 'average') {
      // three blows, then a step back and a breather (0.8 s), as most players fight
      if (rest > 0) { rest -= F; mx = -dx / d * 0.6; mz = -dz / d * 0.6; }
      else { if (d > reach - 0.1) { mx = dx / d; mz = dz / d; } else if (m.startAttack()) { if (++burst >= 3) { burst = 0; rest = 0.8; } } }
    } else {
      if (d > reach - 0.1) { mx = dx / d; mz = dz / d; }
      m.startAttack();
    }
    h.facing = Math.atan2(dx, dz);
    m.update(mx, mz, F); t += F;
    low = Math.min(low, h.hp);
    m.takeEvents();
  }
  return { won: e.state === 'dead' && !fell, died: fell, t, lost: hp0 - low, hp0, foeHp: e.maxHp, foeDmg: e.damage, sheet };
}
