// Faces (view/meshes/human/faceVoxels.ts): five expressions for him and for
// her, each its own face; a look without one (an old save) is calm; people
// in the world wear all of them; the creation screen offers them.
import { describe, expect, it } from 'vitest';
import { EXPRESSIONS, HERO_LOOK, lookAt, type BodyLook } from '../src/model/human/humanoid';
import { LOOK_TRAITS, fitLook } from '../src/model/human/lookTraits';
import { PART_GRID, buildHead } from '../src/view/meshes/human/bodyVoxels';

const N = PART_GRID.head[0];
// The face: the head's front, row by row.
const face = (look: Pick<BodyLook, 'build' | 'hairStyle' | 'beard' | 'expression'>) => {
  const g = buildHead(look);
  return Array.from({ length: N * N }, (_, i) => g.cells[(i % N) + N * (Math.floor(i / N) + N * (N - 1))]).join(',');
};

describe('facial expressions', () => {
  it.each([
    ['male', false],
    ['male', true],
    ['female', false],
  ] as const)('%s (bearded: %s): each expression its own face; none at all, calm', (build, beard) => {
    const faces = EXPRESSIONS.map((expression) => face({ build, beard, hairStyle: 'short', expression }));
    expect(new Set(faces).size).toBe(EXPRESSIONS.length);
    expect(face({ build, beard, hairStyle: 'short' })).toBe(faces[0]); // (an old save's: calm)
  });

  it('the head stays whole, whatever the face', () => {
    for (const build of ['male', 'female'] as const) {
      for (const expression of EXPRESSIONS) {
        const g = buildHead({ build, beard: false, hairStyle: 'short', expression });
        expect(g.cells.every((c) => c > 0)).toBe(true);
      }
    }
  });

  it('people in the world wear every one of them, the same each time for the same spot', () => {
    const seen = new Set<string | undefined>();
    for (let i = 0; i < 200; i++) seen.add(lookAt(i, i * 3, 1, 0.5).expression);
    expect([...seen].sort()).toEqual([...EXPRESSIONS].sort());
    expect(lookAt(12, 34, 5).expression).toBe(lookAt(12, 34, 5).expression);
  });

  it('a look made sound gets one (calm, if it had none); the creation screen steps through them', () => {
    expect(fitLook({ ...HERO_LOOK }).expression).toBe('calm');
    const trait = LOOK_TRAITS.find((t) => t.key === 'expression')!;
    expect(trait.kind).toBe('cycle');
    expect(trait.values(HERO_LOOK).map((v) => trait.name(v))).toEqual(['Calm', 'Cheerful', 'Stern', 'Wistful', 'Sly']);
  });
});
