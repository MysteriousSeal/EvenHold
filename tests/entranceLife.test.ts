// @vitest-environment happy-dom
// What marks the dungeons' ways in out in the world (view/meshes/dungeon/): a
// crypt's braziers either side of its stairs; and round those near the hero, what moves: bats over a cave (a
// couple by day, more by night), spores and wisps glowing, a crypt's crows (off
// when the hero comes near, back once they've gone), its fires lit by night.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { GameModel } from '../src/model/GameModel';
import { EntranceLife, nightAt } from '../src/view/meshes/dungeon/entranceLife';
import { brazierSpots } from '../src/view/meshes/dungeon/entranceDressing';

const MID = { width: 512, depth: 512 };
const model = new GameModel(1, MID);
const meshes = (scene: THREE.Scene) => scene.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);
const NOON = 12 * 60;
const MIDNIGHT = 24 * 60;

describe('the dungeons\' ways in', () => {
  it('have a crypt\'s braziers either side of its stairs, near them', () => {
    const spots = brazierSpots(model);
    expect(spots).toHaveLength(model.crypts.length * 2);
    model.crypts.forEach((crypt, i) => {
      for (const b of spots.slice(i * 2, i * 2 + 2)) expect(Math.hypot(b.x - crypt.middle.x, b.z - crypt.middle.z)).toBeLessThan(2);
    });
  });

  it('are alive near the hero: bats over a cave (more by night), glowing spores; a crypt\'s wisps, its crows (off as the hero comes, back once they\'ve gone), its fires by night', () => {
    expect(nightAt(NOON)).toBe(0);
    expect(nightAt(MIDNIGHT)).toBe(1);
    const scene = new THREE.Scene();
    const life = new EntranceLife(scene, model);
    const [bats, crows, motes] = meshes(scene);
    const cave = model.caves[0];
    life.update(0.1, { x: cave.entrance.x + 3, z: cave.entrance.z + 3 }, NOON, true);
    const byDay = bats.count;
    expect(byDay).toBeGreaterThanOrEqual(2);
    expect(motes.count).toBeGreaterThan(0);
    life.update(0.1, { x: cave.entrance.x + 3, z: cave.entrance.z + 3 }, MIDNIGHT, true);
    expect(bats.count).toBeGreaterThan(byDay);
    // A crypt: its crows on the ridge; the hero coming near, they're off (up over the tomb), and back once they've gone.
    const crypt = model.crypts[0];
    const far = { x: crypt.entrance.x + 30, z: crypt.entrance.z };
    const at = { x: crypt.entrance.x, z: crypt.entrance.z };
    life.update(0.1, { x: crypt.entrance.x + 8, z: crypt.entrance.z }, MIDNIGHT, true);
    expect(crows.count).toBeGreaterThanOrEqual(3);
    const perched = new THREE.Matrix4();
    crows.getMatrixAt(0, perched);
    const y0 = new THREE.Vector3().setFromMatrixPosition(perched).y;
    for (let i = 0; i < 20; i++) life.update(0.1, at, MIDNIGHT, true);
    const flying = new THREE.Matrix4();
    crows.getMatrixAt(0, flying);
    expect(new THREE.Vector3().setFromMatrixPosition(flying).y).toBeGreaterThan(y0 + 0.5);
    for (let i = 0; i < 60; i++) life.update(0.1, far, MIDNIGHT, true);
    life.update(0.1, { x: crypt.entrance.x + 12, z: crypt.entrance.z }, MIDNIGHT, true);
    crows.getMatrixAt(0, flying);
    expect(new THREE.Vector3().setFromMatrixPosition(flying).y).toBeCloseTo(y0, 3);
    // Its fires: by night, lit; by day, out.
    const fires = scene.children.filter((c) => c instanceof THREE.Group);
    expect(fires.length).toBeGreaterThan(0);
    expect(fires.every((f) => f.visible)).toBe(true);
    life.update(0.1, { x: crypt.entrance.x + 12, z: crypt.entrance.z }, NOON, true);
    expect(fires.every((f) => !f.visible)).toBe(true);
    // Indoors: none of it shown.
    life.update(0.1, at, NOON, false);
    expect([bats, crows, motes].every((m) => !m.visible)).toBe(true);
  });
});
