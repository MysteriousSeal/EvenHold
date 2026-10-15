// What the cheat menu's tabs (cheatPanel.ts, lookCheats.ts, itemCheats.ts) build their rows with.
import type { GameModel } from '../../model/GameModel';
import { addToBag, type BagItem } from '../../model/hero/bag';
import type { MenuAction } from '../../view/ui/menu';

// A row that's on or off: flipped each use, what's said of it as it's left.
export const toggle = (get: () => boolean, set: (on: boolean) => void, on: string, off: string): Pick<MenuAction, 'run' | 'isOn'> => ({
  isOn: get,
  run: () => {
    set(!get());
    return get() ? on : off;
  },
});

// A run of rows under one header (`section` on the first).
export const group = (section: string, actions: MenuAction[]): MenuAction[] => actions.map((a, i) => (i === 0 ? { ...a, section } : a));

// Puts each of `items` in the bag (room or not: a cheat).
export const give = (model: Pick<GameModel, 'hero'>, items: readonly BagItem[]): void => items.forEach((item) => addToBag(model.hero.bag, item));
