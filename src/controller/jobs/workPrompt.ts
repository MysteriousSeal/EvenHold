// What E would do at work (model/jobs/work.ts), as the prompt over where it's done (and before an inn's notice board,
// its work). Serving the tables: take a patron's order; set theirs down, off the tray; clear a table's empties; at the
// counter's end, give back empties and take up what's ready. Behind the bar: start a pour at the tap or a shelf (faded,
// with no clean cup for it), stop it; hand a patron theirs; set the tables' down at the pass; gather empties, wash them.

import type { GameModel } from '../../model/GameModel';
import { ORDER_NAMES } from '../../model/jobs/innShift';
import { boardFace, isBarAction } from '../../model/jobs/work';
import type { BarAction } from '../../model/jobs/barShift';
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
  const { hero } = model;
  const bar = (a: BarAction): PromptTarget => {
    const over = (label: string, muted = false) => ({ label, muted, x: hero.x, y: hero.y + 1.15, z: hero.z });
    const cups = (drink: string) => (drink === 'ale' ? 'tankards' : 'glasses');
    switch (a.kind) {
      case 'stop':
        return over('Stop the pour');
      case 'pour':
        return a.dry ? over(`No clean ${cups(a.drink)}: wash some`, true) : over(a.drink === 'ale' ? 'Pour an ale' : 'Pour a glass of wine');
      case 'hand':
        return { label: `Hand ${a.want.npc.name} ${ORDER_NAMES[a.want.drink]}`, x: a.want.npc.x, y: 1.25, z: a.want.npc.z, npc: a.want.npc };
      case 'pass':
        return over(`Set ${a.drinks === 1 ? 'it' : `${a.drinks} drinks`} down for the tables`);
      case 'wash':
        return over(`Wash ${counted(a.empties, 'the empty', 'empties')}`);
      case 'gather':
        return over(`Gather ${counted(a.empties, 'the empty', 'empties')}`);
    }
  };
  if (isBarAction(action)) return bar(action);
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
