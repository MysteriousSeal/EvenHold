// The game served to the trainer (train.py, through env.py): a line of JSON in on stdin for each call, a line of JSON
// out on stdout for each answer. {"spec": true} → its sizes; {"reset": seed} → {"observation"}; {"step": [move, key]}
// → {"observation", "reward", "done", "truncated", "info"}. What's seen goes as its 32-bit floats' bytes in base64
// (three thousand numbers a step, as text, would be most of the time).
import { createInterface } from 'node:readline';
import { ACTIONS, MOVES, OBSERVATION_SIZE, Player } from './player';

const player = new Player();
const packed = (o: number[]) => Buffer.from(new Float32Array(o).buffer).toString('base64');
const say = (message: unknown) => process.stdout.write(`${JSON.stringify(message)}\n`);
console.log = console.warn = console.info = (...args: unknown[]) => process.stderr.write(`${args.join(' ')}\n`); // (the game's own logging, off stdout)

createInterface({ input: process.stdin }).on('line', (line) => {
  const call = JSON.parse(line) as { reset?: number; step?: [number, number]; spec?: boolean };
  if (call.spec) say({ observation: OBSERVATION_SIZE, moves: MOVES, actions: ACTIONS });
  else if (call.reset !== undefined) say({ observation: packed(player.reset(call.reset)) });
  else if (call.step) {
    const step = player.step(call.step[0], call.step[1]);
    say({ ...step, observation: packed(step.observation) });
  }
});
