// The journal's Places (journal.ts): what the hero's found, land by land: each village found and what lies nearest it
// of the places come upon (a crypt, a cave, a stronghold, a camp: cleared or not) and the landmarks seen (model/atlas),
// with the map's marks (view/atlas/mapMarks.ts); a tally a land, and the world's, over them.

import type { Landmark, Place } from '../../model/atlas/atlas';
import type { Village } from '../../model/types';
import { villageName } from '../../model/villages/villageNames';
import { MARK_NAME, markIcon, type MarkKind } from '../../view/atlas/mapMarks';
import { line } from '../../view/ui/dom';
import { capitalize } from '../../util/text';
import type { MenuSlot, MenuTab } from '../../view/ui/menuTypes';

// What it's read from (the game's model, or less).
export interface FoundWorld {
  seed: number;
  villages: readonly Village[];
  atlas: { fog: { seen(x: number, z: number): boolean }; places(): readonly Place[]; landmarks(): readonly Landmark[] };
}

export interface FoundRow {
  kind: MarkKind;
  name: string;
  state?: 'Cleared' | 'Not cleared'; // (a place's: a village's or a landmark's, none)
}
export interface Region {
  name: string;
  tally: string;
  rows: FoundRow[];
}

const LANDMARKS: ReadonlySet<MarkKind> = new Set(['menhir', 'tor', 'snag']);
const tally = (rows: readonly FoundRow[]) => `${rows.length} found · ${rows.filter((r) => r.state === 'Cleared').length}/${rows.filter((r) => r.state).length} cleared`;

// The lands found, each under the village found nearest (none found: none), and the world's tally.
export function placesFound(world: FoundWorld): { regions: Region[]; total: string } {
  const found = world.villages.filter((v) => world.atlas.fog.seen(v.x, v.z));
  const rows = found.map((v): FoundRow[] => [{ kind: v.town ? 'town' : 'village', name: villageName(v, world.seed) }]);
  const nearest = (x: number, z: number) => found.reduce((best, v, i) => (Math.hypot(v.x - x, v.z - z) < Math.hypot(found[best].x - x, found[best].z - z) ? i : best), 0);
  if (found.length) {
    for (const p of world.atlas.places()) rows[nearest(p.x, p.z)].push({ kind: p.kind, name: p.name, state: p.cleared ? 'Cleared' : 'Not cleared' });
    for (const l of world.atlas.landmarks()) rows[nearest(l.x, l.z)].push({ kind: l.kind, name: MARK_NAME[l.kind] });
  }
  const regions = found.map((v, i) => ({ name: `${villageName(v, world.seed)}'s lands`, tally: tally(rows[i]), rows: rows[i] }));
  const all = rows.flat();
  return { regions, total: tally(all).replace('found', all.length === 1 ? 'place found' : 'places found') };
}

// The tab: a row a thing found (its mark, its name, what it is; cleared or not), under its land's header and tally.
export function placesTab(world: FoundWorld): MenuTab {
  return {
    name: 'Places',
    slots: () => {
      const { regions } = placesFound(world);
      const cells: MenuSlot[] = [];
      const sections = regions.map((r) => {
        const from = cells.length;
        for (const row of r.rows) {
          cells.push({
            key: `${cells.length}:${row.kind}:${row.name}`,
            icon: (px) => markIcon(row.kind, px),
            title: capitalize(row.name), // ("the grave halls of…": at a row's head)
            note: LANDMARKS.has(row.kind) ? 'Landmark' : MARK_NAME[row.kind],
            ...(row.state && { badge: row.state, badgeTone: row.state === 'Cleared' ? ('ready' as const) : ('progress' as const) }),
          });
        }
        return { title: `${r.name} · ${r.tally}`, from };
      });
      return { cells, columns: 1, rows: true, sections };
    },
    header: () => {
      const { regions, total } = placesFound(world);
      const row = document.createElement('div');
      row.className = 'journal-head';
      row.append(line('quest-board-lead', regions.length ? `All your travels: ${total}.` : 'Nothing found yet. Walk off the road: villages, crypts, caves and camps go in here as you come upon them.'));
      return row;
    },
  };
}
