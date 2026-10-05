// How the shift under way stands (model/jobs/work.ts), for the place bar under the hero's frame (view/hud/placeBar.ts):
// the job's name, the time left as its bar, what's served, walked out and earned; and the job's own: the tray (serving
// the tables), or what's in hand, the clean cups left and the run of perfect pours (behind the bar).

import { BarShift } from '../../model/jobs/barShift';
import { JOBS } from '../../model/jobs/jobs';
import type { InnShift } from '../../model/jobs/innShift';
import { SHIFT } from '../../model/jobs/shift';
import type { PlaceBarShown } from '../../view/hud/placeBar';

const listed = (items: string[]) => items.join(', ') || 'nothing';

export function shiftStatus(shift: InnShift | BarShift): PlaceBarShown {
  const rows: Array<[string, string]> =
    shift instanceof BarShift
      ? [
          ['In hand', listed(shift.held.map((h) => (h.kind === 'empty' ? `empty ${h.drink === 'ale' ? 'tankard' : 'glass'}` : `${h.drink} (${h.grade})`)))],
          ['Clean', `${shift.clean.ale} tankards · ${shift.clean.wine} glasses`],
          ['Perfect run', `${shift.streak}${shift.best > shift.streak ? ` (best ${shift.best})` : ''}`],
        ]
      : [['Tray', listed(shift.tray.map((t) => (t.kind === 'order' ? t.want.order : 'empty')))]];
  const left = `${Math.floor(shift.left / 60)}:${String(Math.floor(shift.left % 60)).padStart(2, '0')}`;
  return { name: JOBS[shift.job].name, shift: { share: shift.left / SHIFT, left, served: shift.served, walkedOut: shift.walkedOut, earned: shift.earned, rows } };
}
