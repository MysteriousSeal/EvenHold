// At work (model/jobs/innShift.ts), what's to be seen over the inn's tables: over each patron waiting on the hero, a
// mark of where things stand with them (a "!" calling to be served; their order, once taken: "…" while the barkeep
// has it or it waits at the counter, its name once it's on the tray), in the colour of their patience (green, then
// amber, then red); over each table with empties left on it, "Clear" (and how many), in the lake's teal; and over
// the end of the counter, "Ready!" while an order waits there to be fetched. Off shift, over
// the inn's notice board, the village boards' "!" (bobbing as theirs do): work to be had there.

import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Want } from '../../../model/jobs/innShift';
import type { Furniture } from '../../../model/interiors/furniture';
import { INDOOR_SCALE } from '../../../model/constants';
import { nameLabel } from '../common/overhead';
import { markBob, offerMark } from '../quest/questMarks';
import { boardFace } from '../../../model/jobs/work';

const OVER_SEATED = 0.72 * INDOOR_SCALE; // over a seated patron's head, in the room's units
const OVER_COUNTER = 0.85 * INDOOR_SCALE;
const HEIGHT = 0.3; // the mark's height
const OVER_TABLE = 0.95; // over a table's top (0.44), clear of the empties on it
const CLEAR_INK = '#3dbdb8'; // the lake's teal: a chore, apart from patience's green, amber and red
const OVER_NOTICE = 1.14; // just over the inn's notice board's little roof (its voxels' top, 26 of 25 a tile: 1.04), in the room's units
const NOTICE_MARK_SCALE = 0.6;
const OFF_WALL = 0.08; // out from the wall it hangs on (its roof's depth, half of it)
const ORDER_WORD: Record<Want['order'], string> = { ale: 'Ale', wine: 'Wine', pie: 'Pie' };
const patienceInk = (share: number) => (share > 0.6 ? '#8fd36a' : share > 0.3 ? '#ffc94a' : '#ff6a5a');

export class WorkMarks {
  private readonly marks = new Map<Want | Furniture | 'ready', { sprite: THREE.Sprite; text: string }>();
  private readonly notice = offerMark();

  // Each frame, in the room's scene (`scene`): the marks there should be, each in its place and colour; the rest gone.
  update(model: GameModel, scene: THREE.Object3D, time: number): void {
    const shift = model.work.shift;
    this.noticeMark(model, scene, time);
    const wanted = new Map<Want | Furniture | 'ready', { text: string; ink: string; x: number; y: number; z: number }>();
    if (shift && model.inside?.entrance === shift.inn) {
      for (const want of shift.wants.values()) {
        const text = want.state === 'calling' ? '!' : want.state === 'ordered' ? '…' : ORDER_WORD[want.order]; // (with the barkeep: waiting; on the tray: what's coming)
        wanted.set(want, { text, ink: patienceInk(want.patience / want.of), x: want.npc.x, y: OVER_SEATED, z: want.npc.z });
      }
      const cluttered = new Map<Furniture, number>();
      for (const empty of shift.empties) cluttered.set(empty.table, (cluttered.get(empty.table) ?? 0) + 1);
      for (const [table, n] of cluttered) wanted.set(table, { text: n > 1 ? `Clear ×${n}` : 'Clear', ink: CLEAR_INK, x: table.x + (table.w - 1) / 2, y: OVER_TABLE, z: table.z + (table.d - 1) / 2 });
      if (shift.readyOrders.length > 0) wanted.set('ready', { text: 'Ready!', ink: '#ffd96a', ...shift.pickupSpot, y: OVER_COUNTER });
    }
    for (const [key, mark] of this.marks) {
      if (wanted.has(key)) continue;
      mark.sprite.removeFromParent();
      this.marks.delete(key);
    }
    for (const [key, { text, ink, x, y, z }] of wanted) {
      let mark = this.marks.get(key);
      const shown = `${text}|${ink}`;
      if (mark?.text !== shown) {
        mark?.sprite.removeFromParent();
        mark = { sprite: nameLabel(text, HEIGHT, ink), text: shown }; // (its look changed: a fresh one, the label materials kept by text and ink)
        this.marks.set(key, mark);
      }
      if (mark.sprite.parent !== scene) scene.add(mark.sprite);
      mark.sprite.position.set(x, y, z);
    }
  }

  // Off shift, in an inn: the "!" over its notice board (work to be had), bobbing; else none.
  private noticeMark(model: GameModel, scene: THREE.Object3D, time: number): void {
    const { inside } = model;
    const board = !model.work.shift && inside && !inside.below && inside.entrance.type === 'inn' ? inside.furniture.find((f) => f.kind === 'noticeBoard') : undefined;
    this.notice.visible = !!board;
    if (!board || !inside) return;
    if (this.notice.parent !== scene) scene.add(this.notice);
    const face = boardFace(board);
    const [wx, wz] = board.wall === 'left' ? [OFF_WALL, 0] : [0, OFF_WALL]; // (out from its wall)
    this.notice.scale.setScalar(NOTICE_MARK_SCALE);
    this.notice.position.set(face.x + wx, OVER_NOTICE + markBob(time, 0), face.z + wz);
  }
}
