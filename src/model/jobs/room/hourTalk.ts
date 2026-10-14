// The pleasure worker's hour, as a talk (roomShift.ts plays it once a client is in; the cheat menu plays this same
// one). Their word, then the game of their pace, the two of them with nothing on (talkPanel.ts). What the hour does
// to the clock, the coin and the hero stays with the shift: `done` is the shift's, or the cheat's.
import type { Build } from '../../human/humanoid';
import type { Talk } from '../../story/story';
import { paceOf, type PaceVoice } from './pace';
import { HOUR, STREAK, goodOf, risingOf } from './roomHour';
import { TEMPERS, type Temper, type Tone, type Trouble } from './roomLines';
import type { Client } from './roomShift';

export const PLEASED = 0.55; // of the pace kept: pleased (their warm word at the end; the shift's tip)

// What they say while the hour is played, from the same lines the shift uses.
export function hourVoice(build: Build, who: Temper | Trouble, pick: (lines: readonly string[], salt: number) => string): PaceVoice {
  return {
    rising: (level) => pick(risingOf(who, build, level), 90 + level),
    badly: () => pick(HOUR[who].badly, 95),
    streak: () => pick(STREAK, 96),
    finish: (score) => pick(score >= PLEASED ? goodOf(who, build) : HOUR[who].poor, 97),
  };
}

// The talk of one let in: the line as the door shuts, then their pace. `bare`: the two of them drawn while it's played.
export function hourOf(client: Pick<Client, 'name' | 'look' | 'kind' | 'temper'>, tone: Tone, line: string, pick: (lines: readonly string[], salt: number) => string, done: (score: number) => Talk): Talk {
  const plain = client.kind === 'plain';
  const taste = !plain ? 'plain' : TEMPERS[client.temper].likes === tone ? 'liked' : 'disliked';
  const who = plain ? client.temper : (client.kind as Trouble);
  return {
    speaker: client.name,
    lines: [line],
    pace: { pace: paceOf(who, taste), with: client.name, voice: hourVoice(client.look.build, who, pick), bare: true, done },
    answers: [],
  };
}
