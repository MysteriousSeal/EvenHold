// @vitest-environment happy-dom
// QA: what the player reads, at its edges. The cast bar's (controller/skills/castOf.ts): none idle, the chops left
// chopping, what's being made and how many more. The skill ruler (skillRuler.ts) at the tiers' borders and the top;
// what a skill opens next (none at the top). The shift's status (jobs/shiftStatus.ts), by job. Behind the bar, what
// E would do (jobs/workPrompt.ts): each action its words, a dry tap faded.
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { castOf } from '../src/controller/skills/castOf';
import { nextMilestone, skillRuler } from '../src/controller/skills/skillRuler';
import { shiftStatus } from '../src/controller/jobs/shiftStatus';
import { workPrompt } from '../src/controller/jobs/workPrompt';
import { BarShift } from '../src/model/jobs/barShift';
import { chopsIn } from '../src/model/skills/lumber';
import { SKILLS, SKILL_MAX } from '../src/model/skills/skills';
import { TEST_MAP_SIZE } from './support/testWorld';

const fresh = () => new GameModel(1, TEST_MAP_SIZE);

describe('the cast bar', () => {
  it('shows nothing idle; chopping, the chops left and how far to the next; making, what and how many more', () => {
    const model = fresh();
    expect(castOf(model)).toBeNull();
    const tree = model.trees.find((t) => t.kind === 'birch')!;
    Object.assign(model.hero, { x: tree.x + 0.7, z: tree.z });
    model.hero.equipment.mainHand = 'hatchet';
    model.lumber.use();
    model.update(0, 0, model.lumber.chopSeconds / 2);
    const chop = castOf(model)!;
    expect(chop.label).toBe(`${chopsIn(tree, model.seed)} chops left`);
    expect(chop.progress).toBeCloseTo(0.5, 1);
    model.lumber.stop();
    model.hero.bag.birchLog = 4;
    model.woodworking.start('birchPlank', 4);
    expect(castOf(model)?.label).toBe('Birch plank · 4 to make');
    model.woodworking.stop();
    model.woodworking.start('birchPlank', 1);
    expect(castOf(model)?.label).toBe('Birch plank'); // (one: no count)
  });
});

describe('the skill ruler', () => {
  const blocks = (level: number) => Array.from(skillRuler(level).querySelectorAll('.skill-rule-tier')).map((b) => b.className.replace('skill-rule-tier', '').trim() || 'ahead');
  const fills = (level: number) => Array.from(skillRuler(level).querySelectorAll<HTMLElement>('.skill-rule-fill')).map((f) => f.style.width);

  it('lights the tier the level is in, those before full, those after bare; at a border, the next begun', () => {
    expect(blocks(1)).toEqual(['here', 'ahead', 'ahead', 'ahead']);
    expect(fills(1)).toEqual(['0%', '0%', '0%', '0%']);
    expect(blocks(75)).toEqual(['past', 'here', 'ahead', 'ahead']); // (75: a journeyman, just)
    expect(fills(75)).toEqual(['100%', '0%', '0%', '0%']);
    expect(blocks(149)).toEqual(['past', 'here', 'ahead', 'ahead']);
    expect(blocks(150)).toEqual(['past', 'past', 'here', 'ahead']);
  });

  it('at the top, all of it full; its tag on the level; the slim one without tag or names', () => {
    expect(blocks(SKILL_MAX)).toEqual(['past', 'past', 'past', 'past']);
    expect(fills(SKILL_MAX)).toEqual(['100%', '100%', '100%', '100%']);
    expect(skillRuler(120).querySelector('.skill-rule-notch')?.textContent).toBe('120');
    const slim = skillRuler(120, false);
    expect([slim.querySelector('.skill-rule-notch'), slim.querySelector('.skill-rule-names')]).toEqual([null, null]);
    expect(skillRuler(120).getAttribute('aria-valuenow')).toBe('120');
  });

  it('tells what a skill opens next and how far off; nothing past the last', () => {
    expect(nextMilestone('lumberjacking', 1)).toEqual({ ...SKILLS.lumberjacking.unlocks[1], levels: 24 });
    expect(nextMilestone('lumberjacking', 25)?.at).toBe(50); // (25 reached: the next)
    expect(nextMilestone('lumberjacking', SKILL_MAX)).toBeNull();
  });
});

describe('the shift status', () => {
  it("says the job's name, the time left, served, walked out, earned, and the job's own rows", () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    model.work.start(inn, 'innBarkeep');
    const bar = shiftStatus(model.work.shift!) as { name: string; shift: { left: string; rows: Array<[string, string]> } };
    expect(bar.name).toBe('Tending the bar');
    expect(bar.shift.left).toBe('2:30');
    expect(bar.shift.rows.map(([what]) => what)).toEqual(['In hand', 'Clean', 'Perfect run']);
    expect(bar.shift.rows[1][1]).toBe('6 tankards · 4 glasses');
    model.work.end(true);
    model.work.start(inn, 'innServer');
    const tables = shiftStatus(model.work.shift!) as { name: string; shift: { rows: Array<[string, string]> } };
    expect([tables.name, tables.shift.rows]).toEqual(['Serving the tables', [['Tray', 'nothing']]]);
    model.work.end(true);
  });
});

describe('behind the bar, what E would do', () => {
  it('says each: a pour (faded with no clean cup), stopping it, handing over, setting down, washing, gathering', () => {
    const model = fresh();
    const inn = model.entrances.find((e) => e.type === 'inn')!;
    model.enterRoom(inn);
    model.work.start(inn, 'innBarkeep');
    const shift = model.work.shift as BarShift;
    Object.assign(model.hero, shift.stations.tap);
    expect(workPrompt(model)).toMatchObject({ label: 'Pour an ale', muted: false });
    shift.clean.ale = 0;
    expect(workPrompt(model)).toMatchObject({ label: 'No clean tankards: wash some', muted: true });
    shift.clean.ale = 3;
    model.work.use();
    expect(workPrompt(model)?.label).toBe('Stop the pour');
    shift.pour = null;
    shift.held.push({ kind: 'empty', drink: 'ale' });
    Object.assign(model.hero, shift.stations.sink!);
    expect(workPrompt(model)?.label).toBe('Wash the empty');
    shift.held.push({ kind: 'empty', drink: 'wine' });
    expect(workPrompt(model)?.label).toBe('Wash 2 empties');
    model.work.end(true);
  });
});
