// Small cubes living a moment (view/meshes/common/bits.ts): pooled, each kind one instanced mesh; thrown, flying,
// falling if their kind does, sized by how far through their life, gone at its end; never more than so many of a
// kind. The smithy's sparks and steam and the cauldron's bubbles and wisps on them.
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { Bits } from '../src/view/meshes/common/bits';
import { SmithyEffects } from '../src/view/interior/smithyEffects';
import { CauldronEffects } from '../src/view/interior/cauldronEffects';

const meshes = (scene: THREE.Object3D) => scene.children.filter((c): c is THREE.InstancedMesh => c instanceof THREE.InstancedMesh);

describe('bits', () => {
  it('one instanced mesh a kind; thrown, flying, falling, sized by their life, gone at its end', () => {
    const scene = new THREE.Scene();
    const bits = new Bits(scene, 0.1, {
      spark: { material: new THREE.MeshBasicMaterial(), size: (t) => 1 - t / 2, fall: 10 },
      puff: { material: new THREE.MeshBasicMaterial(), size: () => 2 },
    });
    expect(meshes(scene)).toHaveLength(2);
    bits.add('spark', { x: 0, y: 1, z: 0 }, 1, 0, 0, 1);
    bits.add('puff', { x: 5, y: 0, z: 5 }, 0, 1, 0, 0.8);
    bits.update(0.5);
    const [spark, puff] = meshes(scene);
    expect([spark.count, puff.count]).toEqual([1, 1]);
    const at = new THREE.Matrix4();
    spark.getMatrixAt(0, at);
    const [p, q, s] = [new THREE.Vector3(), new THREE.Quaternion(), new THREE.Vector3()];
    at.decompose(p, q, s);
    expect(p.x).toBeCloseTo(0.5); // (flown)
    expect(p.y).toBeLessThan(1); // (fallen)
    expect(s.x).toBeCloseTo(0.75); // (half through its life)
    bits.update(0.5);
    expect([spark.count, puff.count, bits.count('spark'), bits.count('puff')]).toEqual([0, 0, 0, 0]); // (both lived out)
    for (let i = 0; i < 500; i++) bits.add('puff', { x: 0, y: 0, z: 0 }, 0, 0, 0, 10);
    expect(bits.count('puff')).toBeLessThanOrEqual(96);
    bits.dispose();
    expect(meshes(scene)).toHaveLength(0);
  });

  it('the smithy: sparks to a blow, steam quenching; none of either without; the cauldron bubbling', () => {
    const scene = new THREE.Scene();
    const smithy = new SmithyEffects(scene, new THREE.Vector3(1, 1, 1), new THREE.Vector3(2, 0.5, 2));
    for (let i = 0; i < 10; i++) smithy.update(1 / 60, false, false);
    expect(meshes(scene).map((m) => m.count)).toEqual([0, 0]);
    for (let i = 0; i < 10; i++) smithy.update(1 / 60, true, true);
    const [sparks, steam] = meshes(scene).map((m) => m.count);
    expect(sparks).toBeGreaterThan(0);
    expect(steam).toBeGreaterThan(0);
    smithy.dispose();
    const cauldron = new CauldronEffects(scene, new THREE.Vector3(0, 0.5, 0));
    for (let i = 0; i < 60; i++) cauldron.update(1 / 60, i / 60);
    expect(meshes(scene)[0].count).toBeGreaterThan(0);
    cauldron.dispose();
    expect(scene.children).toHaveLength(0);
  });
});
