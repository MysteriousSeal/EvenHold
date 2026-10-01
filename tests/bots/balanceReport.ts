// The balance report (npm run bots writes it beside the problems one): what
// the bots' games say about levelling, fights, falls, quests, coin and how
// many foes are about, over time. Medians across bots (with the spread, 10th
// to 90th percentile, where it tells something).
import type { BalanceData, Fight } from './balance';

interface Played {
  seed: number;
  balance: BalanceData;
  goals: Record<string, number>;
}

const MARKS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 360, 480, 720, 960];

function pct(values: number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))))];
}
const median = (values: number[]) => pct(values, 50);
const f = (n: number, digits = 1) => (Number.isFinite(n) ? n.toFixed(digits).replace(/\.0+$/, '') : '–');
const spread = (values: number[], digits = 1) => (values.length ? `${f(median(values), digits)} (${f(pct(values, 10), digits)}–${f(pct(values, 90), digits)})` : '–');
const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : '–');
const table = (head: string[], rows: string[][]) => [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`, ...rows.map((r) => `| ${r.join(' | ')} |`)].join('\n');

export function balanceReport(games: Played[], minutes: number): string {
  const out: string[] = [];
  const hours = (games.length * minutes) / 60;
  const all = <T>(pick: (b: BalanceData) => T[]) => games.flatMap((g) => pick(g.balance));
  out.push(`# Balance, from ${games.length} bots × ${minutes} game minutes (${f(hours)} game hours in all)`, '');
  out.push('Medians across the bots; in brackets, the spread from the 10th to the 90th percentile.', '');

  // Levelling.
  const marks = MARKS.filter((m) => m <= minutes);
  const at = (m: number, pick: (x: BalanceData['minutes'][number]) => number) => games.map((g) => g.balance.minutes.find((x) => x.t === m)).filter(Boolean).map((x) => pick(x!));
  out.push('## Levelling', '');
  out.push(table(['game minutes', 'level', 'experience earned', 'coin held', 'gear (armour + stats)', 'kills', 'quests done', 'falls'], marks.map((m) => [String(m), spread(at(m, (x) => x.level)), spread(at(m, (x) => x.xp), 0), spread(at(m, (x) => x.money), 0), spread(at(m, (x) => x.gear), 0), spread(at(m, (x) => x.kills), 0), spread(at(m, (x) => x.questsDone), 0), spread(at(m, (x) => x.deaths), 0)])), '');
  const top = Math.max(1, ...games.map((g) => g.balance.levelAt.length - 1));
  const levelRows: string[][] = [];
  for (let level = 2; level <= top; level++) {
    const times = games.map((g) => g.balance.levelAt[level]).filter((t) => t !== undefined).map((t) => t / 60);
    const prev = games.map((g) => [g.balance.levelAt[level - 1], g.balance.levelAt[level]]).filter(([a, b]) => a !== undefined && b !== undefined).map(([a, b]) => (b - a) / 60);
    levelRows.push([String(level), `${times.length} of ${games.length}`, spread(times), spread(prev)]);
  }
  out.push('Time to reach each level (game minutes), and how long each took from the one before:', '');
  out.push(table(['level', 'bots that got there', 'reached at', 'took'], levelRows), '');
  const xpFrom = games.reduce<Record<string, number>>((sum, g) => {
    for (const [k, v] of Object.entries(g.balance.xpFrom)) sum[k] = (sum[k] ?? 0) + v;
    return sum;
  }, {});
  const xpAll = Object.values(xpFrom).reduce((a, b) => a + b, 0);
  out.push(`Experience from: ${Object.entries(xpFrom).map(([k, v]) => `${k} ${share(v, xpAll)}`).join(', ')}.`, '');

  // Fights.
  const fights = all((b) => b.fights);
  const fightRows = (groups: Map<string, Fight[]>) =>
    [...groups.entries()].map(([k, list]) => {
      const won = list.filter((x) => x.won);
      return [k, String(won.length), spread(won.map((x) => x.seconds)), `${f(median(won.map((x) => x.hurt * 100)), 0)}% (${f(pct(won.map((x) => x.hurt * 100), 90), 0)}%)`];
    });
  const by = (key: (x: Fight) => string) => {
    const map = new Map<string, Fight[]>();
    for (const x of fights) map.set(key(x), [...(map.get(key(x)) ?? []), x]);
    return map;
  };
  out.push('## Fights', '');
  out.push(`${fights.filter((x) => x.won).length} foes fought to the end (fights broken off to go and heal aren't counted here; falls are below).`, '');
  out.push('By foe — seconds to kill, and the share of their health a won fight cost the hero (median, and 90th percentile):', '');
  out.push(table(['foe', 'kills', 'seconds to kill', 'health lost'], fightRows(by((x) => x.kind))), '');
  const gap = (x: Fight) => {
    const d = x.foeLevel - x.heroLevel;
    return d <= -3 ? '3+ below' : d >= 3 ? '3+ above' : d === 0 ? 'same level' : d < 0 ? `${-d} below` : `${d} above`;
  };
  const order = ['3+ below', '2 below', '1 below', 'same level', '1 above', '2 above', '3+ above'];
  const gaps = by(gap);
  out.push('By the foe\'s level against the hero\'s:', '');
  out.push(table(['foe', 'kills', 'seconds to kill', 'health lost'], fightRows(new Map(order.filter((k) => gaps.has(k)).map((k) => [k, gaps.get(k)!])))), '');

  // Falls.
  const falls = all((b) => b.falls);
  out.push('## Falls', '');
  out.push(`${falls.length} falls: ${f(falls.length / hours, 2)} a game hour per bot.`, '');
  const fallBy = new Map<string, number>();
  for (const fall of falls) for (const foe of new Set(fall.by.map((b) => b.split(' ')[0]))) fallBy.set(foe, (fallBy.get(foe) ?? 0) + 1);
  if (falls.length) out.push(`Foes about when they fell: ${[...fallBy.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} in ${share(v, falls.length)}`).join(', ')}; median ${f(median(falls.map((x) => x.by.length)), 0)} foes about.`, '');
  const fallLevels = new Map<number, number>();
  for (const fall of falls) fallLevels.set(fall.heroLevel, (fallLevels.get(fall.heroLevel) ?? 0) + 1);
  if (falls.length) out.push(`By the hero's level: ${[...fallLevels.entries()].sort((a, b) => a[0] - b[0]).map(([k, v]) => `${k}: ${v}`).join(', ')}.`, '');

  // Quests.
  const quests = all((b) => b.quests);
  const outcome = (o: string) => quests.filter((q) => q.outcome === o).length;
  out.push('## Quests', '');
  out.push(`${quests.length} taken: ${outcome('done')} done (${share(outcome('done'), quests.length)}), ${outcome('given up')} given up, ${outcome('out of reach')} out of reach, ${outcome('open')} still open at the end.`, '');
  const questRows = (key: (q: (typeof quests)[number]) => string) => {
    const map = new Map<string, typeof quests>();
    for (const q of quests) map.set(key(q), [...(map.get(key(q)) ?? []), q]);
    return [...map.entries()].sort().map(([k, list]) => {
      const done = list.filter((q) => q.done !== null);
      const took = done.map((q) => (q.done! - q.taken) / 60);
      return [k, String(list.length), share(done.length, list.length), spread(took), f(median(done.map((q) => q.xp / Math.max(0.5, (q.done! - q.taken) / 60))), 0), f(median(done.map((q) => q.copper)), 0)];
    });
  };
  out.push('By kind and foe — game minutes from taking to handing in, and the experience a minute that came to:', '');
  out.push(table(['quest', 'taken', 'done', 'minutes to do', 'xp a minute', 'copper'], questRows((q) => `${q.kind} ${q.foe}`)), '');
  out.push('By the quest\'s level against the hero\'s (when taken):', '');
  out.push(table(['quest', 'taken', 'done', 'minutes to do', 'xp a minute', 'copper'], questRows((q) => { const d = q.level - q.heroLevel; return d <= -2 ? 'a: 2+ below' : d >= 2 ? 'e: 2+ above' : d === 0 ? 'c: same level' : d < 0 ? 'b: 1 below' : 'd: 1 above'; })), '');
  const killXpMinute = games.map((g) => (g.balance.xpFrom.kills ?? 0) / minutes);
  out.push(`For comparison, experience from kills alone: ${spread(killXpMinute)} a game minute per bot (all play, quests or not).`, '');

  // Coin.
  const sum = (pick: (b: BalanceData) => Record<string, number>) =>
    games.reduce<Record<string, number>>((acc, g) => {
      for (const [k, v] of Object.entries(pick(g.balance))) acc[k] = (acc[k] ?? 0) + v;
      return acc;
    }, {});
  const income = sum((b) => b.income);
  const spent = sum((b) => b.spent);
  const perHour = (v: number) => f(v / hours, 0);
  out.push('## Coin', '');
  out.push('Copper a game hour per bot:', '');
  out.push(table(['in from', 'copper/hour'], Object.entries(income).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, perHour(v)])), '');
  out.push(table(['spent on', 'copper/hour'], Object.entries(spent).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, perHour(v)])), '');

  // Foes about.
  const minutesAll = all((b) => b.minutes);
  out.push('## Foes about', '');
  out.push(`Alive within 40 tiles of the hero: ${spread(minutesAll.map((x) => x.foesNear), 0)}; within 15: ${spread(minutesAll.map((x) => x.foesClose), 0)}. Minutes with none within 15: ${share(minutesAll.filter((x) => x.foesClose === 0).length, minutesAll.length)}.`, '');
  const kinds = sum((b) => b.foeKinds);
  const kindsAll = Object.values(kinds).reduce((a, b) => a + b, 0);
  out.push(`Of the foes about: ${Object.entries(kinds).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${share(v, kindsAll)}`).join(', ')}.`, '');

  // What the bots did.
  const goals = games.reduce<Record<string, number>>((acc, g) => {
    for (const [k, v] of Object.entries(g.goals)) acc[k] = (acc[k] ?? 0) + v;
    return acc;
  }, {});
  const goalsAll = Object.values(goals).reduce((a, b) => a + b, 0);
  out.push('## What the bots set out to do', '');
  out.push(Object.entries(goals).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${share(v, goalsAll)}`).join(' · '), '');
  return out.join('\n');
}
