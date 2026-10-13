// Someone turned into a tree (model/spells/turned.ts: one of the world's own from then on, of its kind and shape),
// played step by step as a turning into a beast is (turning.ts; becoming.ts), but stood upright all along: what they
// wear off them; their feet set; their legs closed into the foot of a trunk, bark from the ground up; their arms
// closed against their sides, wood with it; their body the trunk; their head alone its crown, bare still; then its
// leaves, here and there till it's covered. A tree's far taller than they are: each part grows into its part as it changes.
import * as THREE from 'three';
import type { TreeKind } from '../../../model/types';
import { SINK, buildTreeGeometry } from '../../meshes/tree/treeMesh';
import { TREE_GRID, TREE_PALETTE, TREE_VOXEL_SIZE, buildTreeVoxels } from '../../meshes/tree/treeVoxels';
import { hued, joined, some } from '../morph/clouds';
import { cloudOf, type Cloud } from '../morph/voxelMorph';
import type { Staging } from '../staging';
import type { Becoming } from './becoming';
import { UNDRESSED, turningInto, type Telling } from './turning';

const V = TREE_VOXEL_SIZE;
const WOOD = [1, 2, 3, 20, 21, 22]; // (treeParts.ts's bark, an oak's or pine's and a birch's)
const NAMES: Record<TreeKind, string> = { oak: 'An oak', pine: 'A pine', birch: 'A birch' };
const FOOT = 0.35; // of its trunk's rows of wood, from the ground up: what their legs become
const SIDES = 0.65; // of it: from there up, what their arms become (either side of it), their body what's between

// A tree's voxels, where it's drawn (treeMesh.ts), `big` times its size.
const treeCloud = (kind: TreeKind, shape: number, big: number): Cloud => cloudOf([{ grid: buildTreeVoxels(kind, shape), palette: TREE_PALETTE, origin: new THREE.Vector3((-TREE_GRID[0] * V * big) / 2, -SINK * big, (-TREE_GRID[2] * V * big) / 2) }], V * big);

export function treeStagingOf(kind: TreeKind = 'oak', shape = 0): Staging & { becoming: Becoming } {
  const hue = hued(TREE_PALETTE);
  const wooden = (cloud: Cloud) => (_at: THREE.Vector3, i: number) => hue(cloud, i, ...WOOD);
  // Its parts: its trunk's foot, either side (their legs); the middle of its trunk (their body); the top of its
  // trunk, either side (their arms); its crown, all of it (their head).
  const partsOf = (big: number) => {
    const tree = treeCloud(kind, shape, big);
    const [wood, leaves] = [some(tree, wooden(tree)), some(tree, (at, i) => !wooden(tree)(at, i))];
    const box = (cloud: Cloud) => new THREE.Box3().setFromPoints(cloud.at);
    const [trunk, crown] = [box(wood), box(leaves)];
    // (By its rows of wood, each part of them a row at least: whatever its shape, none of them with nothing to become.)
    const rows = [...new Set(wood.at.map((at) => Math.round(at.y / (V * big))))].sort((a, b) => a - b).map((row) => row * V * big);
    const from = Math.min(rows.length - 2, Math.max(1, Math.round(rows.length * FOOT)));
    const to = Math.min(rows.length - 1, Math.max(from + 1, Math.round(rows.length * SIDES)));
    const edge = (row: number) => (rows[row] ?? trunk.max.y + V * big) - (V * big) / 2; // (just under that row)
    return { wood, leaves, foot: edge(from), sides: edge(to), crown, whole: rows.length < 3 };
  };
  // A length of its trunk, either side of its middle (a trunk too thin to part: the whole of it, each).
  const halves = (cloud: Cloud): [Cloud, Cloud] => {
    const [left, right] = [some(cloud, (p) => p.x < 0), some(cloud, (p) => p.x >= 0)];
    return left.at.length && right.at.length ? [left, right] : [cloud, cloud];
  };
  const becoming: Becoming = {
    tall: TREE_GRID[1] * V * 0.92,
    long: TREE_GRID[0] * V * 0.8,
    upright: true,
    // Its leaves, last: out from the top of its trunk, till it's covered.
    grows(big) {
      const { leaves, crown } = partsOf(big);
      return [{ on: 'head', cloud: leaves, root: new THREE.Vector3(0, crown.min.y, 0), line: 'Leaves: here and there, then everywhere.' }];
    },
    parts(big, plain) {
      const { wood, leaves, foot, sides, crown, whole } = partsOf(big);
      // (Bare still: its crown all twig and bough, the colour of its bark.)
      const bark = new THREE.Color(TREE_PALETTE[kind === 'birch' ? 20 : 1]);
      const bare = plain ? { ...leaves, color: leaves.color.map((color) => bark.clone().multiplyScalar(0.75 + 0.5 * color.g)) } : leaves;
      const at = (x: number, y: number) => new THREE.Vector3(x * V * big, y, 0);
      return {
        // (A trunk of a row or two: all of it, for each part of them.)
        legs: halves(whole ? wood : some(wood, (p) => p.y < foot)),
        arms: halves(whole ? wood : some(wood, (p) => p.y >= sides)),
        body: whole ? wood : some(wood, (p) => p.y >= foot && p.y < sides),
        head: bare,
        joints: { legs: [at(-1, foot), at(1, foot)], arms: [at(-1, sides), at(1, sides)], body: at(0, foot), head: at(0, crown.min.y) },
      };
    },
    arms: () => [0, 0, 0],
  };
  const PERSON: Telling = {
    start: '{name} feels the ground take hold, and starts.',
    ...UNDRESSED,
    stance: 'Their feet are set. They will not lift.',
    legs: 'The legs close together: one trunk, bark from the ground up. The toes go down as roots.',
    arms: 'The arms close against the sides: bark over them, wood with the rest.',
    body: 'The chest, the back: the trunk, ringed, and rising.',
    head: 'The head, the hair: a crown of bare twigs, spreading.',
    done: `${NAMES[kind]}, like any other.`,
  };
  const BEAST: Telling = { ...PERSON, start: '{name} feels the ground take hold.', stance: 'Its feet are set. They will not lift.', legs: 'The hind legs close together: one trunk, bark from the ground up.', arms: 'The forelegs close against it: bark over them, wood with the rest.', body: 'The body: the trunk, ringed, and rising.', head: 'The head: a crown of bare twigs, spreading.' };
  return {
    becoming,
    title: "Woodward's rooting",
    becomes: NAMES[kind],
    lines: [[0, '{name} feels the ground take hold.'], [0.3, 'Bark, from the ground up.'], [0.7, 'Leaves.']],
    looseLines: [[0, '{name} feels the ground take hold.'], [0.08, 'It comes apart, from the ground up.'], [0.4, 'Every piece of it finds a new place.'], [0.72, 'Taller. Rooted. In leaf.']],
    cloud: () => joined([treeCloud(kind, shape, 1)], V),
    direct: turningInto(becoming, { person: PERSON, beast: BEAST }),
    target() {
      const tree = new THREE.Mesh(buildTreeGeometry(kind, shape), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }));
      // (In leaf: a stir of wind through it.)
      return { root: tree, height: becoming.tall, settle: (j, time) => void (tree.rotation.z = Math.sin(time * 2.2) * 0.02 * Math.min(1, j * 3)) };
    },
  };
}
