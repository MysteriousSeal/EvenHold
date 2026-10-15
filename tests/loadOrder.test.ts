import { describe, expect, it, vi } from 'vitest';

// The model's files load in whatever order the game's imports come to them: an import loop must not leave a
// top-level const read before it's made (npcs.ts → town/townCallings.ts → npcs/npcPlaces.ts → … → npcs.ts).
describe('load order', () => {
  it('town/townCallings.ts loads first, before the npcs', async () => {
    vi.resetModules();
    await expect(import('../src/model/town/townCallings')).resolves.toBeTruthy();
    const { titleOf } = await import('../src/model/npcs/npcs');
    expect(titleOf({ name: 'Osric', role: 'bishop', look: { build: 'male' } } as Parameters<typeof titleOf>[0])).toBe('Osric (Bishop)');
  });
});
