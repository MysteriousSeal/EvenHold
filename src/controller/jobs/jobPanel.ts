// The work to be had (E at an inn's notice board: "Look for work"), as a hiring notice pinned up there: the job
// (what it is), the hero's standing in it as a stair of its ranks (the one they're on lit, filling toward the next),
// what their rank brings beside what the next would, their record, and at the foot what a shift is (its length, its
// pay, its keys) with the button to work one; at work, how the shift stands and the button to end it. The jobs posted
// (serving the tables, tending the bar) as a strip across the top, the notice the one picked (at work, the one
// they're at). A window in the middle of the screen; the game waits while it's open.

import './jobPanel.css';
import type { GameModel } from '../../model/GameModel';
import type { Entrance } from '../../model/interiors/interiors';
import { villageName } from '../../model/villages/villageNames';
import { JOBS, JOB_IDS, rankIn, recordOf, type JobId, type JobRank } from '../../model/jobs/jobs';
import { bandOf } from '../../model/jobs/pour';
import { SHIFT, WAGE } from '../../model/jobs/shift';
import { BONUS } from '../../model/jobs/work';
import { bagIcon } from '../../view/ui/itemIcons';
import { coinParts } from '../../view/ui/coins';
import { createMenu, type Menu } from '../../view/ui/menu';
import { el } from '../../view/ui/dom';

const ICONS: Record<JobId, (size: number) => HTMLCanvasElement> = { innServer: bagIcon('ale'), innBarkeep: bagIcon('mead') };
// What's carried at once, by job (the tray's orders; the hands' drinks and empties), and how a shift's worked (E).
const CARRY: Record<JobId, string> = { innServer: 'Tray', innBarkeep: 'Hands' };
const KEYS: Record<JobId, string> = {
  innServer: 'take an order · fetch it from the bar · set it down · clear a table',
  innBarkeep: 'pour at the tap or a shelf, again at the line · hand it across · set the tables\' down at the end · gather and wash empties',
};

const hours = (seconds: number) => `${Math.round((seconds / 60) * 2) / 2} hours`.replace('.5', '½');
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;

// What a rank brings beside what the next would, as a table: a row for each perk (what's carried, a mug for each;
// patience; tips; behind the bar, how wide the line is), the next's lit where it's better. At the top, theirs alone.
function perkTable(job: JobId, rank: JobRank, next: JobRank | null): HTMLElement {
  const mugs = (n: number) => {
    const row = el('span', 'job-mugs');
    for (let i = 0; i < 3; i++) row.append(el('i', i < n ? 'job-mug' : 'job-mug empty'));
    return row;
  };
  const rows: Array<[string, (r: JobRank) => Node | string, (r: JobRank) => number]> = [
    [CARRY[job], (r) => mugs(r.tray), (r) => r.tray],
    ['Patience', (r) => (r.patience ? `+${r.patience}s` : '—'), (r) => r.patience],
    ['Tips', (r) => `×${r.tips}`, (r) => r.tips],
    ...(rank.steady !== undefined ? [['Line', (r: JobRank) => `±${Math.round(bandOf(r.steady) * 1000) / 10}%`, (r: JobRank) => r.steady ?? 0] as [string, (r: JobRank) => string, (r: JobRank) => number]] : []),
  ];
  const head = el('tr', undefined, el('th'), el('th', 'job-perk-now', rank.name), ...(next ? [el('th', 'job-perk-next', next.name)] : []));
  const body = rows.map(([label, show, worth]) => {
    const up = !!next && worth(next) > worth(rank);
    return el('tr', undefined, el('th', undefined, label), el('td', 'job-perk-now', show(rank)), ...(next ? [el('td', up ? 'job-perk-next up' : 'job-perk-next', show(next))] : []));
  });
  return el('table', 'job-perk-table', el('thead', undefined, head), el('tbody', undefined, ...body));
}

export function createJobPanel(model: GameModel, hooks: { setPaused(paused: boolean): void }): { open(inn: Entrance): void; menu: Menu } {
  let inn: Entrance | null = null;
  let job: JobId = JOB_IDS[0];
  let said = '';
  const board = el('div', 'job-board');

  // The notice, as it stands.
  const draw = () => {
    const { name, where, about, ranks } = JOBS[job];
    const record = recordOf(model.hero, job);
    const { rank, index, next, toward } = rankIn(job, record.xp);
    const shift = model.work.shift?.job === job ? model.work.shift : null; // (at work at this one)
    const elsewhere = !shift && model.work.shift ? JOBS[model.work.shift.job].name.toLowerCase() : null; // (at work at the other)

    // Where it's pinned up.
    const village = inn && model.villages.reduce((a, b) => (Math.hypot(b.x - inn!.x, b.z - inn!.z) < Math.hypot(a.x - inn!.x, a.z - inn!.z) ? b : a));
    const speaker = el('p', 'job-speaker', 'Pinned to the board at ', el('b', undefined, village ? `the ${villageName(village, model.seed)} inn` : 'the inn'));

    // The jobs to pick from, if there's more than one.
    const picks = el('div', 'job-picks');
    picks.hidden = JOB_IDS.length < 2;
    for (const id of JOB_IDS) {
      const pick = el('button', id === job ? 'job-pick on' : 'job-pick', ICONS[id](28), JOBS[id].name);
      pick.addEventListener('click', () => [(job = id), (said = ''), draw()]);
      picks.append(pick);
    }

    // The notice's head: the job, where it's had, what it is.
    const head = el('header', 'job-head', ICONS[job](56), el('div', undefined, el('span', 'job-eyebrow', where), el('h2', undefined, name), el('p', 'job-about', about)));

    // The stair of its ranks: each step higher; those climbed filled, the one they're on lit and filling toward the next.
    const stair = el('ol', 'job-stair');
    stair.setAttribute('aria-label', `Rank ${index + 1} of ${ranks.length}: ${rank.name}`);
    for (const [i, r] of ranks.entries()) {
      const step = el('li', i < index ? 'past' : i === index ? 'here' : 'ahead');
      const block = el('span', 'job-step');
      block.style.setProperty('--rise', String(i + 1));
      if (i === index) block.style.setProperty('--fill', `${Math.round(toward * 100)}%`);
      step.append(block, el('span', 'job-step-name', r.name));
      stair.append(step);
    }
    const standing = el(
      'div',
      'job-standing',
      el('span', 'job-label', 'Your standing'),
      el('strong', undefined, rank.name),
      el('span', 'job-toward', next ? `${record.xp - rank.from} of ${next.from - rank.from} served` : 'The top of the trade'),
      ...(next ? [el('span', 'job-next', `toward ${next.name}`)] : []),
    );

    // What the rank brings, beside what the next would.
    const brings = el('div', 'job-brings', el('span', 'job-label', next ? 'Your rank brings, and the next' : 'Your rank brings'), perkTable(job, rank, next));

    // Their record, as a ledger.
    const ledger = el('dl', 'job-ledger');
    const fact = (label: string, ...value: Array<string | Node>) => ledger.append(el('div', undefined, el('dt', undefined, label), el('dd', undefined, ...value)));
    fact('Shifts worked', String(record.shifts));
    fact('Orders served', String(record.served));
    fact('Best shift', record.best ? `${record.best} served` : '—');
    fact('Earned', ...(record.earned ? coinParts(record.earned) : ['—']));

    // At the foot: what a shift is and the button to work one; at work, how it stands and the button to end it.
    // Its terms as three cards (a big value, what it's of, a note), the keys under them, the button beside.
    const foot = el('footer', shift ? 'job-foot working' : 'job-foot');
    const button = el('button', 'job-go', shift ? 'End the shift' : elsewhere ? 'At work already' : 'Work a shift');
    button.disabled = !!elsewhere;
    if (elsewhere) button.title = `You're ${elsewhere} just now`;
    const term = (label: string, value: Array<string | Node>, note: string, tone = '') => el('div', `job-term ${tone}`, el('span', 'job-label', label), el('b', undefined, ...value), el('small', undefined, note));
    const terms = el('div', 'job-terms');
    if (shift) {
      terms.append(
        term('Time left', [clock(shift.left)], `of ${hours(SHIFT)}`),
        term('Served', [String(shift.served)], shift.walkedOut ? `${shift.walkedOut} walked out` : 'no one walked out', shift.walkedOut ? 'warn' : ''),
        term('Earned', coinParts(shift.earned), shift.walkedOut ? 'no clean-shift bonus' : `+${BONUS} each at the end`),
      );
    } else {
      terms.append(
        term('A shift', [hours(SHIFT).replace(' hours', ''), el('em', undefined, 'hours')], 'on the clock'),
        term('Pay', [...coinParts(WAGE), el('em', undefined, 'an order')], 'and a tip · paid when the shift ends'),
        term('Clean shift', [`+${BONUS}`, el('em', undefined, 'each')], 'if no one walks out'),
      );
    }
    const key = (cap: string, does: string) => el('span', 'job-key', el('kbd', undefined, cap), does);
    const keys = el('div', 'job-keys', key('E', KEYS[job]));
    foot.append(terms, keys, button);
    button.addEventListener('click', () => {
      if (shift) {
        model.work.end(true);
        said = '';
        return draw();
      }
      if (inn && model.work.start(inn, job)) return menu.close();
      said = 'Not here: ask at the inn you want to work in.';
      draw();
    });
    const answer = el('p', 'job-said', said);
    answer.hidden = !said;

    board.replaceChildren(speaker, picks, el('article', 'job-notice', head, el('section', 'job-rise', standing, stair), el('div', 'job-split', brings, ledger)), answer, foot);
    queueMicrotask(() => button.focus({ preventScroll: true })); // (Enter works it)
  };

  const menu = createMenu({
    title: 'Work',
    keyHints: false,
    onOpenChange: (open) => hooks.setPaused(open),
    tabs: [{ name: 'Jobs', header: () => (draw(), board) }],
  });
  return {
    menu,
    open(at) {
      [inn, said] = [at, ''];
      if (model.work.shift) job = model.work.shift.job; // (at work: the job they're at)
      menu.open();
    },
  };
}
