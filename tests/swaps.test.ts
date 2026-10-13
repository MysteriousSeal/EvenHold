// @vitest-environment happy-dom
// The moon-turn charm (model/spells/swaps.ts): the sex of whoever's picked out changed: a villager or keeper, a
// traveller, a bandit; their build, a hair style of the other sex's, no beard on a woman, a new name, what they wear
// the same; a keeper called by their trade as they now are; cast again, as they were; kept in a save; never the
// hero, a beast or the dead. Its cinematic (view/cinema/swapStaging.ts): what they wear off them as vapour, their
// body changed part by part, themselves again dressed.
import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { TEST_MAP_SIZE, TEST_SEEDS, fresh } from './support/testWorld';
import { GameModel } from '../src/model/GameModel';
import { makeEnemy } from '../src/model/enemies/enemies';
import { STYLES_OF } from '../src/model/human/humanoid';
import { titleOf } from '../src/model/npcs/npcs';
import { parseSave, restore, snapshot } from '../src/model/save';
import { castSpell } from '../src/model/spells/casting';
import { SPELLS, learn } from '../src/model/spells/spells';
import { maySwap, otherLook } from '../src/model/spells/swaps';
import { BARE, SWAP_LENGTH, standing, swapStaging } from '../src/view/cinema/swapStaging';
import { GIVES_WAY, playTransformation } from '../src/view/cinema/transformCinema';

const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

describe('the moon-turn charm', () => {
  it("changes a keeper's sex: build, hair, beard, name, title; the same things worn; told, for it to be played", () => {
    const model = fresh();
    const { hero } = model;
    learn(hero, 'swap');
    expect(SPELLS.swap).toMatchObject({ aim: 'anyone', swaps: true, needsTarget: true });
    const barmaid = model.npcs.find((n) => n.role === 'barkeep')!;
    const was = { look: barmaid.look, name: barmaid.name, equipment: { ...barmaid.equipment } };
    expect(was.look.build).toBe('female');
    expect(titleOf(barmaid)).toBe(`${was.name} (Barmaid)`);
    const told: Array<{ kind: string }> = [];
    const report = model.report;
    model.report = (event) => [told.push(event), report.call(model, event)];
    Object.assign(barmaid, { where: null, x: hero.x + 1, z: hero.z });
    model.select(barmaid);
    expect(castSpell(model, 'swap')).toBe('cast');
    expect(barmaid.look.build).toBe('male');
    expect(barmaid.look).not.toBe(was.look); // (a look of their own: drawn afresh by it)
    expect(STYLES_OF.male).toContain(barmaid.look.hairStyle);
    expect([barmaid.look.skin, barmaid.look.hair]).toEqual([was.look.skin, was.look.hair]);
    expect(barmaid.name).not.toBe(was.name);
    expect(titleOf(barmaid)).toBe(`${barmaid.name} (Barman)`);
    expect(barmaid.equipment).toEqual(was.equipment);
    expect(model.npcs).toContain(barmaid); // (no one lost)
    expect(told.find((e) => e.kind === 'swapped')).toMatchObject({ who: barmaid, before: { look: was.look, name: was.name } });
    // Cast again: as she was.
    model.moves.breath = 100;
    expect(castSpell(model, 'swap')).toBe('cast');
    expect(barmaid.look).toBe(was.look);
    expect(barmaid.name).toBe(was.name);
    expect(model.swaps.has(barmaid)).toBe(false);
  });

  it('gives a woman no beard, a man one or not by who he is; the other sex, the same each time', () => {
    const man = { build: 'male' as const, skin: 1, hair: 2, dye: 0, hairStyle: 'short' as const, beard: true };
    const woman = otherLook(man, 7, 1);
    expect(woman).toMatchObject({ build: 'female', beard: false, skin: 1, hair: 2 });
    expect(STYLES_OF.female).toContain(woman.hairStyle);
    expect(otherLook(man, 7, 1)).toEqual(woman);
    const men = Array.from({ length: 40 }, (_, id) => otherLook(woman, id, 1));
    expect(men.every((look) => look.build === 'male')).toBe(true);
    expect(new Set(men.map((look) => look.beard)).size).toBe(2); // (some bearded, some not)
  });

  it('changes a traveller and a bandit; never the hero, a beast, or the dead', () => {
    const model = fresh();
    const { hero } = model;
    learn(hero, 'swap');
    model.enemies.length = 0;
    expect(castSpell(model, 'swap')).toBe('noTarget'); // (no one picked out: never themselves)
    const one = model.travellers.list[0];
    model.teleport(Math.round(one.x) + 1, Math.round(one.z));
    model.update(0, 0, 0.01);
    Object.assign(hero, { x: one.x + 0.6, z: one.z });
    const build = one.look.build;
    model.select(one);
    expect(castSpell(model, 'swap')).toBe('cast');
    expect(one.look.build).not.toBe(build);
    expect(model.travellers.list).toContain(one);
    // A bandit: his body his human one.
    const bandit = { ...makeEnemy(900, 'bandit', hero.x, hero.z + 2), hp: 500, maxHp: 500 };
    model.enemies.push(bandit);
    const his = bandit.human!.look.build;
    model.focus(bandit.id);
    model.moves.breath = 100;
    expect(castSpell(model, 'swap')).toBe('cast');
    expect(bandit.human!.look.build).not.toBe(his);
    expect(bandit.hp).toBe(500); // (no harm in it)
    // A wolf: no.
    const wolf = makeEnemy(901, 'wolf', hero.x + 1, hero.z + 1);
    model.enemies.push(wolf);
    model.focus(wolf.id);
    model.moves.breath = 100;
    expect(maySwap(wolf)).toBe(false);
    expect(castSpell(model, 'swap')).toBe('noTarget');
    expect(model.moves.breath).toBe(100);
  });

  it('is kept in a save: whoever is changed, changed still, and back to themselves at another cast', () => {
    const model = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    const smith = model.npcs.find((n) => n.role === 'smith')!;
    const was = { build: smith.look.build, name: smith.name };
    expect(model.swaps.swap(smith)).toBe(true);
    const now = { build: smith.look.build, name: smith.name, hairStyle: smith.look.hairStyle };
    const again = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE);
    restore(again, parseSave(JSON.stringify(snapshot(model)), model.seed)!);
    const theirs = again.npcs.find((n) => n.id === smith.id)!;
    expect({ build: theirs.look.build, name: theirs.name, hairStyle: theirs.look.hairStyle }).toEqual(now);
    expect(again.swaps.swap(theirs)).toBe(true);
    expect({ build: theirs.look.build, name: theirs.name }).toEqual(was);
    again.swaps.load(['x:1', 3, 'n:notanumber']); // (a broken save: none of it)
    expect(again.swaps.save()).toEqual([]);
  });
});

describe('its cinematic', () => {
  const drawer = () => ({ render: vi.fn(), setSize: vi.fn(), setPixelRatio: vi.fn(), dispose: vi.fn(), domElement: document.createElement('canvas') });
  const before = { look: { build: 'male' as const, skin: 1, hair: 2, dye: 0, hairStyle: 'short' as const, beard: true }, equipment: { head: 'huntersHood' as const, torso: 'linenShirt' as const } };
  const after = { look: otherLook(before.look, 7, 1), equipment: before.equipment };

  it('has what they wear come off them piece by piece, then their body change a part at a time, their face seen close, then themselves dressed again', () => {
    document.body.replaceChildren();
    const figure = standing(before, true).root;
    const done = vi.fn();
    const staging = swapStaging(before, after, 'Adawen');
    const playing = playTransformation(figure, 'Idtram', staging, done, drawer);
    const line = () => playing.root.querySelector('.transform-line')!.textContent!;
    const staged = SWAP_LENGTH * GIVES_WAY; // seconds till they give way
    const to = (u: number, from: number) => playing.advance((u - from) * staged);
    expect(staging.length).toBe(SWAP_LENGTH); // (longer than a turning into a beast)
    to(0.01, 0);
    expect(figure.visible).toBe(true); // (dressed, as they stand)
    expect(line()).toContain('Idtram');
    to(0.15, 0.01);
    expect(figure.visible).toBe(false); // (what they wear: off them)
    expect(line()).toMatch(/piece by piece/);
    const said: string[] = [];
    for (let u = 0.15; u < 0.98; u += 0.01) [to(u + 0.01, u), said.includes(line()) || said.push(line())];
    expect(said.map((text) => text.split(/[ .:;,]/).slice(0, 2).join(' '))).toEqual(['What they', 'Idtram looks', 'The hips', 'The waist', 'The shoulders', 'The chest', 'Arms and', 'The jaw', 'The beard']); // (each step its own beat)
    playing.advance(0.05 * staged);
    expect(line()).toBe('Adawen.');
    for (let t = 0; t < SWAP_LENGTH; t += 0.1) playing.advance(0.1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it('takes what is on their head off first and their braies last, and sees their face from close', () => {
    const scene = new THREE.Scene();
    const figure = standing(before, true).root;
    scene.add(figure);
    const staged = swapStaging(before, after, 'Adawen').direct!(figure, scene, 0.5);
    const vapour = scene.children.find((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    const size = (i: number) => new THREE.Vector3().setFromMatrixScale(new THREE.Matrix4().fromArray(vapour.instanceMatrix.array, i * 16)).x;
    staged.update(BARE[0] + (BARE[1] - BARE[0]) * 0.3, 1);
    expect(size(0)).toBeLessThan(size(vapour.count - 1) * 0.5); // (their hood: going; their braies: on them still)
    const [whole, close] = [staged.view!(0.1, 0), staged.view!(0.9, 0)];
    expect(close.far).toBeLessThan(whole.far * 0.6);
    expect(close.aim).toBeGreaterThan(whole.aim); // (their head)
    expect(staged.view!(1, 1).far).toBeGreaterThan(close.far * 1.5); // (themselves again: whole)
    staged.dispose();
  });

  it('reads what they wear off them as what is not their body: none of it for someone unclothed', () => {
    const scene = new THREE.Scene();
    const dressed = standing(before, true).root;
    scene.add(dressed);
    const worn = swapStaging(before, after, 'Adawen').direct!(dressed, scene, 0.5);
    const vapour = scene.children.find((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(vapour.count).toBeGreaterThan(20); // (a hood and a shirt's worth)
    worn.update(0.2, 0);
    worn.update(0.6, 1);
    worn.dispose();
    const bare = { look: before.look, equipment: {} };
    const scene2 = new THREE.Scene();
    const figure = standing(bare, true).root;
    scene2.add(figure);
    swapStaging(bare, { look: after.look, equipment: {} }, 'Adawen').direct!(figure, scene2, 0.5);
    const none = scene2.children.find((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh;
    expect(none.count).toBeLessThan(vapour.count / 2); // (their braies alone)
    // (Someone with nothing on at all: no vapour drawn, not a cube of it.)
    const nude = { look: { ...before.look, unclothed: true }, equipment: {} };
    const scene3 = new THREE.Scene();
    swapStaging(nude, { look: { ...after.look, unclothed: true }, equipment: {} }, 'Adawen').direct!(standing(nude, true).root, scene3, 0.5).update(0.2, 0);
    expect((scene3.children.find((o) => (o as THREE.InstancedMesh).isInstancedMesh) as THREE.InstancedMesh).count).toBe(0);
  });
});
