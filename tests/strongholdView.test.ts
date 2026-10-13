// @vitest-environment happy-dom
// A stronghold drawn (view/stronghold/strongholdView.ts) in its own look: its scene built (earth and plank floors,
// timber walls, the stairs up, each thing in it its own model, its lights), seeing the hero; what moves in it drawn
// from the model's run (its foes, the gate shut then thrown open, the king's chest, the postern lit); freed again.
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { GameModel } from '../src/model/GameModel';
import { strongholdInside } from '../src/model/strongholds/strongholds';
import type { StrongholdRun } from '../src/model/strongholds/strongholdFoes';
import { buildDungeonScene } from '../src/view/dungeon/dungeonViews';
import { STRONGHOLD_PROPS } from '../src/view/stronghold/strongholdPropVoxels';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// No canvas in happy-dom: a 2D context that draws nothing (the foes' names, their bars), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe('a stronghold', () => {
  it("is drawn, with all that's in it (each its own model), its foes, its gate shut then thrown open, the king's chest and the postern; freed again", () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const stronghold = model.strongholds[0];
    model.teleport(stronghold.entrance.x, stronghold.entrance.z);
    model.useDoor();
    const inside = strongholdInside(model.seed, stronghold.entrance);
    const built = buildDungeonScene(model.seed, stronghold.entrance)!;
    // Every thing in it but the gate (that one opens: its own), set down once each among the scene's instanced pieces.
    const set = built.scene.children.filter((o) => o instanceof THREE.InstancedMesh).reduce((n, mesh) => n + (mesh as THREE.InstancedMesh).count, 0);
    expect(set).toBeGreaterThan(inside.props.length - 1); // (and its floor and walls besides)
    for (const p of inside.props) expect(STRONGHOLD_PROPS[p.kind], p.kind).toBeDefined(); // (a model for every kind that stands in it)
    built.seeHero(model.hero.x, model.hero.z);
    built.update(1);
    const across = inside.props.find((p) => p.kind === 'gate')!;
    const [gx, gz] = [across.x + (across.w - 1) / 2, across.z + (across.d - 1) / 2];
    const gate = () => built.scene.children.filter((o) => o instanceof THREE.Mesh && !(o instanceof THREE.InstancedMesh) && o.visible && Math.abs(o.position.x - gx) < 0.01 && Math.abs(o.position.z - gz) < 0.01);
    for (let i = 0; i < 10; i++) {
      model.update(0, 0, 0.1);
      built.life.update(model, 0.1);
    }
    const shut = gate();
    expect(shut).toHaveLength(1); // (shut across its way)
    for (const f of [...model.foes]) [Object.assign(f, { hp: 0, state: 'dead' }), model.slayGuard(f)];
    for (let i = 0; i < 20; i++) {
      model.update(0, 0, 0.1);
      built.life.update(model, 0.1);
    }
    expect(gate()).toHaveLength(1);
    expect(gate()[0]).not.toBe(shut[0]); // (thrown open: its other form)
    const run = model.dungeon as StrongholdRun;
    const chest = built.scene.children.find((o) => o instanceof THREE.Mesh && o.visible && Math.abs(o.position.x - run.chest!.x) < 0.01 && Math.abs(o.position.z - run.chest!.z) < 0.01);
    expect(chest).toBeDefined();
    expect(built.life.rumble).toBe(0);
    built.life.dispose();
    built.dispose();
  });
});
