// @vitest-environment happy-dom
// What's said under a turning into a hen, a cow, a bull, a horse (view/cinema/stagings/), kept to who's turned and
// to what's seen, each fault kept as a test:
//  - a cow's patches were told as "Red, spreading over the white" in every coat, and what's taken apart whole as
//    "Patched red and white": said of a black-and-white one, a dun one, one black all over;
//  - what has neither parts nor voxels to it (a ruin's ghost, seen through) only dwindles (a hen: its shape pulled
//    to hers), and was told as someone is: "They go down on all fours", "Hands and feet close into hooves", "A
//    chicken as tall as a man".
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { COW_COATS } from '../src/model/spells/turned';
import { makeActor } from '../src/view/cinema/actor';
import { stagingFor, type Staging } from '../src/view/cinema/staging';
import { playTransformation } from '../src/view/cinema/transformCinema';
import { HumanRig } from '../src/view/meshes/human/humanRig';

const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });
const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  return rig.root;
};
// Something seen through, in one piece: nothing of it read off as cubes, no parts to it.
const wisp = () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.5, 0.2), new THREE.MeshStandardMaterial({ transparent: true, opacity: 0.5 }));
  body.position.y = 0.3;
  root.add(body);
  return root;
};
// All that's said, a turning played through on `figure`.
function said(figure: THREE.Object3D, staging: Staging): string[] {
  document.body.replaceChildren();
  const playing = playTransformation(figure, 'Idtram', staging, () => {}, drawer);
  const lines = new Set<string>();
  for (let t = 0; t < 16 && !playing.over; t += 0.1) [playing.advance(0.1), lines.add(playing.root.querySelector('.transform-line')!.textContent!)];
  playing.skip();
  return [...lines];
}
// The colours each coat may be told in (cowVoxels.ts COW_PALETTES, in their order).
const TOLD = [/Red.*white/, /Black.*white/, /brown.*dun/, /black.*black/];
const WHOLE = [/red and white/, /black and white/, /Dun/, /Black all over/];

describe("a cow's coat, as it's told", () => {
  it('has a telling for every coat she may have', () => {
    expect(TOLD.length).toBe(COW_COATS);
  });

  it.each([0, 1, 2, 3])('coat %i: her patches spread in her own colours, on someone turned', (coat) => {
    for (const into of ['cow', 'bull'] as const) {
      const rig = human();
      const scene = new THREE.Scene();
      scene.add(rig);
      const actor = makeActor(rig);
      const directed = stagingFor(into, { coat, stood: human }).direct!(rig, scene, actor.size.y, actor)!;
      const lines = directed.lines!.map(([, line]) => line);
      directed.dispose();
      const spreading = lines.filter((line) => /spreading/.test(line));
      expect(spreading.length).toBe(1);
      expect(spreading[0]).toMatch(TOLD[coat]);
      if (coat > 0) expect(lines.filter((line) => /Red/.test(line))).toEqual([]);
      if (coat > 1) expect(lines.filter((line) => /white/.test(line))).toEqual([]);
    }
  });

  it.each([0, 1, 2, 3])('coat %i: and whole, of what is taken apart into its voxels', (coat) => {
    const loose = stagingFor('cow', { coat, stood: human }).looseLines!.map(([, line]) => line);
    expect(loose.some((line) => WHOLE[coat].test(line))).toBe(true);
    if (coat > 0) expect(loose.filter((line) => /red/.test(line))).toEqual([]);
  });
});

describe('what has no parts and nothing solid to it, turned into a hen, a cow, a bull, a horse', () => {
  it.each(['chicken', 'cow', 'bull', 'horse'] as const)('a %s: nothing said of hands, arms, legs or a man; of it, not of them', (into) => {
    const lines = said(wisp(), stagingFor(into, { coat: 0, stood: wisp }));
    expect(lines.length).toBeGreaterThan(3); // (its own lines, and what it is at the end)
    expect(lines.filter((line) => /[Hh]ands|[Aa]rms|[Ll]egs|all fours|hooves|\bman\b|\b[Tt]hey\b|\btheir\b/.test(line))).toEqual([]);
    expect(lines.filter((line) => /\{name\}|undefined/.test(line))).toEqual([]);
    expect(lines[0]).toContain('Idtram');
  });

  it('is still told as someone is, where it is someone', () => {
    const lines = said(human(), stagingFor('horse', { stood: human }));
    expect(lines.some((line) => /all fours/.test(line))).toBe(true);
    expect(lines.some((line) => /their hands/.test(line))).toBe(true);
  });
});
