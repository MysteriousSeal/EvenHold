// An environment served to the trainer (train.py, through arena_env.py): a line of JSON in on stdin for each call, a
// line of JSON out on stdout for each answer. Which one: AI_ENV ('arena', the fights, arena.ts; 'player', the whole
// game, player.ts). Calls: {"reset": seed} → {"observation": [...]}; {"step": [move, key]} → {"observation",
// "reward", "done", "truncated", "info"}; {"spec": true} → its sizes. What's seen goes as its 32-bit floats' bytes in
// base64 (a player's two thousand numbers a step, as text, were most of the time spent).
import { createInterface } from 'node:readline';
import * as arena from './arena';
import * as player from './player';

const kind = process.env.AI_ENV === 'player' ? 'player' : 'arena';
const env = kind === 'player' ? new player.Player() : new arena.Arena();
const spec = kind === 'player' ? { observation: player.OBSERVATION_SIZE, moves: player.MOVES, actions: player.KEYS } : { observation: arena.OBSERVATION_SIZE, moves: arena.MOVES, actions: arena.ACTIONS };
const packed = (o: number[]) => Buffer.from(new Float32Array(o).buffer).toString('base64');
const say = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
// (whatever the game logs, kept off stdout: the trainer reads only answers there)
console.log = console.warn = console.info = (...args: unknown[]) => process.stderr.write(`${args.join(' ')}\n`);

createInterface({ input: process.stdin }).on('line', (line) => {
  const call = JSON.parse(line) as { reset?: number; step?: [number, number]; spec?: boolean };
  if (call.spec) say(spec);
  else if (call.reset !== undefined) say({ observation: packed(env.reset(call.reset)) });
  else if (call.step) {
    const step = env.step(call.step[0], call.step[1]);
    say({ ...step, observation: packed(step.observation) });
  }
});
