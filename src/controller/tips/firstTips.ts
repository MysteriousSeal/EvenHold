// The first hour's tips: a line or two, once each, the moment each thing first matters (no wall of words at the
// start, only where to go: the carter, his ! over him, a few steps off): hurt, with nothing that heals on its own; tired, and what brings energy back; out of breath in a fight; a
// foe closing in, and the guard; a piece badly worn, and the smith; knocked down, and waking at the inn; food in the
// bag; the bag full; the first inn, its bar and its beds; the first smithy, and the trades; an empty cottage; a trophy. Which have been shown,
// and whether they're wanted at all (the pause menu's Tips switch), kept in the browser.
// (The carter's first quests teach the same in passing: model/story/quests/firstQuests.ts.)

import type { GameModel } from '../../model/GameModel';
import { TIRED } from '../../model/hero/heroStats';
import { maxHpOf } from '../../model/hero/attributes';
import { WORN, wearOf } from '../../model/hero/wear';
import { slotsUsed } from '../../model/hero/bagStacks';
import { bagRoom } from '../../model/hero/bagSlots';
import { isProvision } from '../../model/loot/provisions';
import { gearName, isGear } from '../../model/human/items/gear';
import { SKILL_IDS } from '../../model/skills/skills';
import type { KeyAction } from '../keyBindings';
import { COTTAGE_PRICE, QUESTS_KNOWN, isCottage } from '../../model/homestead/cottage';
import { COPPER_PER_SILVER } from '../../model/hero/money';

export interface Tip {
  id: string;
  title: string;
  due: (model: GameModel) => boolean;
  text: (key: (action: KeyAction) => string, model: GameModel) => string;
  now?: true; // shown though another was just shown (gone again before the wait's out)
}

const BREATHLESS = 20; // breath left (of 100): out of it
const NEAR = 7; // tiles: a foe closing in this near

const wornPiece = (model: GameModel) => Object.values(model.hero.equipment).find((k) => k && isGear(k) && wearOf(model.hero, k) >= WORN);

// In order of what matters most, when more than one is due at once.
export const TIPS: readonly Tip[] = [
  {
    id: 'fallen',
    title: 'Knocked down',
    due: (m) => !!m.purse && !!m.hero.blessings?.some((b) => b.kind === 'weary'), // (a fall in a fight, its purse still lying: not passing out, nor the stocks)
    text: () => 'You woke at an inn, Weary a while. Half your coin lies where you fell in the fight, under a shaft of gold light: fetch it before you fall again.',
    now: true,
  },
  {
    id: 'hurt',
    title: 'Wounds',
    due: (m) => m.hero.hp > 0 && m.hero.hp <= maxHpOf(m.hero) / 2,
    text: (key) => `Wounds don't close by themselves. Eat from your bag (${key('bag')}), drink a potion, or sleep in a bed.`,
  },
  {
    id: 'guard',
    title: 'A foe',
    due: (m) => !m.inside && m.enemies.some((e) => e.state === 'chase' && Math.hypot(e.x - m.hero.x, e.z - m.hero.z) < NEAR),
    text: (key) => `Hold ${key('guard')} to raise your guard; raised just as a blow lands, it parries. ${key('roll')} rolls you out of the way.`,
  },
  {
    id: 'breath',
    title: 'Breath',
    due: (m) => m.moves.breath < BREATHLESS,
    text: () => 'Blows, rolls and blocks spend breath, the bar under your health. Hold back a moment and it fills again.',
  },
  {
    id: 'tired',
    title: 'Tired',
    due: (m) => m.hero.energy < TIRED,
    text: () => 'Tired, you walk slower and tire sooner in a fight. Sitting keeps your energy; sleep brings it back, best in a bed at an inn.',
  },
  {
    id: 'worn',
    title: 'Worn gear',
    due: (m) => !!wornPiece(m),
    text: (_key, m) => `${((piece) => (piece ? `Your ${gearName(piece).toLowerCase()} is` : 'Your gear is'))(wornPiece(m))} badly worn. A smith mends gear for coin; broken, it gives you nothing.`,
  },
  {
    id: 'food',
    title: 'Food',
    due: (m) => Object.keys(m.hero.bag).some((item) => isProvision(item) && (m.hero.bag[item as keyof typeof m.hero.bag] ?? 0) > 0),
    text: (key, m) => {
      const slot = m.hero.actionBar.findIndex((a) => a !== null && isProvision(a)); // (put there by itself: hero/actionBar.ts fillNew)
      return slot >= 0 ? `Food mends you as you eat it; drink brings back energy. Press ${slot + 1} to eat when hurt.` : `Food mends you as you eat it; drink brings back energy. Right-click it in your bag (${key('bag')}), or drag it onto your action bar.`;
    },
  },
  {
    id: 'bagFull',
    title: 'A full bag',
    due: (m) => slotsUsed(m.hero.bag) >= bagRoom(m.hero),
    text: () => "Your bag is full. Sell what you don't need (a smith buys gear, a pedlar the rest), or fit another bag to it.",
  },
  {
    id: 'inn',
    title: 'The inn',
    due: (m) => m.inside?.entrance.type === 'inn' && !m.inside.below,
    text: (key) => `Sit at the bar: ${key('ale')} for an ale, ${key('pie')} for a pie. The barmaid lets rooms (${key('pie')} by her): a night in a bed brings everything back.`,
  },
  {
    id: 'trades',
    title: 'Trades',
    due: (m) => m.inside?.entrance.type === 'smithy',
    text: (key) => `The smith sells, buys and mends. His anvil and the salvage bench are yours too: one of ${SKILL_IDS.length} trades (${key('skills')}).`,
  },
  {
    id: 'cottage',
    title: 'An empty cottage',
    due: (m) => !!m.inside && !m.inside.below && isCottage(m.inside.entrance) && !m.hero.cottage,
    text: () => `Yours for ${COTTAGE_PRICE / COPPER_PER_SILVER} silver once the village knows you (${QUESTS_KNOWN} of its board's quests done). Then build in it: a bed, a chest, a hearth, a trophy wall.`,
  },
  {
    id: 'trophy',
    title: 'A trophy',
    due: (m) => Object.keys(m.hero.trophies ?? {}).length > 0,
    text: () => 'Bosses, captains and bounties each leave you a trophy. Hang them on the trophy wall of a cottage of your own.',
  },
  {
    id: 'carter',
    title: 'Someone needs a hand',
    due: (m) => !!m.story.carterCalling && m.story.markOf(m.story.carterCalling) === 'offer', // (at the start: his ! over him, a few steps off; not once he's spoken to)
    text: (key) => `The man by the broken wagon needs help. Walk up to the gold ! over him and press ${key('use')}.`,
  },
];

const KEY = 'evenhold.tips';
const GAP = 20; // seconds at least between one tip and the next

interface Kept {
  off: boolean;
  seen: string[];
}

function load(): Kept {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Kept> | null;
    return { off: saved?.off === true, seen: Array.isArray(saved?.seen) ? saved.seen.filter((s): s is string => typeof s === 'string') : [] };
  } catch {
    return { off: false, seen: [] };
  }
}

let kept = load();
const keep = () => {
  try {
    localStorage.setItem(KEY, JSON.stringify(kept));
  } catch {
    // not remembered, then
  }
};

export const tipsOn = (): boolean => !kept.off;
export function setTipsOn(on: boolean): void {
  kept = { ...kept, off: !on };
  keep();
}
// Read again from the browser's storage (tests).
export function reloadTips(): void {
  kept = load();
}

// The tip to show now, if one's due (not seen before, tips on, a while since the last), marked seen as it's taken.
export class FirstTips {
  private wait = 0;

  constructor(private readonly model: GameModel) {}

  next(dt: number): Tip | null {
    this.wait = Math.max(0, this.wait - dt);
    if (kept.off) return null;
    const tip = TIPS.find((t) => !kept.seen.includes(t.id) && (this.wait === 0 || t.now) && t.due(this.model));
    if (!tip) return null;
    kept = { ...kept, seen: [...kept.seen, tip.id] };
    keep();
    this.wait = GAP;
    return tip;
  }
}
