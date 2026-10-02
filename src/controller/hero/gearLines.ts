// A piece of gear's armour and what it adds to the hero's stats, as its
// tooltip's lines ("Armour 4", "+1 Stamina"): in the bag, on the hero
// sheet, at the smith's; and, for what isn't worn, what wearing it instead
// would change ("+2 Armour" in green, "−1 Agility" in red).

import { ITEMS, SLOT_NAMES, type Equipment, type ItemId } from '../../model/human/equipment';
import type { ItemEntry } from '../../model/human/items/item';
import { STATS, STAT_NAMES } from '../../model/hero/statKinds';
import { toned, type MenuLine } from '../../view/ui/menu';

export function gearLines(id: ItemId): MenuLine[] {
  const { armor, stats = {} } = ITEMS[id];
  return [...(armor ? [`Armour ${armor}`] : []), ...STATS.filter((s) => stats[s]).map((s) => `+${stats[s]} ${STAT_NAMES[s]}`)].map((text) => toned('stat', text));
}

// What a piece is worth, all told, to weigh one against another: its armour, and each point it adds to a stat
// worth STAT_WORTH of armour's (a stat does more: health, dodge, a harder blow).
const STAT_WORTH = 2;
type Gear = Pick<ItemEntry, 'armor' | 'stats'>;
const worthOf = (gear: Gear) => (gear.armor ?? 0) + STAT_WORTH * STATS.reduce((n, s) => n + (gear.stats?.[s] ?? 0), 0);

// What wearing `id` instead of what's in its slot (`equipment`'s) would change, as WoW tells it: a line saying so,
// how much better or worse it is all told (its worth's change, in percent: green up, red down; past nothing worn,
// an upgrade), then only what changes, armour first, each gain in green and each loss in red ("+2 Armour",
// "−1 Agility"); or that it's what's worn. Nothing changing: nothing said.
export function againstWorn(id: ItemId, equipment: Equipment): MenuLine[] {
  const { slot } = ITEMS[id];
  const worn = equipment[slot];
  if (worn === id) return [toned('head', 'You wear one already')];
  const [now, then] = [worn ? ITEMS[worn] : {}, ITEMS[id]] as Gear[];
  const change = (name: string, by: number): MenuLine[] => (by ? [{ text: `${by > 0 ? '+' : '−'}${Math.abs(by)} ${name}`, tone: by > 0 ? 'gain' : 'loss' }] : []);
  const changes = [...change('Armour', (then.armor ?? 0) - (now.armor ?? 0)), ...STATS.flatMap((s) => change(STAT_NAMES[s], (then.stats?.[s] ?? 0) - (now.stats?.[s] ?? 0)))];
  if (!changes.length) return [];
  const [before, after] = [worthOf(now), worthOf(then)];
  const percent = before > 0 ? Math.round(((after - before) / before) * 100) : null;
  const overall: MenuLine[] =
    percent === null ? (after > 0 ? [{ text: 'Overall: an upgrade', tone: 'gain' }] : []) : percent === 0 ? [toned('stat', 'Overall: about the same')] : [{ text: `Overall: ${percent > 0 ? '+' : '−'}${Math.abs(percent)}%`, tone: percent > 0 ? 'gain' : 'loss' }];
  return [toned('head', worn ? `If you replace your ${ITEMS[worn].name}:` : `If you wear it (your ${SLOT_NAMES[slot].toLowerCase()} slot is empty):`), ...overall, ...changes];
}
