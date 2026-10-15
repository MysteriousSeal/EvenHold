// A sitting at the dice (hazard.ts' rules), the hero sat at an inn's table across from someone: a villager having
// their evening, or a sharp (diceSharps.ts). The hero calls a main and a stake, puts the stake down (held on the
// table till the game's done), and casts till it's won or lost; even money.
// - The stakes are the inn's (stakesAt): small, more at an inn further out, never past STAKE_CAP.
// - A villager brings only so much to lose (PURSE: so many of the inn's stake) and plays only so many games
//   (GAMES); cleaned out or done, they stop.
// - A sharp brings more, and plays on; now and then (SWITCH, as a game starts) slips in fullams against the main
//   called, now and then seen doing it (TELL), and the dice themselves show it: one face, again and again.
// - Crying foul: on loaded dice, the sharp's caught out: the stake back, theirs besides, and all they've won off the
//   hero this sitting; on honest ones (a villager's are always honest), the stake's lost, and as much again for the
//   insult. Either way, the sitting's over.
// Blind, crying foul is a loser's game (a sharp's dice are loaded a game in three): it pays only to watch the dice.

import { casterOdds, firstThrow, fullamsAgainst, laterThrow, throwDice, type Cast, type Fullams, type Main } from './hazard';
import type { Sharp } from './diceSharps';

export const STAKE_CAP = 40; // copper: the most that's ever on the table, at any inn
const STAKE_BASE = 2; // copper: the least stake at a first village's inn
const PER_LEVEL = 0.25; // more to it each level of the inn's past the first (as quests pay: quests/quests.ts)
export const STAKE_STEPS = [1, 2, 4] as const; // the stakes on offer, of the least
const PURSE: [number, number] = [6, 12]; // of the least stake, a villager's to lose
const SHARP_PURSE = 30; // and a sharp's
const GAMES: [number, number] = [5, 10]; // games a villager plays before they've had enough
export const SWITCH = 0.35; // of a sharp's slipping fullams in, as a game starts
export const TELL = 0.5; // of their being seen doing it

// The stakes at an inn of village level `level`: small, middling, high.
export function stakesAt(level: number): number[] {
  const least = Math.round(STAKE_BASE * (1 + PER_LEVEL * (Math.max(1, level) - 1)));
  return STAKE_STEPS.map((k) => Math.min(STAKE_CAP, least * k));
}

export interface Game {
  main: Main;
  stake: number; // the hero's, held on the table (and as much of theirs)
  chance: number | null; // the hero's chance, once thrown
  casts: Cast[]; // this game's, in order
  loaded: Fullams | null; // a sharp's fullams, slipped in
  seen: boolean; // seen being slipped in
  result: 'won' | 'lost' | null;
}

export interface Sitting {
  against: string; // their name
  sharp: Sharp | null;
  stakes: number[]; // stakesAt the inn's level
  purse: number; // theirs, left to lose
  gamesLeft: number; // a villager's, before they've had enough (a sharp's: as many as the hero likes)
  games: number; // begun this sitting
  net: number; // what the hero's won (or, below nothing, lost) off them this sitting
  game: Game | null; // the one under way, or the last
  over: 'cleaned out' | 'enough' | 'caught' | 'wronged' | null; // why they've stopped playing, once they have
}

type Purse = { money: number };

// Sitting down across from someone: `roll` (0..1) for their purse and patience.
export function sitDown(against: string, sharp: Sharp | null, level: number, roll: number): Sitting {
  const stakes = stakesAt(level);
  const purse = stakes[0] * (sharp ? SHARP_PURSE : Math.round(PURSE[0] + roll * (PURSE[1] - PURSE[0])));
  return { against, sharp, stakes, purse, gamesLeft: sharp ? Infinity : Math.round(GAMES[0] + roll * (GAMES[1] - GAMES[0])), net: 0, games: 0, game: null, over: null };
}

// Whether a game can start at `stake`: why not, if not.
export function canStart(s: Sitting, hero: Purse, stake: number): 'ok' | 'over' | 'playing' | 'too poor' | 'short' { // ('short': they can't cover it)
  if (s.over) return 'over';
  if (s.game && !s.game.result) return 'playing';
  if (hero.money < stake) return 'too poor';
  if (s.purse < stake) return 'short';
  return 'ok';
}

// A game begun: the stake down, the main called (a sharp's dice slipped in, maybe).
export function startGame(s: Sitting, hero: Purse, main: Main, stake: number, rng: () => number): Game | null {
  if (!s.stakes.includes(stake) || canStart(s, hero, stake) !== 'ok') return null;
  hero.money -= stake;
  const loaded = s.sharp && rng() < SWITCH ? fullamsAgainst(main) : null;
  s.game = { main, stake, chance: null, casts: [], loaded, seen: !!loaded && rng() < TELL, result: null };
  s.games++;
  return s.game;
}

// A cast of the dice in the game under way: what came up, and how the game stands (settled, if it's done).
export function castDice(s: Sitting, hero: Purse, rng: () => number): Cast | null {
  const g = s.game;
  if (!g || g.result || s.over) return null;
  const cast = throwDice(rng, g.loaded);
  g.casts.push(cast);
  const sum = cast[0] + cast[1];
  if (g.chance === null) {
    const first = firstThrow(g.main, sum);
    if (typeof first === 'number') g.chance = first;
    else settle(s, hero, first === 'nick' ? 'won' : 'lost');
  } else {
    const later = laterThrow(g.main, g.chance, sum);
    if (later) settle(s, hero, later);
  }
  return cast;
}

// The game done: even money, the stake back and theirs with it, or theirs to keep; and whether they'll go on.
function settle(s: Sitting, hero: Purse, result: 'won' | 'lost'): void {
  const g = s.game!;
  g.result = result;
  if (result === 'won') [hero.money, s.purse, s.net] = [hero.money + g.stake * 2, s.purse - g.stake, s.net + g.stake];
  else [s.purse, s.net] = [s.purse + g.stake, s.net - g.stake];
  s.gamesLeft--;
  if (s.purse < s.stakes[0]) s.over = 'cleaned out';
  else if (s.gamesLeft <= 0) s.over = 'enough';
}

// Foul cried. On loaded dice: caught out, the hero's stake back and theirs, and all they'd won off the hero. On honest
// dice: the stake on the table theirs, and as much again for the insult (as much as the hero has). What it came to.
export function cryFoul(s: Sitting, hero: Purse): { caught: boolean; paid: number } | null {
  if (s.over) return null;
  const g = s.game;
  const playing = !!g && !g.result;
  if (playing && g!.loaded) {
    const back = g!.stake * 2 + Math.max(0, -s.net);
    hero.money += back;
    s.net += g!.stake + Math.max(0, -s.net);
    g!.result = 'won';
    s.over = 'caught';
    return { caught: true, paid: back };
  }
  const insult = Math.min(hero.money, playing ? g!.stake : s.stakes[0]);
  hero.money -= insult;
  if (playing) [g!.result, s.purse] = ['lost', s.purse + g!.stake];
  s.net -= insult + (playing ? g!.stake : 0);
  s.over = 'wronged';
  return { caught: false, paid: insult + (playing ? g!.stake : 0) };
}

// Up from the table mid-game: the stake left on it is theirs (a game walked out of is a game lost).
export function walkOut(s: Sitting): void {
  const g = s.game;
  if (!g || g.result) return;
  [g.result, s.purse, s.net] = ['lost', s.purse + g.stake, s.net - g.stake];
}

// The hero's odds of winning a game on `main`, honest dice: what the rules window tells them.
export const oddsOf = (main: Main): number => casterOdds(main);
