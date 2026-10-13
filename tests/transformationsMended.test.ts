// @vitest-environment happy-dom
// Two faults the ten new charms had, found by playing them whole and looking, mended, each kept as a test.
// A toad's hops (view/meshes/turned/toadRig.ts): the model leaps half a tile at a time and says how far through
// each leap it is (`hop`); the rig told its hops from the ground covered instead, one every 0.2, so it made two and
// a half of them to each of the model's and was left at the top of the last, in the air over where the model had it
// sat, to come down on the spot. It reads the model's word now: one rise and fall to a leap, down as it lands.
// A ghost, a painting, a doll of what has nothing solid to it (meshes/turned/recoloured.ts solidMeshes): a ruin's
// ghost is all see-through, and what's see-through was taken for a shade or a glow and hidden, so there was nothing
// of it at all: a ghost of it drawn nowhere (its wisp hung at no place: not a number), its turning an empty slab.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { fresh } from './support/testWorld';
import { makeEnemy } from '../src/model/enemies/enemies';
import { paintingOf } from '../src/view/meshes/turned/painting';
import { ragDollOf } from '../src/view/meshes/turned/ragDoll';
import { solidMeshes } from '../src/view/meshes/turned/recoloured';
import { ToadRig } from '../src/view/meshes/turned/toadRig';
import { ghostFigure } from '../src/view/meshes/turned/turnedGhost';

describe('a toad, the game and its drawing stepped together', () => {
  it('rises once for each leap the model makes, and is on the ground whenever the model has it sat', () => {
    const model = fresh();
    const { hero } = model;
    model.enemies.length = 0;
    const foe = makeEnemy(900, 'wolf', hero.x, hero.z + 2);
    model.enemies.push(foe);
    expect(model.chickens.turn(foe, 'toad')).toBe(true);
    const toad = model.chickens.hens[0];
    model.isOpenTile = () => true; // (open ground all about it)
    Object.assign(hero, { x: toad.x + 20 });
    const rig = new ToadRig(new THREE.MeshStandardMaterial());
    const drawn = rig.root.children[0];
    rig.update(toad, 0);
    let [leaps, rises, wasHop, wasUp, highest] = [0, 0, 0, false, 0];
    for (let t = 0; t < 120; t += 1 / 60) {
      model.chickens.update(1 / 60);
      rig.update(toad, 1 / 60);
      const up = drawn.position.y > 1e-6;
      if (toad.hop! > 0 && wasHop === 0) leaps++;
      if (up && !wasUp) rises++;
      if (toad.hop === 0) expect(drawn.position.y, `sat, ${t.toFixed(2)} s in`).toBe(0);
      expect([rig.root.position.x, rig.root.position.z]).toEqual([toad.x, toad.z]); // (where the model has it)
      [wasHop, wasUp, highest] = [toad.hop!, up, Math.max(highest, drawn.position.y)];
    }
    expect(leaps).toBeGreaterThan(10);
    expect(rises).toBe(leaps);
    expect(highest).toBeGreaterThan(0.03); // (and it does leave the ground)
  });
});

describe('a ghost, a painting, a doll of what has nothing solid to it', () => {
  // A ruin's ghost, as it's drawn: every mesh of it see-through, coloured voxel by voxel; a name over it.
  const wraith = () => {
    const root = new THREE.Group();
    for (const y of [0.3, 0.55]) {
      const geometry = new THREE.BoxGeometry(0.2, 0.25, 0.15);
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(new Array(geometry.getAttribute('position').count * 3).fill(0.8), 3));
      const part = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.6 }));
      part.position.y = y;
      root.add(part);
    }
    root.add(Object.assign(new THREE.Group(), { name: 'overhead' }));
    return root;
  };
  const seen = (root: THREE.Object3D) => {
    let [meshes, sound] = [0, true];
    root.updateMatrixWorld(true);
    root.traverseVisible((o) => {
      if ((o as THREE.Mesh).isMesh) meshes++;
      sound &&= [...o.position.toArray(), ...o.scale.toArray()].every(Number.isFinite);
    });
    return { meshes, sound };
  };

  it('is of what is seen through, there being nothing else of it: drawn, and at a place', () => {
    expect(solidMeshes(wraith())).toHaveLength(2);
    const ghost = ghostFigure(wraith());
    expect(seen(ghost.root).sound).toBe(true);
    expect(seen(ghost.root).meshes).toBeGreaterThan(4); // (its two parts, their depths, its wisp)
    const painting = paintingOf(wraith());
    expect(painting.layout.box.max.y).toBeCloseTo(0.675, 5); // (the room it takes up its own: no empty canvas)
    expect(seen(painting.root)).toMatchObject({ sound: true });
    const doll = ragDollOf(wraith());
    expect(seen(doll.root).sound).toBe(true);
    expect(seen(doll.root).meshes).toBeGreaterThan(1);
    for (const made of [ghost, painting, doll]) made.dispose();
  });

  it('leaves what is see-through of anything solid hidden, as before (a shade, a glow)', () => {
    const figure = wraith();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.4, 0.2), new THREE.MeshStandardMaterial());
    figure.add(body);
    expect(solidMeshes(figure)).toEqual([body]);
    expect(figure.children.filter((child) => (child as THREE.Mesh).isMesh && child.visible)).toEqual([body]);
  });
});
