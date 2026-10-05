// @vitest-environment happy-dom
// The work window (controller/jobs/jobPanel.ts), a hiring notice: the job's stair of ranks (five steps, the hero's
// lit, filling toward the next), what the rank brings, the record, and at its foot what a shift is and the button to
// work one (starting it, and closing); at work, how the shift stands and the button to end it. The jobs posted (the
// tables, the bar) as a strip to pick from: the one picked worked, its own perks and keys; at work, the other's button
// stood down. Opened at an inn's notice board, and says which.
import { describe, expect, it, vi } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { enterNearest } from '../src/model/cheats';
import { JOBS, recordOf } from '../src/model/jobs/jobs';
import { createJobPanel } from '../src/controller/jobs/jobPanel';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));

function atTheInn() {
  for (const seed of TEST_SEEDS) {
    const model = new GameModel(seed, TEST_MAP_SIZE);
    if (!enterNearest(model, 'inn', new Set())) continue;
    return { model, inn: model.inside!.entrance, panel: createJobPanel(model, { setPaused: () => {} }) };
  }
  throw new Error('no inn');
}

// (the newest of a kind: each window made stays in the document)
const all = (selector: string) => Array.from(document.querySelectorAll(selector)) as HTMLElement[];
const q = (selector: string) => all(selector).at(-1)!;

describe('the work window', () => {
  it("shows the hero's standing as a stair of the job's ranks, what it brings, and their record", () => {
    const { model, inn, panel } = atTheInn();
    Object.assign(recordOf(model.hero, 'innServer'), { xp: 16, shifts: 1, served: 16, best: 16, earned: 107 });
    panel.open(inn);
    const steps = Array.from(q('.job-stair').querySelectorAll('li'));
    expect(steps).toHaveLength(JOBS.innServer.ranks.length);
    expect(steps.map((s) => s.className)).toEqual(['past', 'here', 'ahead', 'ahead', 'ahead']);
    expect((steps[1].querySelector('.job-step') as HTMLElement).style.getPropertyValue('--fill')).toBe('30%'); // (6 of 20 toward Server)
    expect(q('.job-standing strong').textContent).toBe('Serving hand');
    expect(q('.job-toward').textContent).toBe('6 of 20 served');
    expect(q('.job-next').textContent).toBe('toward Server');
    // What the rank brings beside the next's: a row a perk, the next's lit where it's better.
    const table = q('.job-perk-table');
    expect(Array.from(table.querySelectorAll('thead th')).map((th) => th.textContent)).toEqual(['', 'Serving hand', 'Server']);
    expect(Array.from(table.querySelectorAll('tbody th')).map((th) => th.textContent)).toEqual(['Tray', 'Patience', 'Tips']); // (no line: not behind the bar)
    expect(Array.from(table.querySelectorAll('tbody td.job-perk-next')).map((td) => td.classList.contains('up'))).toEqual([false, true, true]); // (the same tray; more patience, better tips)
    expect(q('.job-ledger').textContent).toContain('16 served');
    expect(q('.job-picks').hidden).toBe(false); // (the tables, the bar)
    expect(all('.job-picks').at(-1)!.querySelectorAll('.job-pick')).toHaveLength(2);
    expect(q('.job-speaker').textContent).toMatch(/^Pinned to the board at the .+ inn$/);
    panel.menu.close();
  });

  it('works a shift from its button (closing), and at work shows how it stands and ends it', () => {
    const { model, inn, panel } = atTheInn();
    panel.open(inn);
    expect(q('.job-go').textContent).toBe('Work a shift');
    expect(q('.job-terms').textContent).toContain('2½');
    expect(q('.job-terms').querySelectorAll('.job-term')).toHaveLength(3); // (the shift, its pay, the clean-shift bonus)
    expect(q('.job-keys').textContent).toContain('set it down');
    q('.job-go').click();
    expect(model.work.shift).not.toBeNull();
    expect(panel.menu.isOpen).toBe(false);
    panel.open(inn);
    expect(q('.job-foot').classList.contains('working')).toBe(true);
    expect(q('.job-terms').textContent).toContain('Time left');
    q('.job-go').click();
    expect(model.work.shift).toBeNull();
    expect(q('.job-go').textContent).toBe('Work a shift');
    panel.menu.close();
  });

  it('at the top of the trade: what the rank brings alone, no next', () => {
    const { model, inn, panel } = atTheInn();
    recordOf(model.hero, 'innServer').xp = 500;
    panel.open(inn);
    expect(q('.job-perk-table').querySelectorAll('thead th')).toHaveLength(2);
    expect(q('.job-perk-table').querySelectorAll('.job-perk-next')).toHaveLength(0);
    expect(q('.job-toward').textContent).toBe('The top of the trade');
    panel.menu.close();
  });

  it("picks the bar: its ranks, its perks (the hands, the line), its keys; worked from its button; at work, the tables' stood down", () => {
    const { model, inn, panel } = atTheInn();
    panel.open(inn);
    (Array.from(q('.job-picks').querySelectorAll('.job-pick')) as HTMLElement[])[1].click();
    expect(q('.job-head h2').textContent).toBe('Tending the bar');
    expect(q('.job-standing strong').textContent).toBe(JOBS.innBarkeep.ranks[0].name);
    expect(q('.job-brings').textContent).toContain('Hands');
    expect(q('.job-brings').textContent).toContain('Line±4.5%');
    expect(q('.job-keys').textContent).toContain('again at the line');
    q('.job-go').click();
    expect(model.work.shift?.job).toBe('innBarkeep');
    panel.open(inn);
    expect(q('.job-head h2').textContent).toBe('Tending the bar'); // (the one they're at)
    expect(q('.job-go').textContent).toBe('End the shift');
    (Array.from(q('.job-picks').querySelectorAll('.job-pick')) as HTMLElement[])[0].click();
    expect([q('.job-go').textContent, (q('.job-go') as HTMLButtonElement).disabled]).toEqual(['At work already', true]);
    panel.menu.close();
    model.work.end(true);
  });
});
