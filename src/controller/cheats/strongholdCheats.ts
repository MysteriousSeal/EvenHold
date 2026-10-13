// The bandit strongholds' row in the cheat menu's Go to tab (cheatPanel.ts: among its dungeons, beside the crypts'
// and the caves'): to the nearest not yet visited, before its gate, each in turn (all seen, round again).
import type { GameModel } from '../../model/GameModel';
import { nextStronghold, type Tile } from '../../model/cheats';
import type { Stronghold } from '../../model/strongholds/strongholds';
import type { MenuAction, MenuIcon } from '../../view/ui/menu';

// `here`: where the hero stands; `travel`: the panel's own (there, and the menu shut: what's said of it).
export function strongholdAction(model: GameModel, icon: MenuIcon, here: () => Tile, travel: (tile: Tile | null, where: string) => string): MenuAction {
  const seen = new Set<Stronghold>(); // the strongholds' tour: nearest first, no repeats
  return { icon, title: 'Next stronghold', detail: 'The nearest bandit stronghold you haven’t visited, before its gate', run: () => travel(nextStronghold(model, here(), seen), `stronghold ${seen.size} of ${model.strongholds.length}`) };
}
