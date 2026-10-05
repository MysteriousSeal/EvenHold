// What E would do at work (model/jobs/work.ts), as the prompt over where it's done (and before an inn's notice board,
// its work): take a patron's order; set theirs down, off the tray; clear a table's empties; at the counter's end,
// give back empties and take up what's ready.

import type { GameModel } from '../../model/GameModel';
import { ORDER_NAMES } from '../../model/jobs/innShift';
import { boardFace } from '../../model/jobs/work';
import type { PromptTarget } from '../../view/hud/lootPrompt';

const counted = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function workPrompt(model: GameModel): PromptTarget | null {
  const action = model.work.action;
  if (!action) {
    const board = model.work.noticeInReach && model.inside?.furniture.find((f) => f.kind === 'noticeBoard');
    if (!board) return null;
    const face = boardFace(board); // (over the middle of it)
    return { label: model.work.shift ? 'Check your shift' : 'Look for work', x: face.x + (board.wall === 'left' ? 0.2 : 0), y: 1.25, z: face.z + (board.wall === 'left' ? 0 : 0.2) }; // (the inn's notice board: its work)
  }
  switch (action.kind) {
    case 'take':
      return { label: `Take ${action.want.npc.name}'s order`, x: action.want.npc.x, y: 1.1, z: action.want.npc.z, npc: action.want.npc }; // (their name giving way to it)
    case 'serve': {
      const { npc, order } = action.want;
      return { label: `Set down ${ORDER_NAMES[order]} for ${npc.name}`, x: npc.x, y: 1.1, z: npc.z, npc };
    }
    case 'clear':
      return { label: `Clear ${counted(action.empties.length, 'the empty', 'empties')}`, x: action.table.x, y: 0.9, z: action.table.z };
    case 'counter': {
      const spot = model.work.shift!.pickupSpot;
      const parts = [...(action.returns ? [`give back ${counted(action.returns, 'the empty', 'empties')}`] : []), ...(action.wants.length ? [`take ${action.wants.length === 1 ? ORDER_NAMES[action.wants[0].order] : `${action.wants.length} orders`}`] : [])];
      const label = parts.join(', ');
      return { label: label.charAt(0).toUpperCase() + label.slice(1), x: spot.x, y: 1.05, z: spot.z };
    }
  }
}
