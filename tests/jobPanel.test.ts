// @vitest-environment happy-dom
// The work window (controller/jobs/jobPanel.ts), a hiring notice: the job's stair of ranks (five steps, the hero's
// lit, filling toward the next), what the rank brings, the record, and at its foot what a shift is and the button to
// work one (starting it, and closing); at work, how the shift stands and the button to end it. One job: no strip of
// jobs to pick from. Opened at an inn's notice board, and says which.
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
    expect(q('.job-toward').textContent).toBe('6 of 20 served toward Server');
    expect(q('.job-brings').querySelectorAll('.job-perks')).toHaveLength(2); // (theirs, and the next's)
    expect(q('.job-ledger').textContent).toContain('16 served');
    expect(q('.job-picks').hidden).toBe(true); // (one job: nothing to pick)
    expect(q('.job-speaker').textContent).toMatch(/^Pinned to the board at the .+ inn$/);
    panel.menu.close();
  });

  it('works a shift from its button (closing), and at work shows how it stands and ends it', () => {
    const { model, inn, panel } = atTheInn();
    panel.open(inn);
    expect(q('.job-go').textContent).toBe('Work a shift');
    expect(q('.job-terms').textContent).toContain('2½');
    expect(q('.job-terms').querySelectorAll('.job-term')).toHaveLength(3); // (the shift, its pay, the clean-shift bonus)
    expect(q('.job-keys').textContent).toContain('switch');
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
});
