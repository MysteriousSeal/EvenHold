// @vitest-environment happy-dom
// A stronghold drawn (view/stronghold/strongholdView.ts), a first pass: its
// scene built (the floor, the rock, the stairs up, a box for each thing in
// it, its lights), seeing the hero; what moves in it drawn from the model's
// run (its foes, the gate sinking as it opens, the king's chest, the postern
// lit); freed again.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { strongholdInside } from '../src/model/strongholds/strongholds';
import type { StrongholdRun } from '../src/model/strongholds/strongholdFoes';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// No canvas in happy-dom: a 2D context that draws nothing (the foes' names, their bars), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe('a stronghold', () => {
  it('is drawn, with all that\'s in it (a box each, for now), its foes, its gate shut then sunk open, the king\'s chest and the postern; freed again', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const stronghold = model.strongholds[0];
    model.teleport(stronghold.entrance.x, stronghold.entrance.z);
    model.useDoor();
    const inside = strongholdInside(model.seed, stronghold.entrance);
    const built = buildDungeonScene(model.seed, stronghold.entrance)!;
    const boxes = built.scene.children.filter((o) => o instanceof THREE.InstancedMesh && (o.geometry as THREE.BufferGeometry).type === 'BoxGeometry') as THREE.InstancedMesh[];
    expect(boxes.reduce((n, mesh) => n + mesh.count, 0)).toBe(inside.props.length - 1); // (every thing in it but the gate: that one moves)
    built.seeHero(model.hero.x, model.hero.z);
    built.update(1);
    const gate = () => built.scene.children.filter((o) => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.visible && Math.abs(o.position.z - inside.plan.gate[0].z) < 0.01 && Math.abs(o.position.x - (inside.plan.gate[0].x + 0.5)) < 0.01);
    for (let i = 0; i < 10; i++) {
      model.update(0, 0, 0.1);
      built.life.update(model, 0.1);
    }
    expect(gate()).toHaveLength(1);
    expect(gate()[0].position.y).toBeCloseTo(0, 10); // (standing on the floor)
    for (const f of [...model.foes]) [Object.assign(f, { hp: 0, state: 'dead' }), model.slayGuard(f)];
    for (let i = 0; i < 20; i++) {
      model.update(0, 0, 0.1);
      built.life.update(model, 0.1);
    }
    expect(gate()).toHaveLength(0); // (sunk into the floor)
    const run = model.dungeon as StrongholdRun;
    const chest = built.scene.children.find((o) => o instanceof THREE.Mesh && o.visible && Math.abs(o.position.x - run.chest!.x) < 0.01 && Math.abs(o.position.z - run.chest!.z) < 0.01);
    expect(chest).toBeDefined();
    expect(built.life.rumble).toBe(0);
    built.life.dispose();
    built.dispose();
  });
});
