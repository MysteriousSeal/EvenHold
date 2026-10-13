// @vitest-environment happy-dom
// Someone turned to stone who's no one (view/cinema/stagings/statueStaging.ts, view/meshes/turned/statue.ts): a
// beast's turning said in a beast's words, and seen close on its head, not its back; a ghost, and a lynx lurking,
// stood in stone on their plinth as anyone is (not a plinth with nothing on it).
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { makeEnemy } from '../src/model/enemies/enemies';
import type { EnemyKind } from '../src/model/types';
import { makeActor, setDown } from '../src/view/cinema/actor';
import { statueStagingOf } from '../src/view/cinema/stagings/statueStaging';
import { playTransformation } from '../src/view/cinema/transformCinema';
import { EnemyViews } from '../src/view/meshes/enemy/enemyViews';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { stoneFigure } from '../src/view/meshes/turned/statue';

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const foes = new EnemyViews(new THREE.Scene());
const foe = (kind: EnemyKind) => () => foes.standIn(makeEnemy(7, kind, 3, 5));
const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  return rig.root;
};
const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });
// Every line said of a turning to stone, played through.
const saidOf = (stood: () => THREE.Object3D): string[] => {
  document.body.replaceChildren();
  const playing = playTransformation(stood(), 'It', statueStagingOf(stood), () => {}, drawer);
  const said = new Set<string>();
  for (let t = 0; t < 13 && !playing.over; t += 0.1) [playing.advance(0.1), !playing.over && said.add(playing.root.querySelector('.transform-line')!.textContent!)];
  return [...said];
};
// What of a statue is there to see, its plinth aside: its meshes, and how high they stand.
const carved = (statue: THREE.Object3D) => {
  const meshes: THREE.Mesh[] = [];
  statue.updateMatrixWorld(true);
  statue.children[0].traverseVisible((o) => (o as THREE.Mesh).isMesh && meshes.push(o as THREE.Mesh));
  const box = meshes.reduce((all, mesh) => all.expandByObject(mesh), new THREE.Box3());
  return { meshes, tall: box.getSize(new THREE.Vector3()).y, low: box.min.y };
};

describe('a beast turned to stone', () => {
  it('is told in a beast\'s words: nothing worn, no arms hung, no word to say; someone, in theirs', () => {
    for (const kind of ['wolf', 'caveSpider', 'caveBat', 'caveWorm'] as const) {
      const said = saidOf(foe(kind));
      expect(said.length, kind).toBeGreaterThanOrEqual(7); // (the cold, each height of it, its plinth, what it is)
      expect(said.filter((line) => /wear|arms|hips|knee|throat|word|they|their/i.test(line)), kind).toEqual([]);
      expect(said, kind).toContain('A statue, where it stood.');
      expect(said, kind).toContain('A statue.');
    }
    const said = saidOf(human);
    expect(said.some((line) => /What they wear/.test(line))).toBe(true);
    expect(said).toContain('A statue, where they stood.');
  });

  it('is seen close on the highest of it (a wolf\'s head, before its middle), the length of it in sight; someone, on their face', () => {
    const seen = (stood: () => THREE.Object3D) => {
      const figure = setDown(stood());
      const actor = makeActor(figure);
      const directed = statueStagingOf(stood).direct!(figure, new THREE.Scene(), actor.size.y, actor)!;
      return { actor, whole: directed.view!(0.2, 0), close: directed.view!(0.8, 0) };
    };
    const wolf = seen(foe('wolf'));
    expect(wolf.whole.x ?? 0).toBeCloseTo(0, 9);
    expect(wolf.whole.z ?? 0).toBeCloseTo(0, 9);
    expect(wolf.close.z!).toBeGreaterThan(wolf.actor.size.z * 0.2); // (its head: well before its middle)
    expect(wolf.close.far).toBeLessThan(wolf.whole.far);
    expect(wolf.close.far).toBeGreaterThanOrEqual(wolf.actor.size.z * 1.3 - 1e-9);
    // (What's low and wide, a spider: from hardly nearer than it's seen whole.)
    const spider = seen(foe('caveSpider'));
    expect(spider.close.far).toBeGreaterThanOrEqual(Math.max(spider.actor.size.x, spider.actor.size.z) * 1.3 - 1e-9);
    const someone = seen(human);
    expect(Math.abs(someone.close.x!) + Math.abs(someone.close.z!)).toBe(0);
    expect(someone.close.far).toBeCloseTo(someone.actor.size.y * 2.1, 6);
  });
});

describe('what is see-through, turned to stone', () => {
  it('stands in stone on its plinth, solid: a ghost, a lynx lurking', () => {
    for (const kind of ['ghost', 'lynx'] as const) {
      const { meshes, tall } = carved(stoneFigure(foe(kind)()).root);
      expect(meshes.length, kind).toBeGreaterThan(0);
      expect(tall, kind).toBeGreaterThan(0.15);
      for (const mesh of meshes) expect((mesh.material as THREE.Material).transparent, kind).toBe(false);
    }
  });

  it('sets what hovered down on its plinth: a bat, a ghost; someone, where they stood', () => {
    const plinth = new THREE.Box3().setFromObject(stoneFigure(new THREE.Group()).root).max.y;
    for (const stood of [foe('caveBat'), foe('ghost'), foe('wolf'), human]) expect(Math.abs(carved(stoneFigure(stood()).root).low - plinth)).toBeLessThan(0.035);
  });

  it('leaves no shade under someone, nor anything over their head', () => {
    const { meshes } = carved(stoneFigure(human()).root);
    expect(meshes.length).toBeGreaterThan(3);
    for (const mesh of meshes) expect((mesh.material as THREE.Material).transparent).toBe(false);
    const wolf = stoneFigure(foe('wolf')()).root;
    wolf.traverseVisible((o) => expect((o as THREE.Sprite).isSprite ?? false).toBe(false));
  });
});
