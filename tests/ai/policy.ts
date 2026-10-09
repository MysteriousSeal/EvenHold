// The trained player's policy, played from its exported weights (models/player.json, train.py export): what it sees
// (senses.ts) through its layers to a way to go and a key, drawn by their odds as in training (or the likeliest of
// each). Plain arithmetic: no Python needed to play it (play.ts).
interface Layer {
  weight: number[][];
  bias: number[];
}

export interface PolicyWeights {
  layers: Layer[];
  head: Layer;
  splits: number[];
  steps?: number; // decisions trained
  score?: number | null; // the mean pay of its last lives when saved (saving.py)
}

export class Policy {
  constructor(private readonly weights: PolicyWeights) {}

  // Its choice: [way (0 still, 1..8), key (keys.ts)], drawn by its odds with `sample` (a chance, 0..1), else the likeliest.
  act(observation: readonly number[], sample?: () => number): [number, number] {
    let x = observation;
    for (const layer of this.weights.layers) x = dense(layer, x).map(Math.tanh);
    const logits = dense(this.weights.head, x);
    const [moves] = this.weights.splits;
    const pick = (part: number[]) => (sample ? draw(part, sample()) : argmax(part));
    return [pick(logits.slice(0, moves)), pick(logits.slice(moves))];
  }
}

// One untrained: every way and key as likely as another.
export const random = (moves: number, keys: number, rng: () => number): ((observation: readonly number[]) => [number, number]) => () => [Math.floor(rng() * moves), Math.floor(rng() * keys)];

function draw(logits: readonly number[], u: number): number {
  const top = Math.max(...logits);
  const odds = logits.map((l) => Math.exp(l - top));
  let left = u * odds.reduce((a, b) => a + b, 0);
  for (let i = 0; i < odds.length; i++) if ((left -= odds[i]) < 0) return i;
  return odds.length - 1;
}

const dense = ({ weight, bias }: Layer, x: readonly number[]): number[] => weight.map((row, i) => row.reduce((sum, w, j) => sum + w * x[j], bias[i]));
const argmax = (xs: readonly number[]): number => xs.reduce((best, x, i) => (x > xs[best] ? i : best), 0);
