// The hero fishing, as drawn (view/meshes/water/fishingLine.ts): the rod in hand held out over the water (its tip
// ahead of them and up), the line from its tip down to the bobber on the water; a bite, the bobber under; landed, the
// catch on the line's end and a splash; the line in, all of it put away.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { FishingView } from '../src/view/meshes/water/fishingLine';
import { HumanRig } from '../src/view/meshes/human/humanRig';
import { TILE_HEIGHT, WATER_LEVEL } from '../src/model/constants';
import type { GameModel } from '../src/model/GameModel';
import type { Line } from '../src/model/skills/fishing';

const SURFACE = WATER_LEVEL * TILE_HEIGHT;

// A scene, the hero's rig at the shore (0, 0) facing +x, and a line out to (3, 0).
function fishing(phase: Line['phase']) {
  const scene = new THREE.Scene();
  const rig = new HumanRig();
  scene.add(rig.root);
  for (let i = 0; i < 30; i++) rig.update(0, SURFACE, 0, 0.1, null, Math.PI / 2); // (turned to face it)
  const line: Line = { spot: { x: 3, z: 0, narrows: false, deep: true }, phase, t: 0.5, wait: 5, caught: phase === 'landed' ? 'smallFry' : undefined };
  const model = { fishing: { line }, inside: null } as unknown as GameModel;
  const view = new FishingView(scene);
  view.update(model, rig, 0.016, 1);
  const lines = scene.children.filter((c): c is THREE.Line => c instanceof THREE.Line);
  const points = lines[0].geometry.getAttribute('position') as THREE.BufferAttribute;
  const at = (i: number) => new THREE.Vector3().fromBufferAttribute(points, i);
  return { scene, rig, view, model, line, lineEl: lines[0], first: at(0), last: at(points.count - 1) };
}

describe('the hero fishing, drawn', () => {
  it('holds the rod out over the water: its tip ahead of them and up, the line down from it to the bobber', () => {
    const { first, last, lineEl } = fishing('waiting');
    expect(lineEl.visible).toBe(true);
    expect(first.x).toBeGreaterThan(0.4); // (the tip out over the water, ahead of them: +x)
    expect(first.y).toBeGreaterThan(SURFACE + 0.6); // (up, over their head's height or near it)
    expect(last.x).toBeCloseTo(3, 1); // (down to the bobber)
    expect(last.y).toBeLessThan(first.y);
  });

  it('pulls the bobber under at a bite', () => {
    const { scene } = fishing('bite');
    const bobber = scene.children.find((c) => c instanceof THREE.Mesh && c.visible && Math.abs(c.position.x - 3) < 0.01)!;
    expect(bobber.position.y).toBeLessThan(SURFACE - 0.04);
  });

  it('brings the catch up on the line, and puts it all away once the line is in', () => {
    const { scene, model, rig, view, line } = fishing('landed');
    const shown = () => scene.children.filter((c) => c.visible && !(c instanceof HumanRig) && c !== rig.root);
    expect(shown().length).toBeGreaterThanOrEqual(2); // (the line, the catch, the splash)
    (model.fishing as { line: Line | null }).line = null;
    view.update(model, rig, 0.016, 2);
    expect(line.phase).toBe('landed');
    view.update(model, rig, 1, 3); // (the splash spent)
    expect(shown()).toHaveLength(0);
  });
});
