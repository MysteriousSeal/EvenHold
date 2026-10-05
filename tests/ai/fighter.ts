// The trained fighter (fighterPolicy.ts), loaded from disk (models/fighter.json, written by train.py): for Node (the
// evaluation, the bots).
import { readFileSync } from 'node:fs';
import { FighterPolicy, type PolicyWeights } from './fighterPolicy';

export class Fighter extends FighterPolicy {
  constructor(path = 'tests/ai/models/fighter.json') {
    super(JSON.parse(readFileSync(path, 'utf8')) as PolicyWeights);
  }
}
