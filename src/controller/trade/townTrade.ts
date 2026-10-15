// Greyminster's people spoken to (main.ts' trade, E by them): a stall's keeper (the pardoner too) opens their stall
// (stallPanel.ts); one of the town's callings says their word (model/town/townCallings.ts).

import type { GameModel } from '../../model/GameModel';
import type { Npc } from '../../model/npcs/npcs';
import { say } from '../../model/npcs/speech';
import { callingWord, isCalling } from '../../model/town/townCallings';
import { createStallPanel } from './stallPanel';
import type { TradeBag } from './tradePanel';

export function createTownTrade(model: GameModel, hooks: { bag?: TradeBag }): { trade(who: Npc): boolean; update(): void } {
  const stalls = createStallPanel(model, hooks);
  return {
    // Whether `who` is one of the town's (their stall opened, or their word said).
    trade(who) {
      if (who.stall) stalls.open(who);
      else if (isCalling(who.role)) say(who, callingWord(who));
      else return false;
      return true;
    },
    update: () => stalls.update(),
  };
}
