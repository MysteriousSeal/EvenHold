// @vitest-environment happy-dom
// A transformation played full screen (view/cinema/): the one turned staged part by part (a human's legs, arms,
// body and head in turn, things grown on them; anything else as one part pulled to the new shape), giving way to
// what they've become, which settles; a line for each beat; over after its length, or at any key; the game's to
// stand still meanwhile (told 'transformed' by the model as the spell's cast).
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { makeActor } from '../src/view/cinema/actor';
import { HEN, chickenStaging, henBecoming } from '../src/view/cinema/stagings/chickenStaging';
import { STAGINGS } from '../src/view/cinema/staging';
import { COW, bullStaging, cowStaging, cowStagingOf } from '../src/view/cinema/stagings/cowStaging';
import { COW_COLORS, COW_PALETTE, COW_PALETTES } from '../src/view/meshes/turned/cowVoxels';
import { COW_COATS } from '../src/model/spells/turned';
import { HORSE, horseBecoming, horseStaging } from '../src/view/cinema/stagings/horseStaging';
import { statueStagingOf } from '../src/view/cinema/stagings/statueStaging';
import { treeStagingOf } from '../src/view/cinema/stagings/treeStaging';
import { stoned } from '../src/view/meshes/turned/statue';
import { TREE_SHAPES } from '../src/model/constants';
import { partPieces } from '../src/view/cinema/stagings/becoming';
import { HORSE_LEGS, HORSE_PALETTE, buildHorseBody, buildHorseHead, buildHorseLeg } from '../src/view/meshes/turned/horseVoxels';
import { GIVES_WAY, LENGTH, playTransformation } from '../src/view/cinema/transformCinema';
import { PartMorph } from '../src/view/cinema/morph/partMorph';
import { VoxelMorph, sampleFigure } from '../src/view/cinema/morph/voxelMorph';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { EnemyViews } from '../src/view/meshes/enemy/enemyViews';
import { makeEnemy } from '../src/model/enemies/enemies';
import { buildChickenBody, buildChickenHead, buildChickenLeg } from '../src/view/meshes/turned/chickenVoxels';

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

// A part-by-part morph's meshes (each on its joint), and where each one's cubes are in the world, joints and all.
const meshesOf = (morph: PartMorph) => morph.object.children.map((joint) => joint.children[0] as THREE.InstancedMesh);
const spotsOf = (mesh: THREE.InstancedMesh) => {
  const m = new THREE.Matrix4();
  mesh.parent!.parent!.rotation.set(0, 0, 0); // (the whole of it, its shudder aside)
  mesh.updateWorldMatrix(true, false);
  return Array.from({ length: mesh.count }, (_, k) => (mesh.getMatrixAt(k, m), new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld)));
};

const human = () => {
  const rig = new HumanRig();
  rig.update(0, 0, 0, 0, null, 0, 'stand');
  return rig.root;
};
// Something not human-shaped: a long low body and a head, facing +Z, a label over it.
const beast = () => {
  const root = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 0.7), new THREE.MeshStandardMaterial());
  body.position.y = 0.25;
  const over = Object.assign(new THREE.Group(), { name: 'overhead' });
  over.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
  over.position.y = 5;
  root.add(body, over);
  return root;
};
const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });

describe('someone human-shaped turned into a chicken, part by part', () => {
  it('has each part morph into hers: legs her legs, arms her wings, torso her body, head her head; a hen entire', () => {
    const actor = makeActor(human());
    const { pieces, big, down } = partPieces(actor, henBecoming)!;
    expect(pieces.length).toBe(6); // (two legs, two arms, the torso, the head)
    for (const piece of pieces) [expect(piece.from.at.length).toBeGreaterThan(5), expect(piece.into.at.length).toBeGreaterThan(0)];
    const hen = chickenStaging.cloud!();
    const key = (p: THREE.Vector3, size: number) => p.toArray().map((n) => Math.round(n / (size / 2))).join();
    const into = pieces.flatMap((piece) => piece.into.at.map((at) => key(at, piece.into.size)));
    expect(new Set(into).size).toBe(hen.at.length); // (every voxel of her, each once)
    const boxOf = (i: number) => new THREE.Box3().setFromPoints(pieces[i].into.at);
    expect(boxOf(0).max.x * boxOf(1).max.x).toBeLessThan(0); // (a leg a side)
    expect(boxOf(2).max.x * boxOf(3).max.x).toBeLessThan(0); // (a wing a side)
    expect(boxOf(5).max.z).toBeGreaterThan(boxOf(4).max.z); // (her head: before her body)
    // Played to where she comes down: a hen entire, as tall as they were.
    const morph = new PartMorph(pieces, big, down);
    morph.update(down, 1);
    const all = meshesOf(morph).flatMap((mesh, i) => spotsOf(mesh).map((at) => key(at, pieces[i].into.size)));
    expect(new Set(all)).toEqual(new Set(into));
  });
});

describe('anything else turned into a chicken', () => {
  it('is one part: what is over its head hidden, its shape pulled to hers, then down to her size', () => {
    const actor = makeActor(beast());
    expect(actor.human).toBeNull();
    expect(actor.size.y).toBeCloseTo(0.25, 5); // (the label over it: not counted, nor shown)
    const made = chickenStaging.prepare!(actor);
    chickenStaging.stage!(actor, made, 0.6, 0);
    const s = actor.root.scale;
    expect(s.z / s.y).toBeLessThan(1); // (long and low, pulled shorter and taller: a hen's shape)
    chickenStaging.stage!(actor, made, 1, 0);
    expect(actor.root.scale.y * actor.size.y).toBeLessThan(HEN.y * 1.2);
  });
});

describe('a four-legged beast turned into a chicken, part by part', () => {
  const bear = () => new EnemyViews(new THREE.Scene()).standIn(makeEnemy(1, 'bear', 0, 0));

  it('has its parts found: two hind legs, two forelegs, a trunk, a head; nothing over its head', () => {
    const actor = makeActor(bear());
    expect(actor.human).toBeNull();
    expect(actor.beast!.hind.length).toBe(2);
    expect(actor.beast!.fore.length).toBe(2);
    expect(actor.size.z).toBeGreaterThan(actor.size.x); // (long: the bar over it not counted)
  });

  it('has each part truly become hers, in its turn: hind legs her legs, forelegs her wings, trunk her body, head her head; a hen entire, then her size', () => {
    const actor = makeActor(bear());
    const { pieces, big, down } = partPieces(actor, henBecoming)!;
    expect(pieces.length).toBe(6); // (two hind legs, two forelegs, the trunk, the head)
    expect(big).toBeGreaterThan(1.3); // (a hen as big as the bear, to change into where it stands)
    for (const piece of pieces) [expect(piece.from.at.length).toBeGreaterThan(5), expect(piece.into.at.length).toBeGreaterThan(0)];
    // In their turn: hind legs, forelegs, trunk, head.
    expect(pieces.map((p) => p.window[0])).toEqual([...pieces.map((p) => p.window[0])].sort((a, b) => a - b));
    // What they become, together: every voxel of the hen, each once, as big as the bear.
    const hen = chickenStaging.cloud!();
    const key = (p: THREE.Vector3, size: number) => p.toArray().map((n) => Math.round(n / (size / 2))).join();
    const into = pieces.flatMap((piece) => piece.into.at.map((at) => key(at, piece.into.size)));
    expect(new Set(into).size).toBe(hen.at.length);
    expect(new Set(hen.at.map((at) => key(at, hen.size)))).toEqual(new Set(into));
    // The hind legs' become her legs (low, thin); the forelegs' her sides; the head's her head (high, forward).
    const boxOf = (i: number) => new THREE.Box3().setFromPoints(pieces[i].into.at);
    expect(boxOf(0).max.y).toBeLessThan(boxOf(4).min.y + pieces[0].into.size); // (her legs: under her body)
    expect(boxOf(2).max.x * boxOf(3).max.x).toBeLessThan(0); // (a wing a side)
    expect(boxOf(5).max.z).toBeGreaterThan(boxOf(4).max.z); // (her head: before her body)
    // Played: partway, the hind legs hers already, the head still the bear's; at the end, a hen at her own size.
    const morph = new PartMorph(pieces, big, down);
    const meshes = meshesOf(morph);
    const spots = spotsOf;
    // First its stance, still itself: no part reshaped yet, each cube where it was on its part.
    morph.update(pieces[0].window[0] - 0.02, 1);
    const local = (mesh: THREE.InstancedMesh) => {
      const m = new THREE.Matrix4();
      return Array.from({ length: mesh.count }, (_, k) => (mesh.getMatrixAt(k, m), new THREE.Vector3().setFromMatrixPosition(m).add(pieces[meshes.indexOf(mesh)].pivot![0])));
    };
    expect(new Set(local(meshes[5]).map((at) => key(at, pieces[5].from.size)))).toEqual(new Set(pieces[5].from.at.map((at) => key(at, pieces[5].from.size)))); // (the bear's head, still)
    expect(morph.object.rotation.toArray().slice(0, 3)).toEqual([0, 0, 0]); // (nothing shaken)
    // Then every part reshaped, all but together: a leg done, a hen's leg entire, where hers stands.
    morph.update(pieces[0].window[1] + 0.001, 1);
    const legNow = new Set(spots(meshes[0]).map((at) => key(at, pieces[0].into.size)));
    expect(legNow).toEqual(new Set(pieces[0].into.at.map((at) => key(at, pieces[0].into.size))));
    expect(pieces[5].window[0]).toBeLessThan(pieces[0].window[1]); // (its head: begun before its legs are done)
    expect(morph.object.scale.x).toBe(1);
    morph.update(down, 2);
    const all = meshes.flatMap((mesh, i) => spots(mesh).map((at) => key(at, pieces[i].into.size)));
    expect(new Set(all)).toEqual(new Set(into)); // (a hen entire, as big as a bear, before she's her own size)
    expect(morph.object.scale.x).toBe(1);
    morph.update(1, 3);
    expect(morph.object.scale.x).toBeCloseTo(1 / big, 6); // (her own size: the hen herself put in its place unseen)
  });

  it('is what the screen plays for a bear: its parts in their turn, its own lines said', () => {
    document.body.replaceChildren();
    const figure = bear();
    const playing = playTransformation(figure, 'Bear', 'chicken', vi.fn(), drawer);
    for (let t = 0; t < 3; t += 0.1) playing.advance(0.1);
    expect(figure.visible).toBe(false); // (its parts, in their own voxels)
    expect(playing.root.querySelector('.transform-line')!.textContent).toMatch(/^The hind legs thin/); // (step by step: its legs' turn, said as a beast's)
    playing.skip();
  });
});

const STEPPED = 14; // seconds someone's turning runs, played step by step (turning.ts)

describe('someone turned into a horse', () => {
  it('is a horse in voxels: a barrel on four legs, a head on an arched neck before it, a tail behind, in its few colours', () => {
    const horse = horseStaging.cloud!();
    const cells = [buildHorseBody(), buildHorseHead(), ...HORSE_LEGS.map((_, i) => buildHorseLeg(i < 2))].reduce((n, grid) => n + Array.from(grid.cells).filter(Boolean).length, 0);
    expect(horse.at.length).toBe(cells);
    const box = new THREE.Box3().setFromPoints(horse.at);
    expect(box.min.y).toBeCloseTo(horse.size / 2, 6); // (its hooves on the ground)
    expect(box.max.y).toBeCloseTo(HORSE.y - horse.size / 2, 6); // (to its ears)
    expect(HORSE.y).toBeGreaterThan(0.55); // (taller than a man's shoulder)
    expect(box.max.z - box.min.z).toBeGreaterThan(box.max.y - box.min.y - 0.25); // (long)
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(1e-6);
    expect(HORSE_PALETTE.length).toBeLessThanOrEqual(8);
    expect(new Set(horse.color.map((c) => c.getHex())).size).toBeGreaterThanOrEqual(5); // (coat, shade, black, white, hoof…)
  });

  it('has each part of a human, and of a bear, morph into its part: legs its hind legs, arms its forelegs, torso its barrel, head its head', () => {
    for (const figure of [human(), new EnemyViews(new THREE.Scene()).standIn(makeEnemy(1, 'bear', 0, 0))]) {
      const { pieces, big, down } = partPieces(makeActor(figure), horseBecoming)!;
      expect(pieces.length).toBe(6);
      const horse = horseStaging.cloud!();
      const key = (p: THREE.Vector3, size: number) => p.toArray().map((n) => Math.round(n / (size / 2))).join();
      const into = pieces.flatMap((piece) => piece.into.at.map((at) => key(at, piece.into.size)));
      expect(new Set(into).size).toBe(horse.at.length); // (every voxel of it, each once)
      const boxOf = (i: number) => new THREE.Box3().setFromPoints(pieces[i].into.at);
      expect(boxOf(0).max.z).toBeLessThan(boxOf(2).min.z); // (the legs: its hind legs; the arms: its forelegs, before them)
      expect(boxOf(5).max.y).toBeGreaterThan(boxOf(4).max.y); // (its head: carried over its back)
      const morph = new PartMorph(pieces, big, down);
      morph.update(down, 1);
      const all = meshesOf(morph).flatMap((mesh, i) => spotsOf(mesh).map((at) => key(at, pieces[i].into.size)));
      expect(new Set(all)).toEqual(new Set(into)); // (a horse entire)
    }
  });

  it('grows bigger than someone smaller than it as it goes, part by part; nothing to come down from after', () => {
    const actor = makeActor(human());
    expect(HORSE.y).toBeGreaterThan(actor.size.y); // (a horse: taller than a man)
    const { pieces, big, down } = partPieces(actor, horseBecoming)!;
    expect(big).toBe(1); // (built at its own size)
    const tall = (i: number, of: 'from' | 'into') => new THREE.Box3().setFromPoints(pieces[i][of].at).getSize(new THREE.Vector3());
    expect(tall(4, 'into').z).toBeGreaterThan(tall(4, 'from').y); // (its barrel: longer than their torso was tall)
    const morph = new PartMorph(pieces, big, down);
    const height = () => new THREE.Box3().setFromPoints(meshesOf(morph).flatMap(spotsOf)).max.y;
    morph.update(0, 0);
    const before = height();
    morph.update(down, 1);
    expect(height()).toBeGreaterThan(before * 1.2); // (bigger than they were, before it's done)
    morph.update(1, 2);
    expect(morph.object.scale.x).toBe(1);
    // A hen, of the same man: built as big as he is, and down to her size at the end, as before.
    expect(partPieces(makeActor(human()), henBecoming)!.big).toBeGreaterThan(1);
  });

  it('is played full screen as the chicken is, with its own words', () => {
    document.body.replaceChildren();
    const done = vi.fn();
    const playing = playTransformation(human(), 'Idtram', 'horse', done, drawer);
    expect(playing.root.querySelector('.transform-title')!.textContent).toBe(STAGINGS.horse.title);
    const said = new Set<string>();
    for (let t = 0; t < STEPPED + 2; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect([...said].some((line) => /all four/.test(line))).toBe(true); // (its four legs at once: never its fore end in the air)
    expect([...said].filter((line) => /mane|blaze|Ears/.test(line)).length).toBe(3); // (what grows on it, a thing at a time)
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('someone turned into a cow', () => {
  it('is a cow in voxels: every part of her once, on her hooves, lower and heavier than the horse, in her few colours', () => {
    const cow = cowStaging.cloud!();
    const hues0 = new Set(cow.color.map((color) => color.getHex()));
    const key = (p: THREE.Vector3) => p.toArray().map((n) => Math.round(n / (cow.size / 2))).join();
    expect(new Set(cow.at.map(key)).size).toBe(cow.at.length); // (no part of her inside another)
    const box = new THREE.Box3().setFromPoints(cow.at);
    expect(box.min.y).toBeCloseTo(cow.size / 2, 6); // (her hooves on the ground)
    expect(box.max.y).toBeCloseTo(COW.y - cow.size / 2, 6); // (to her horns)
    expect(COW.y).toBeLessThan(HORSE.y);
    expect(COW.x).toBeGreaterThan(HORSE.x); // (wider)
    // Her other coats: the same cow, in other colours.
    expect(COW_PALETTES.length).toBe(COW_COATS);
    // A bull: every part of him once too; a hump over his shoulders, higher than her back; no udder.
    const bull = bullStaging.cloud!();
    expect(new Set(bull.at.map(key)).size).toBe(bull.at.length);
    const over = (cloud: typeof cow) => Math.max(...cloud.at.filter((at) => at.z > 0.05 && at.z < 0.2 && Math.abs(at.x) < 0.03).map((at) => at.y));
    expect(over(bull)).toBeGreaterThan(over(cow) + cow.size);
    const pink = (cloud: typeof cow) => cloud.color.filter((color) => color.getHex() === COW_PALETTE[COW_COLORS.pink - 1]).length;
    expect(pink(bull)).toBeLessThan(pink(cow));
    expect(STAGINGS.bull.becomes).toBe('A bull');
    for (const coat of [1, 2, 3]) {
      const other = cowStagingOf(coat).cloud!();
      expect(other.at.length).toBe(cow.at.length);
      expect(new Set(other.color.map((color) => color.getHex()))).not.toEqual(hues0);
    }
    expect(COW_PALETTE.length).toBeLessThanOrEqual(8);
    const hues = new Set(cow.color.map((color) => color.getHex()));
    for (const role of ['red', 'pink', 'horn'] as const) expect(hues.has(COW_PALETTE[COW_COLORS[role] - 1]), role).toBe(true); // (her patches, her muzzle and udder, her horns)
  });

  it('is played step by step as the horse is, her four legs at once, her horns, patches and udder grown on her after', () => {
    document.body.replaceChildren();
    const done = vi.fn();
    const playing = playTransformation(human(), 'Idtram', 'cow', done, drawer);
    expect(playing.root.querySelector('.transform-title')!.textContent).toBe(STAGINGS.cow.title);
    const said = new Set<string>();
    for (let t = 0; t < STEPPED + 2; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect([...said].some((line) => /all four/.test(line))).toBe(true);
    expect([...said].filter((line) => /Horns|Ears|Red, spreading|rump|udder/.test(line)).length).toBe(5);
    expect([...said]).toContain('A cow.');
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('someone turned to stone, and into a tree', () => {
  it('is played step by step: the stone from the ground up to their eyes, a plinth; then themselves in stone', () => {
    document.body.replaceChildren();
    const done = vi.fn();
    const playing = playTransformation(human(), 'Idtram', statueStagingOf(human), done, drawer);
    const said = new Set<string>();
    for (let t = 0; t < 13; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect([...said].filter((line) => /feet|legs|hips|chest|throat|face|eyes/.test(line)).length).toBe(7); // (each height of them, said as the stone reaches it)
    expect([...said]).toContain('A statue.');
    expect(done).toHaveBeenCalledTimes(1);
    // In stone: every colour of theirs the one grey, lighter or darker as it was.
    const [dark, light] = [stoned(new THREE.Color(0x101010)), stoned(new THREE.Color(0xf0f0f0))];
    expect(light.g).toBeGreaterThan(dark.g * 1.5);
    for (const grey of [dark, light]) expect(Math.abs(grey.r - grey.b)).toBeLessThan(0.06);
  });

  it('is played as a turning into a beast is, upright: legs, arms and body its trunk, their head alone its crown, in leaf last', () => {
    document.body.replaceChildren();
    // Every kind and shape of tree: wood for their legs, their body and their arms, a crown for their head (none of
    // them with nothing to become: gone, mid-turning), and all of it between them, each voxel once.
    for (const kind of ['oak', 'pine', 'birch'] as const) {
      for (let shape = 0; shape < TREE_SHAPES; shape++) {
        const staging = treeStagingOf(kind, shape);
        const tree = staging.cloud!();
        const key = (p: THREE.Vector3) => p.toArray().map((n) => Math.round(n / (tree.size / 2))).join();
        for (const plain of [false, true]) {
          const its = staging.becoming.parts(1, plain);
          const parts = [...its.legs, ...its.arms, its.body, its.head];
          expect(parts.every((part) => part.at.length > 0), `${kind} ${shape}`).toBe(true);
          expect(new Set(parts.flatMap((part) => part.at.map(key)))).toEqual(new Set(tree.at.map(key)));
        }
        const { joints } = staging.becoming.parts(1);
        expect(joints.legs[0].y).toBeLessThanOrEqual(joints.arms[0].y); // (their legs: the foot of its trunk; their arms: over their body)
      }
    }
    const done = vi.fn();
    const playing = playTransformation(human(), 'Idtram', treeStagingOf('birch', 1), done, drawer);
    const said = new Set<string>();
    for (let t = 0; t < STEPPED + 2; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect([...said].some((line) => /crown of bare twigs/.test(line))).toBe(true);
    expect([...said].some((line) => /^Leaves/.test(line))).toBe(true);
    expect([...said]).toContain('A birch.');
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('a foe stood in to be turned', () => {
  it('has nothing in its hands: a bandit, a skeleton, a bowman, a draugr', () => {
    const views = new EnemyViews(new THREE.Scene());
    // (What a skeleton, a bowman or a draugr holds: marked 'held'.)
    const held = (root: THREE.Object3D) => {
      let shown = 0;
      root.traverse((o) => (o.name === 'held' && o.visible ? shown++ : 0));
      return shown;
    };
    for (const kind of ['skeleton', 'skeletonArcher', 'draugr'] as const) expect(held(views.standIn(makeEnemy(1, kind, 0, 0))), kind).toBe(0);
    // A bandit: what they hold worn in their hands' slots; put down.
    const bandit = { ...makeEnemy(2, 'bandit', 0, 0), human: { look: new HumanRig().look, equipment: { mainHand: 'shortSword' as const } } };
    const [armed, empty] = [new HumanRig(bandit.human.look), views.standIn(bandit)];
    armed.wear(bandit.human.equipment);
    const seen = (root: THREE.Object3D) => {
      let n = 0;
      root.traverseVisible((o) => (o as THREE.Mesh).isMesh && n++);
      return n;
    };
    const bare = new HumanRig(bandit.human.look);
    expect(seen(armed.root)).toBeGreaterThan(seen(bare.root)); // (a blade in hand: one more thing to see)
    armed.root.userData.emptyHands();
    expect(seen(armed.root)).toBe(seen(bare.root));
    expect(empty.userData.joints).toBeDefined();
  });
});

describe('anything not human-shaped, taken apart into its voxels', () => {
  it('is read off its meshes as a shell of cubes, in its colours, what is hidden left out', () => {
    const root = beast();
    (root.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({ color: 0x6a4a2e });
    makeActor(root); // (what's over its head: hidden)
    const shell = sampleFigure(root, 0.25);
    expect(shell.at.length).toBeGreaterThan(200);
    expect(shell.at.length).toBeLessThanOrEqual(2600);
    const box = new THREE.Box3().setFromPoints(shell.at);
    expect(box.max.y).toBeLessThanOrEqual(0.375 + shell.size); // (within the body, to a cube: none of the label over it)
    expect(box.min.y).toBeGreaterThanOrEqual(0.125 - shell.size);
    expect(box.max.z - box.min.z).toBeGreaterThan(0.6);
    expect(shell.color[0].getHex()).toBe(0x6a4a2e);
    expect(new Set(shell.at.map((p) => p.toArray().map((n) => n.toFixed(4)).join())).size).toBe(shell.at.length); // (a cube a place)
  });

  it("has the hen's own voxels to go to, where she stands", () => {
    const hen = chickenStaging.cloud!();
    const cells = [buildChickenBody(), buildChickenHead(), buildChickenLeg(), buildChickenLeg()].reduce((n, grid) => n + Array.from(grid.cells).filter(Boolean).length, 0);
    expect(hen.at.length).toBe(cells);
    const box = new THREE.Box3().setFromPoints(hen.at);
    expect(box.min.y).toBeCloseTo(hen.size / 2, 6); // (her feet on the ground)
    expect(box.max.y).toBeLessThan(HEN.y + hen.size);
    expect(Math.abs(box.min.x + box.max.x)).toBeLessThan(1e-6); // (stood on the middle)
  });

  it('sends each cube from its place to one of hers: whole at either end, aloft and scattered between, the low to the low', () => {
    const root = beast();
    makeActor(root);
    const [shell, hen] = [sampleFigure(root, 0.25), chickenStaging.cloud!()];
    const morph = new VoxelMorph(shell, hen);
    expect(morph.mesh.count).toBe(Math.max(shell.at.length, hen.at.length));
    const read = () => {
      const [m, at, turn, scale] = [new THREE.Matrix4(), new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
      return Array.from({ length: morph.mesh.count }, (_, k) => {
        morph.mesh.getMatrixAt(k, m);
        m.decompose(at, turn, scale);
        return { at: at.clone(), size: scale.x };
      });
    };
    const keyAt = (size: number) => (p: THREE.Vector3) => p.toArray().map((n) => Math.round(n / (size / 2))).join(); // (to the half cube: the same place, however it's rounded)
    let key = keyAt(shell.size);
    // Whole, as it was: every cube on a place of the shell, at its size.
    morph.update(0, 0);
    const [was, shellPlaces] = [read(), new Set(shell.at.map(key))];
    for (const cube of was) [expect(shellPlaces.has(key(cube.at))).toBe(true), expect(cube.size).toBeCloseTo(shell.size, 6)];
    // Between: off their places, spread wider than either shape.
    morph.update(0.5, 1);
    const wide = new THREE.Box3().setFromPoints(read().map((c) => c.at));
    expect(wide.max.x - wide.min.x).toBeGreaterThan(0.4);
    // Whole again, as her: every cube on one of her voxels, every one of hers filled, at her voxels' size.
    morph.update(1, 2);
    key = keyAt(hen.size);
    const [now, henPlaces] = [read(), new Set(hen.at.map(key))];
    for (const cube of now) [expect(henPlaces.has(key(cube.at))).toBe(true), expect(cube.size).toBeCloseTo(hen.size, 6)];
    expect(new Set(now.map((c) => key(c.at))).size).toBe(hen.at.length);
    // The lowest of it went to the lowest of her.
    const lowest = was.map((c, k) => ({ y: c.at.y, k })).sort((a, b) => a.y - b.y)[0].k;
    expect(now[lowest].at.y).toBeLessThan(hen.size * 2);
  });

  it('is what the screen plays for it: its voxels aloft, then the hen in their place', () => {
    document.body.replaceChildren();
    const figure = beast();
    const done = vi.fn();
    const playing = playTransformation(figure, 'Bear', 'chicken', done, drawer);
    playing.advance(0.1);
    expect(playing.root.querySelector('.transform-line')!.textContent).toContain('Bear');
    for (let t = 0; t < 3; t += 0.1) playing.advance(0.1);
    expect(figure.visible).toBe(false); // (itself: gone, into its voxels)
    expect(playing.root.querySelector('.transform-line')!.textContent).toBe(STAGINGS.chicken.looseLines![2][1]);
    for (let t = 0; t < LENGTH; t += 0.1) playing.advance(0.1);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('a transformation played', () => {
  it('fills the screen, says each beat, gives way to what they have become, and is over after its length', () => {
    document.body.replaceChildren();
    const figure = human();
    const done = vi.fn();
    const playing = playTransformation(figure, 'Idtram', 'chicken', done, drawer);
    expect(document.querySelector('.transform-cinema')).toBe(playing.root);
    expect(playing.root.querySelector('.transform-title')!.textContent).toBe(STAGINGS.chicken.title);
    playing.advance(0.1);
    expect(playing.root.querySelector('.transform-line')!.textContent).toContain('Idtram');
    const said = new Set<string>();
    for (let t = 0.1; t < STEPPED * GIVES_WAY - 0.2; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect(said.size).toBe(14); // (each step, said: a start, what they wear, their hands, its stance, four parts of them, five things grown on it, and it done)
    expect([...said].filter((line) => /comb|beak|wattle|Feathers|tail/.test(line)).length).toBe(5);
    for (let t = 0; t < 0.5; t += 0.1) playing.advance(0.1);
    expect(figure.visible).toBe(false); // (given way)
    expect(playing.root.querySelector('.transform-line')!.textContent).toBe('A chicken.');
    expect(done).not.toHaveBeenCalled();
    for (let t = 0; t < STEPPED; t += 0.1) playing.advance(0.1);
    expect(done).toHaveBeenCalledTimes(1);
    expect(playing.over).toBe(true);
    expect(document.querySelector('.transform-cinema')).toBeNull();
  });

  it('is skipped at any key, which is none of the game\'s; or at a click', () => {
    document.body.replaceChildren();
    const done = vi.fn();
    const playing = playTransformation(human(), 'Idtram', 'chicken', done, drawer);
    const heard = vi.fn();
    window.addEventListener('keydown', heard);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit1' }));
    window.removeEventListener('keydown', heard);
    expect(done).toHaveBeenCalledTimes(1);
    expect(heard).not.toHaveBeenCalled();
    expect(document.querySelector('.transform-cinema')).toBeNull();
    playing.advance(1); // (over: nothing more)
    playing.skip();
    expect(done).toHaveBeenCalledTimes(1);
    const again = playTransformation(human(), 'Idtram', 'chicken', done, drawer);
    again.root.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(done).toHaveBeenCalledTimes(2);
  });
});

describe('the model', () => {
  it("tells of someone turned, there and then, for its turning to be played", () => {
    const model = fresh();
    const told: Array<{ kind: string }> = [];
    const report = model.report;
    model.report = (event) => [told.push(event), report.call(model, event)];
    const one = model.travellers.list[0];
    expect(model.chickens.turn(one)).toBe(true);
    expect(told.find((e) => e.kind === 'transformed')).toMatchObject({ who: one, into: 'chicken' });
  });
});
