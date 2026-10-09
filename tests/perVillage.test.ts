// What's worked out once a village and kept (model/villages/perVillage.ts): the same again for the same village, listed
// once for a world's villages, and, the list grown (a streamed world's), the earlier ones kept as they were.
import { describe, expect, it } from 'vitest';
import { PerVillage } from '../src/model/villages/perVillage';
import { fresh } from './support/testWorld';

describe('what is worked out once a village', () => {
  it('is made once, listed once, and kept as the list grows', () => {
    const model = fresh();
    let made = 0;
    const cache = new PerVillage<{ villages: typeof model.villages }, { n: number }>(() => ({ n: ++made }));
    const first = cache.of(model, model.villages[0]);
    expect(cache.of(model, model.villages[0])).toBe(first);
    const all = cache.all(model);
    expect(all).toHaveLength(model.villages.length);
    expect(all[0]).toBe(first);
    expect(cache.all(model)).toBe(all); // (the list itself, kept)
    expect(made).toBe(model.villages.length);
    const grown = { villages: [...model.villages, { ...model.villages[0], x: model.villages[0].x + 500 }] };
    const more = cache.all(grown);
    expect(more).toHaveLength(model.villages.length + 1);
    expect(more.slice(0, -1)).toEqual(all); // (the earlier as they were)
    expect(made).toBe(model.villages.length + 1);
  });
});
