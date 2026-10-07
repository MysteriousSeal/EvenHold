// A playthrough written up (playthrough.ts), to read the game by: who the player was; how the hour went (level, coin
// and where they were, minute by minute); what they did with it (each activity: how often, how long, how it ended,
// what it brought); what they found, and when; what they learnt (which activities paid, by their own reckoning); what
// went wrong for them (falls, failures, time with nothing to do); the game's own faults (the checks); and what all
// that says about the game (signals: too much walking, coin piling up unspent, a skill never used, a place never
// found…), the part to read first.

import type { Problem } from '../checks';
import type { Player } from './player';
import { ACTIVITIES } from './activities';
import { TRAITS, describe } from './persona';
import { SKILL_IDS, skillOf } from '../../../src/model/skills/skills';

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const pct = (n: number) => `${Math.round(n * 100)}%`;

export function playReport(player: Player, seed: number, minutes: number, problems: Problem[]): string {
  const { game: model, diary, found, persona, memory, balance } = player;
  const { hero } = model;
  const whole = minutes * 60;
  const lines: string[] = [];
  lines.push(`# A playthrough: seed ${seed}, ${minutes} game minutes`, '');
  lines.push(`**The player:** ${describe(persona)} (${TRAITS.map((t) => `${t} ${persona.traits[t]}`).join(', ')}; temperature ${persona.temperature}).`, '');
  lines.push(`**At the end:** level ${hero.level}, ${hero.money} copper, ${player.stats.kills} slain, ${player.stats.deaths} falls, ${player.stats.questsDone}/${player.stats.questsTaken} quests done; skills ${SKILL_IDS.map((id) => `${id} ${skillOf(hero, id).level}`).join(', ')}.`, '');

  // Signals first.
  lines.push('## What this says about the game', '');
  for (const s of signals(player, minutes)) lines.push(`- ${s}`);
  lines.push('');

  // Time.
  const byId = new Map<string, { n: number; seconds: number; ok: number; fail: number; fell: number; xp: number; coin: number; hurt: number }>();
  for (const d of diary) {
    const e = byId.get(d.id) ?? { n: 0, seconds: 0, ok: 0, fail: 0, fell: 0, xp: 0, coin: 0, hurt: 0 };
    e.n++;
    e.seconds += d.seconds;
    e.xp += d.xp;
    e.coin += d.coin;
    e.hurt += d.hurt;
    if (d.outcome === 'ok') e.ok++;
    else if (d.outcome === 'fell') e.fell++;
    else if (d.outcome === 'fail') e.fail++;
    byId.set(d.id, e);
  }
  lines.push('## Where the hour went', '', '| activity | times | time | of the hour | done | failed | fell | xp | copper |', '|---|---|---|---|---|---|---|---|---|');
  for (const [id, e] of [...byId].sort((a, b) => b[1].seconds - a[1].seconds)) lines.push(`| ${id} | ${e.n} | ${clock(e.seconds)} | ${pct(e.seconds / whole)} | ${e.ok} | ${e.fail} | ${e.fell} | ${e.xp} | ${e.coin >= 0 ? '+' : ''}${e.coin} |`);
  const never = ACTIVITIES.map((a) => a.id).filter((id) => !byId.has(id));
  lines.push('', `Never did: ${never.join(', ') || 'nothing left undone'}. Nothing to do at all: ${clock(player.idle)}.`, '');

  // Progress.
  lines.push('## How it went, minute by minute', '', '| min | level | xp | copper | kills | deaths | quests | foes near |', '|---|---|---|---|---|---|---|---|');
  for (const m of balance.data.minutes.filter((m) => m.t % 5 === 0 || m.t === balance.data.minutes.at(-1)?.t)) lines.push(`| ${m.t} | ${m.level} | ${m.xp} | ${m.money} | ${m.kills} | ${m.deaths} | ${m.questsDone} | ${m.foesNear} |`);
  lines.push('', `Levels reached at: ${balance.data.levelAt.slice(2).map((s, i) => `${i + 2} at ${clock(s)}`).join(', ') || 'none past the first'}.`, '');
  lines.push('**Coin in:** ' + Object.entries(balance.data.income).map(([k, v]) => `${k} ${v}`).join(', ') + '. **Coin out:** ' + (Object.entries(balance.data.spent).map(([k, v]) => `${k} ${v}`).join(', ') || 'nothing') + '. **Experience from:** ' + Object.entries(balance.data.xpFrom).map(([k, v]) => `${k} ${v}`).join(', ') + '.', '');
  if (balance.data.falls.length) lines.push('**Falls:** ' + balance.data.falls.map((f) => `at ${clock(f.t)} (level ${f.heroLevel}, by ${[...new Set(f.by.map((b) => b.split(' ')[0]))].join(', ') || 'no one near'})`).join('; ') + '.', '');

  // Discovery.
  lines.push('## What they found', '');
  for (const f of found) lines.push(`- ${clock(f.at)}: ${f.what}`);
  lines.push('', `Of the world made round them: ${player.known.villages.size} villages, ${[...player.known.doors].filter((d) => d.type === 'crypt' || d.type === 'cave').length} dungeons, ${player.known.camps.size} camps seen.`, '');

  // Learning.
  lines.push('## What they learnt (reward by activity, their own reckoning)', '');
  for (const [id, l] of [...memory.learnt].sort((a, b) => b[1].mean - a[1].mean)) lines.push(`- ${id}: ${l.mean >= 0 ? '+' : ''}${l.mean.toFixed(2)} over ${l.n}`);
  lines.push('');

  // The diary.
  lines.push('## The diary', '');
  for (const d of diary) {
    const gains = [d.xp > 0 && `+${d.xp} xp`, d.coin !== 0 && `${d.coin > 0 ? '+' : ''}${d.coin} copper`, d.hurt > 0.05 && `−${pct(d.hurt)} health`].filter(Boolean).join(', ');
    lines.push(`- ${clock(d.at)} (level ${d.level}): ${d.label} — ${d.why}. ${d.outcome}, ${Math.round(d.seconds)} s${gains ? `; ${gains}` : ''}.`);
  }
  lines.push('');

  // The game's faults.
  lines.push('## Problems the game had', '');
  const kinds = new Map<string, Problem[]>();
  for (const p of problems) kinds.set(p.kind, [...(kinds.get(p.kind) ?? []), p]);
  if (kinds.size === 0) lines.push('None.');
  for (const [kind, list] of kinds) lines.push(`- **${kind}** × ${list.length}: e.g. ${clock(list[0].t)}, ${list[0].detail}`);
  lines.push('');
  return lines.join('\n');
}

// What the hour says about the game, as a designer would read it.
function signals(player: Player, minutes: number): string[] {
  const { game: model, diary, balance } = player;
  const { hero } = model;
  const whole = minutes * 60;
  const out: string[] = [];
  const time = (id: string) => diary.filter((d) => d.id === id).reduce((s, d) => s + d.seconds, 0);
  const walking = diary.filter((d) => d.id === 'explore').reduce((s, d) => s + d.seconds, 0);
  if (walking / whole > 0.3) out.push(`Spent ${pct(walking / whole)} of the hour just walking about: the world may be too sparse, or the next thing to do too far.`);
  const failed = diary.filter((d) => d.outcome === 'fail');
  if (failed.length / Math.max(1, diary.length) > 0.3) out.push(`${failed.length} of ${diary.length} things tried came to nothing: ${[...new Set(failed.map((d) => d.id))].join(', ')}. Players will feel the game resisting them.`);
  if (player.lowHealth > 600) out.push(`${clock(player.lowHealth)} under 40% health: a bed mends for free and food and ale cost coin, yet they went on hurt. Is the way to mend plain enough?`);
  if (player.idle > 120) out.push(`${clock(player.idle)} with nothing at all to do: nothing in reach, nothing known. The early game may need a hook.`);
  if (hero.level < 3) out.push(`Only level ${hero.level} after an hour: levelling is slow for this kind of player (${describe(player.persona)}).`);
  if (hero.level >= 8) out.push(`Level ${hero.level} in an hour: fast; is the mid-game ready for them?`);
  if (hero.money > 400 && Object.values(balance.data.spent).reduce((a, b) => a + b, 0) < hero.money * 0.3) out.push(`${hero.money} copper piled up, little spent: not enough worth buying, or nothing they wanted.`);
  if (player.stats.deaths >= 3) {
    const by = new Map<string, number>();
    for (const f of balance.data.falls) for (const kind of new Set(f.by.map((b) => b.split(' ')[0]))) by.set(kind, (by.get(kind) ?? 0) + 1);
    out.push(`Fell ${player.stats.deaths} times (${[...by].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(', ') || 'no one near'}): the danger outruns the player, or the healing's too far.`);
  }
  if (player.stats.deaths === 0 && hero.level >= 5) out.push('Never fell: fights hold little danger for a player this far on.');
  const skills = SKILL_IDS.filter((id) => skillOf(hero, id).level > 1);
  if (skills.length === 0) out.push('No skill touched all hour: a player of this kind never found a reason to chop or craft (an axe to buy, trees to see).');
  const atStart = player.found.filter((f) => f.at < 3 && f.what.includes('bandit camp')).length; // (before a step's taken: one, the near camp, is by design)
  if (atStart >= 2) out.push(`${atStart} bandit camps in sight of where they set out: a new player walks into one before they know the game.`);
  const neverFound = [['dungeons', [...player.known.doors].filter((d) => d.type === 'crypt' || d.type === 'cave').length], ['camps', player.known.camps.size]].filter(([, n]) => n === 0).map(([k]) => k);
  if (neverFound.length) out.push(`Never came across any ${neverFound.join(' or ')} in an hour: too rare near the start, or too hidden.`);
  const quests = balance.data.quests;
  const abandoned = quests.filter((q) => q.outcome === 'out of reach' || q.outcome === 'given up');
  if (abandoned.length) out.push(`${abandoned.length} quests let go (${abandoned.map((q) => q.outcome).join(', ')}): a quest spot out of reach is a bug; given up, a dull one.`);
  if (time('work') > whole * 0.35) out.push(`${pct(time('work') / whole)} of the hour at the inn's jobs: it pays better than adventuring for this player.`);
  const descents = diary.filter((d) => d.id === 'dungeon' && d.seconds >= 30); // (down for a while: not an attempt that came to nothing at the door)
  const dungeonsDone = descents.filter((d) => d.outcome === 'ok').length;
  if (descents.length > 0 && dungeonsDone === 0) out.push(`Went down ${descents.length} dungeons, came back from none in one piece: too hard at their level.`);
  const best = [...player.memory.learnt].sort((a, b) => b[1].mean - a[1].mean)[0];
  if (best && best[1].n >= 3) out.push(`What paid off best, by their own reckoning: ${best[0]} (${best[1].mean.toFixed(2)} over ${best[1].n}). What's rewarded is what players will do.`);
  if (out.length === 0) out.push('A rounded hour: no one thing out of balance for this player.');
  return out;
}
