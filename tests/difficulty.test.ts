// The difficulty, played out (support/fightCurve.ts): no foe beaten unhurt by holding the attack down (poise:
// enemies/poise.ts), unless it's a light one; and the curve, a stage at a time: the first fights survivable, a crypt's
// lord a fight of a while at level 5, the steadier foes still a fight, and still biting, at level 12.
import { describe, expect, it } from 'vitest';
import { STAGES, fight } from './support/fightCurve';
import { blowsToFlinch, flinches } from '../src/model/enemies/poise';
import { makeEnemy } from '../src/model/enemies/enemies';
import { BOSS_PHASES, phaseFloor } from '../src/model/enemies/bossPhases';
import { CAPTAIN, GAOLER, HOUNDMASTER, QUARTERMASTER } from '../src/model/strongholds/strongholdBosses';
import { KING } from '../src/model/strongholds/strongholdKing';
import { BROOD_AT } from '../src/model/caves/caveFoes';
import { strike } from '../src/model/hero/fighting';
import { fresh } from './support/testWorld';

const stage = (level: number) => STAGES.find((s) => s.level === level)!;

describe('poise', () => {
  it('the light flinch at every blow; the steadier at the second within a moment; the heavy and the bosses never, unless caught open', () => {
    const [wolf, boar, draugr] = [makeEnemy(1, 'wolf', 0, 0), makeEnemy(2, 'boar', 0, 0), makeEnemy(3, 'draugr', 0, 0)];
    expect([flinches(wolf, 0, false), flinches(wolf, 0.1, false)]).toEqual([true, true]);
    expect([flinches(boar, 0, false), flinches(boar, 1, false), flinches(boar, 1.2, false), flinches(boar, 5, false)]).toEqual([false, true, false, false]); // (the third: counting afresh; the fourth: long after)
    expect([flinches(draugr, 0, false), flinches(draugr, 0.2, false), flinches(draugr, 0.4, false), flinches(draugr, 0.6, true)]).toEqual([false, false, false, true]);
    expect([blowsToFlinch('cryptLord'), blowsToFlinch('banditKing'), blowsToFlinch('bandit'), blowsToFlinch('wolf')]).toEqual([Infinity, Infinity, 2, 1]);
  });

  it('a bandit, held down on, still lands its blows at their level (the second blow only flinches it)', { timeout: 300_000 }, () => {
    for (const level of [5, 8, 12]) expect(fight(stage(level), 'bandit', level, 'masher').lost, `L${level}`).toBeGreaterThan(0);
  });

  it('a hero holding the attack down never beats a boar, a camp chief or a draugr unhurt', { timeout: 300_000 }, () => {
    for (const [kind, level] of [['boar', 3], ['banditChief', 5], ['draugr', 8]] as const) {
      const r = fight(stage(1), kind, level, 'masher', 120);
      expect(r.won && r.lost === 0, `${kind} L${level}: ${JSON.stringify({ won: r.won, lost: r.lost, t: r.t })}`).toBe(false);
    }
  });
});

describe('the curve', () => {
  it('level 1: a lynx or a bear is beaten however played, the hero still standing', { timeout: 300_000 }, () => {
    for (const kind of ['lynx', 'bear'] as const) for (const style of ['masher', 'average', 'parrier'] as const) {
      const r = fight(stage(1), kind, 1, style);
      expect([r.won, r.died], `${kind} ${style}: ${JSON.stringify({ t: r.t, lost: r.lost })}`).toEqual([true, false]);
    }
  });

  it('level 3: the first crypt lord beaten by a player who steps back, and unhurt by one who parries (each parry a moment\'s peace: it reels, then waits its turn)', { timeout: 300_000 }, () => {
    const [average, parrier] = [fight(stage(3), 'cryptLord', 3, 'average'), fight(stage(3), 'cryptLord', 3, 'parrier')];
    expect([average.won, parrier.won, parrier.lost]).toEqual([true, true, 0]);
  });

  it('level 5: a crypt lord of their level a fight of 12 to 30 seconds (parried, the quicker); held down, the attack loses it', { timeout: 300_000 }, () => {
    expect(fight(stage(5), 'cryptLord', 5, 'masher').died).toBe(true);
    for (const style of ['average', 'parrier'] as const) {
      const r = fight(stage(5), 'cryptLord', 5, style);
      expect(r.won && r.t >= 12 && r.t <= 30, `${style}: ${JSON.stringify({ won: r.won, t: r.t, lost: r.lost })}`).toBe(true);
    }
  });

  it('levels 1, 3 and 5: the brood mother of their level beaten by a player who steps back, at a cost, and unhurt by one who parries', { timeout: 300_000 }, () => {
    for (const level of [1, 3, 5]) {
      const [average, parrier] = [fight(stage(level), 'broodMother', level, 'average'), fight(stage(level), 'broodMother', level, 'parrier')];
      expect([average.won, average.lost > 0, parrier.won, parrier.lost], `L${level}: ${JSON.stringify({ t: average.t, lost: average.lost, of: average.hp0 })}`).toEqual([true, true, true, 0]);
    }
  });

  it('level 12, in good gear: the steadier foes of their level still a fight of seconds, and still biting', { timeout: 300_000 }, () => {
    for (const kind of ['bear', 'draugr', 'banditChief', 'bruiser'] as const) {
      const r = fight(stage(12), kind, 12, 'average');
      expect(r.won && r.t >= 3 && r.lost >= 5, `${kind}: ${JSON.stringify({ won: r.won, t: r.t, lost: r.lost })}`).toBe(true);
    }
  });
});

describe("a boss's turns", () => {
  it('are where each boss turns (its own shares); no blow takes a boss past the next, held there till it has turned; a burst skips none', () => {
    expect([BOSS_PHASES.houndmaster, BOSS_PHASES.quartermaster, BOSS_PHASES.gaoler, BOSS_PHASES.captain, BOSS_PHASES.banditKing, BOSS_PHASES.broodMother]).toEqual([HOUNDMASTER.under, QUARTERMASTER.under, GAOLER.under, CAPTAIN.under, KING.under, BROOD_AT]);
    const model = fresh();
    const king = { ...makeEnemy(9100, 'banditKing', model.hero.x, model.hero.z + 0.5, model.hero.x, model.hero.z, 10), state: 'chase' as const };
    const turns = (BOSS_PHASES.banditKing ?? []).map((share) => Math.floor(king.maxHp * share));
    strike(model, king, king.maxHp, false); // (a blow of his whole health)
    expect(king.hp).toBe(turns[0]);
    strike(model, king, king.maxHp, false);
    expect(king.hp).toBe(turns[1]);
    strike(model, king, king.maxHp, false);
    expect(king.state).toBe('dead');
    const wolf = makeEnemy(9101, 'wolf', 0, 0);
    expect(phaseFloor(wolf)).toBe(-Infinity);
  });
});

describe('a build of their own (training.ts: three points a level)', () => {
  it('level 6 in smith plate, against the brood mother: all Stamina outlasts all Strength (slower to win, longer to fall)', { timeout: 300_000 }, () => {
    const kit = ['bascinet', 'ironPauldrons', 'breastplate', 'gauntlets', 'plateGreaves', 'sabatons', 'heaterShield', 'warHammer'].map((i): [string, number, string] => [i, 5, 'common']);
    for (const style of ['masher', 'average'] as const) {
      const [str, sta] = [fight({ level: 6, str: 15, sta: 0, kit }, 'broodMother', 6, style), fight({ level: 6, str: 0, sta: 15, kit }, 'broodMother', 6, style)];
      const lasts = (r: typeof str) => (r.hp0 * r.t) / r.lost; // (seconds to fall, at the rate it lost health)
      expect(str.t, style).toBeLessThan(sta.t);
      expect(lasts(sta), `${style}: ${lasts(sta).toFixed(1)}s against ${lasts(str).toFixed(1)}s`).toBeGreaterThan(lasts(str) * 1.4);
      expect(sta.hp0 - sta.lost, style).toBeGreaterThan(str.hp0 - str.lost);
    }
  });
});
