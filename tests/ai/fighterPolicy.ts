// A fighter trained in the arena (train.py), played from its exported policy (models/fighter.json, parsed): what it
// sees (arena.ts observe) through its layers to a way to go and a move, the likeliest of each. Plain arithmetic, no
// Python, no files: in Node (fighter.ts loads one from disk) and in the browser alike (the watch page fetches it).

interface Layer {
  weight: number[][];
  bias: number[];
}

export interface PolicyWeights {
  layers: Layer[];
  head: Layer;
  splits: number[];
}

export class FighterPolicy {
  constructor(private readonly policy: PolicyWeights) {}

  // Its choice, given what it sees: [way to go (0 still, 1..8), key (0 none, 1 a blow, 2 a roll, 3 the guard, …)]: the
  // likeliest of each; or (`sample`: a chance, 0..1, as Math.random gives) drawn by its odds, as it plays in training
  // (one little trained has its odds near even, and the likeliest alone can be the same thing over and over).
  act(observation: readonly number[], sample?: () => number): [number, number] {
    let x = observation;
    for (const layer of this.policy.layers) x = dense(layer, x).map(Math.tanh);
    const logits = dense(this.policy.head, x);
    const [moves] = this.policy.splits;
    const pick = (part: number[]) => (sample ? draw(part, sample()) : argmax(part));
    return [pick(logits.slice(0, moves)), pick(logits.slice(moves))];
  }
}

// One of `logits` drawn by its odds (their softmax), with chance `u`.
function draw(logits: readonly number[], u: number): number {
  const top = Math.max(...logits);
  const odds = logits.map((l) => Math.exp(l - top));
  let left = u * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) if ((left -= odds[i]) < 0) return i;
  return odds.length - 1;
}

const dense = ({ weight, bias }: Layer, x: readonly number[]): number[] => weight.map((row, i) => row.reduce((sum, w, j) => sum + w * x[j], bias[i]));
const argmax = (xs: readonly number[]): number => xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);
