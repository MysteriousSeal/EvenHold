// @vitest-environment happy-dom
// A transformation played full screen (view/cinema/): the one turned staged part by part (a human's legs, arms,
// body and head in turn, things grown on them; anything else as one part pulled to the new shape), giving way to
// what they've become, which settles; a line for each beat; over after its length, or at any key; the game's to
// stand still meanwhile (told 'transformed' by the model as the spell's cast).
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { fresh } from './support/testWorld';
import { makeActor } from '../src/view/cinema/actor';
import { HEN, chickenStaging } from '../src/view/cinema/chickenStaging';
import { STAGINGS } from '../src/view/cinema/staging';
import { GIVES_WAY, LENGTH, playTransformation } from '../src/view/cinema/transformCinema';
import { HumanRig } from '../src/view/meshes/human/humanRig';

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
  it('goes legs first, then arms, body and head, each in its turn; then down to her size', () => {
    const actor = makeActor(human());
    const made = chickenStaging.prepare(actor);
    const { joints, hips, body } = actor.human!;
    const at = (u: number) => chickenStaging.stage(actor, made, u, 0.37);
    at(0.05);
    expect(joints.leftLeg.scale.x).toBeCloseTo(1, 5);
    // The legs: thinner and shorter, the body sunk onto them; nothing else yet.
    at(0.3);
    expect(joints.leftLeg.scale.x).toBeLessThan(0.5);
    expect(joints.leftLeg.scale.y).toBeLessThan(0.6);
    expect(body.position.y).toBeLessThan(0);
    expect(joints.leftArm.rotation.x).toBeCloseTo(0, 5);
    expect(hips.rotation.x).toBe(0);
    // The arms: swung back, flattened; the body still upright.
    at(0.48);
    expect(joints.leftArm.rotation.x).toBeGreaterThan(0.9);
    expect(joints.leftArm.scale.z).toBeGreaterThan(1.5);
    expect(hips.rotation.x).toBe(0);
    // The body: tipped forward, the head held up against it.
    at(0.68);
    expect(hips.rotation.x).toBeGreaterThan(1);
    expect(joints.head.rotation.x).toBeLessThan(-0.9);
    expect(joints.head.scale.x).toBeGreaterThan(0.95);
    // The head: smaller.
    at(0.85);
    expect(joints.head.scale.x).toBeLessThan(0.75);
    expect(actor.root.scale.x).toBeCloseTo(1, 5);
    // And all of it down toward a hen's size.
    at(1);
    expect(actor.root.scale.x * actor.size.y).toBeLessThan(HEN.y * 1.5);
  });

  it('grows a tail, a comb, a beak and a wattle on them, each out of nothing in its turn', () => {
    const actor = makeActor(human());
    const made = chickenStaging.prepare(actor) as { comb: THREE.Mesh[]; beak: THREE.Mesh; wattle: THREE.Mesh; tail: THREE.Mesh[] };
    const full = (mesh: THREE.Mesh) => mesh.scale.x / (mesh.userData.full as THREE.Vector3).x;
    chickenStaging.stage(actor, made, 0.4, 0);
    for (const part of [...made.comb, made.beak, made.wattle, ...made.tail]) expect(full(part)).toBeLessThan(0.01);
    chickenStaging.stage(actor, made, 0.72, 0);
    expect(full(made.tail[0])).toBeGreaterThan(0.9); // (the tail: out)
    expect(full(made.beak)).toBeLessThan(0.01); // (the beak: not yet)
    chickenStaging.stage(actor, made, 0.9, 0);
    for (const part of [...made.comb, made.beak, made.wattle, ...made.tail]) expect(full(part)).toBeCloseTo(1, 5);
    // On the head: the comb over it, the beak before it.
    expect(made.comb[0].parent).toBe(actor.human!.joints.head);
    expect(made.tail[0].parent).toBe(actor.human!.joints.torso);
  });

  it('tints each part its own way: the legs toward yellow, the rest toward white, no other part touched', () => {
    const actor = makeActor(human());
    const { joints } = actor.human!;
    const colour = (group: THREE.Object3D) => {
      let found: THREE.MeshStandardMaterial | null = null;
      group.traverse((o) => (found ??= (o as THREE.Mesh).isMesh ? ((o as THREE.Mesh).material as THREE.MeshStandardMaterial) : null));
      return found!;
    };
    const made = chickenStaging.prepare(actor);
    chickenStaging.stage(actor, made, 0.3, 0);
    const [leg, head] = [colour(joints.leftLeg), colour(joints.head)];
    expect(leg).not.toBe(head); // (a material each)
    expect(leg.emissive.r).toBeGreaterThan(leg.emissive.b + 0.2); // (yellow)
    expect(head.emissive.getHex()).toBe(0);
  });
});

describe('anything else turned into a chicken', () => {
  it('is one part: what is over its head hidden, its shape pulled to hers, then down to her size', () => {
    const actor = makeActor(beast());
    expect(actor.human).toBeNull();
    expect(actor.size.y).toBeCloseTo(0.25, 5); // (the label over it: not counted, nor shown)
    const made = chickenStaging.prepare(actor);
    chickenStaging.stage(actor, made, 0.6, 0);
    const s = actor.root.scale;
    expect(s.z / s.y).toBeLessThan(1); // (long and low, pulled shorter and taller: a hen's shape)
    chickenStaging.stage(actor, made, 1, 0);
    expect(actor.root.scale.y * actor.size.y).toBeLessThan(HEN.y * 1.2);
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
    for (let t = 0.1; t < LENGTH * GIVES_WAY - 0.2; t += 0.1) [playing.advance(0.1), said.add(playing.root.querySelector('.transform-line')!.textContent!)];
    expect(said.size).toBe(STAGINGS.chicken.lines.length); // (each beat, said)
    expect(figure.visible).toBe(true);
    for (let t = 0; t < 0.5; t += 0.1) playing.advance(0.1);
    expect(figure.visible).toBe(false); // (given way)
    expect(playing.root.querySelector('.transform-line')!.textContent).toBe('A chicken.');
    expect(done).not.toHaveBeenCalled();
    for (let t = 0; t < LENGTH; t += 0.1) playing.advance(0.1);
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
    expect(model.chickens.turn(one, 30)).toBe(true);
    expect(told.find((e) => e.kind === 'transformed')).toMatchObject({ who: one, into: 'chicken' });
  });
});
