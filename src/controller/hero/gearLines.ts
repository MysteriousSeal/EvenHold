// A piece of gear's tooltip lines (in the bag, on the hero sheet, at the smith's): its level and rarity ("Level 12 ·
// Rare"), its armour and what it adds ("Armour 4", "+1 Stamina"), then its rarity's own lines apart ("+2% critical
// strike chance"), and, if the hero's under its level, that they must be; and, for what isn't worn, what wearing it
// instead would change ("+2 Armour" in green, "−1 Agility" in red).

import { SLOT_NAMES, type Equipment } from '../../model/human/equipment';
import { AFFIXES, RARITY_NAMES, canWear, gearName, gearOf, gearSpecs, noSpecs, slotOfGear, type Affix, type GearKey, type GearSpecs, type SpecLine } from '../../model/human/items/gear';
import { STATS, STAT_NAMES, isStat } from '../../model/hero/statKinds';
import { toned, type MenuLine } from '../../view/ui/menu';

const percent = (n: number) => `${Math.round(n * 100)}%`;
const AFFIX_TEXT: Record<Affix, (n: number) => string> = {
  crit: (n) => `+${percent(n)} critical strike chance`,
  dodge: (n) => `+${percent(n)} dodge chance`,
  regen: (n) => `+${n} health every 10 s`,
  speed: (n) => `+${percent(n)} pace`,
  leech: (n) => `+${percent(n)} of damage dealt healed`,
};
export const specText = ({ kind, amount }: Pick<SpecLine, 'kind' | 'amount'>): string =>
  kind === 'armor' ? `Armour ${amount}` : isStat(kind) ? `+${amount} ${STAT_NAMES[kind]}` : AFFIX_TEXT[kind](amount);

// Its lines: its level and rarity, its own, its rarity's (`heroLevel` given: whether they're under its level).
export function gearLines(key: GearKey, heroLevel?: number): MenuLine[] {
  const { level, rarity } = gearOf(key);
  const { lines } = gearSpecs(key);
  return [
    toned('kind', `Level ${level} · ${RARITY_NAMES[rarity]}`),
    ...lines.filter((l) => !l.extra).map((l) => toned('stat', specText(l))),
    ...lines.filter((l) => l.extra).map((l) => toned('extra', specText(l))),
    ...(heroLevel !== undefined && !canWear(key, heroLevel) ? [toned('loss', `Requires level ${level}`)] : []),
  ];
}

// What a piece is worth, all told, to weigh one against another: its armour, each point it adds to a stat worth
// STAT_WORTH of armour's (a stat does more: health, dodge, a harder blow), and each special line by its own worth.
const STAT_WORTH = 2;
const AFFIX_WORTH: Record<Affix, number> = { crit: 300, dodge: 300, regen: 3, speed: 200, leech: 250 }; // (a point's: a hundredth of crit, of dodge, of pace, of leech ~ 2-3 armour)
const NONE = noSpecs();
const worthOf = (g: GearSpecs) => g.armor + STAT_WORTH * STATS.reduce((n, s) => n + g.stats[s], 0) + AFFIXES.reduce((n, a) => n + g.affixes[a] * AFFIX_WORTH[a], 0);

// What wearing `key` instead of what's in its slot (`equipment`'s) would change, as WoW tells it: a line saying so,
// how much better or worse it is all told (its worth's change, in percent: green up, red down; past nothing worn,
// an upgrade), then only what changes, armour first, each gain in green and each loss in red ("+2 Armour",
// "−1 Agility"); or that it's what's worn. Nothing changing: nothing said.
export function againstWorn(key: GearKey, equipment: Equipment): MenuLine[] {
  const slot = slotOfGear(key);
  const worn = equipment[slot];
  if (worn === key) return [toned('head', 'You wear one already')];
  const [now, then] = [worn ? gearSpecs(worn) : NONE, gearSpecs(key)];
  const change = (kind: SpecLine['kind'], by: number): MenuLine[] => {
    if (Math.abs(by) < 1e-9) return [];
    const text = kind === 'armor' ? `${Math.abs(by)} Armour` : isStat(kind) ? `${Math.abs(by)} ${STAT_NAMES[kind]}` : AFFIX_TEXT[kind](Math.abs(by)).replace(/^\+/, '');
    return [{ text: `${by > 0 ? '+' : '−'}${text}`, tone: by > 0 ? 'gain' : 'loss' }];
  };
  const changes = [
    ...change('armor', then.armor - now.armor),
    ...STATS.flatMap((s) => change(s, then.stats[s] - now.stats[s])),
    ...AFFIXES.flatMap((a) => change(a, Math.round((then.affixes[a] - now.affixes[a]) * 100) / 100)),
  ];
  if (!changes.length) return [];
  const [before, after] = [worthOf(now), worthOf(then)];
  const share = before > 0 ? Math.round(((after - before) / before) * 100) : null;
  const overall: MenuLine[] =
    share === null ? (after > 0 ? [{ text: 'Overall: an upgrade', tone: 'gain' }] : []) : share === 0 ? [toned('stat', 'Overall: about the same')] : [{ text: `Overall: ${share > 0 ? '+' : '−'}${Math.abs(share)}%`, tone: share > 0 ? 'gain' : 'loss' }];
  return [toned('head', worn ? `If you replace your ${gearName(worn)}:` : `If you wear it (your ${SLOT_NAMES[slot].toLowerCase()} slot is empty):`), ...overall, ...changes];
}
