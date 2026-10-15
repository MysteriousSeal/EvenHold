// @vitest-environment happy-dom
// The hero and the foes kept readable whatever the light (v0.9: a fresh hero lost ochre on ochre in the first
// morning's haze and at dusk; grey wolves lost on dark ground at night; a told move under the trees unseen).
// - The hero's own edge (view/meshes/human/heroRim.ts): by day faint, inked a little; in the low light (the first
//   morning, the golden hour, dusk) a strong pale rim and their own colours kept; the moon's blue at night; on snow
//   or rime inked, no rim of light; none indoors.
// - Foes at night (view/meshes/enemy/foeNight.ts): a moonlit edge, more in the rain; a beast's eyes aglint; none by
//   day nor down in a dungeon.
// - Under the trees: a foe winding up drawn through the crowns in its own flaring ink, and a beast's told move's
//   marks on the ground drawn through them too.
import { afterEach, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { HERO_RIM, HeroRim, heroRimAt } from '../src/view/meshes/human/heroRim';
import { FOE_NIGHT, foeNightAt } from '../src/view/meshes/enemy/foeNight';
import { EnemyViews } from '../src/view/meshes/enemy/enemyViews';
import { FOE_INK, TELL_INK } from '../src/view/meshes/human/heroSilhouette';
import { WildMovesView } from '../src/view/meshes/enemy/wildMovesView';
import { personMaterial } from '../src/view/meshes/human/humanParts';
import { sky, skyUniforms } from '../src/view/render/sky';
import { daylightAt } from '../src/model/world/weather';
import { START_MINUTES } from '../src/model/clock';
import { GameModel } from '../src/model/GameModel';
import { INDOOR_SCALE } from '../src/model/constants';
import type { WildMoves } from '../src/model/enemies/wildMoves';
import { TEST_MAP_SIZE, TEST_SEEDS } from './support/testWorld';

// No canvas in happy-dom: a 2D context that draws nothing (a foe's name, its bar), every call answered.
const nothing: unknown = new Proxy(() => nothing, { get: (_t, key) => (key === 'measureText' ? () => ({ width: 10, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 }) : nothing), set: () => true, apply: () => nothing });
HTMLCanvasElement.prototype.getContext = (() => nothing) as unknown as HTMLCanvasElement['getContext'];

const saved = { ...sky };
afterEach(() => {
  Object.assign(sky, saved);
  skyUniforms.uSnow.value = 0;
  skyUniforms.uFrost.value = 0;
});

const HOUR = 60;
const at = (minutes: number, fog = 0) => ({ ...daylightAt(minutes), fog });

// A material's fragment shader as it'd compile (its patches run over a stand-in of the standard one's end).
function compiled(material: THREE.Material): { fragmentShader: string; uniforms: Record<string, { value: unknown }> } {
  const shader = { uniforms: {}, vertexShader: '#include <project_vertex>', fragmentShader: 'void main() {\n#include <opaque_fragment>\n}' } as unknown as THREE.WebGLProgramParametersWithUniforms;
  material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
  return shader as unknown as { fragmentShader: string; uniforms: Record<string, { value: unknown }> };
}

describe("the hero's own edge", () => {
  it('in the first morning and at dusk: a strong rim and their own colours; by day faint and inked; at night the moon', () => {
    const first = heroRimAt(at(START_MINUTES, 0.19), 0, 0); // (a new game's first frame: 8:00, spring, its morning mist)
    const noon = heroRimAt(at(START_MINUTES + 4 * HOUR), 0, 0);
    const dusk = heroRimAt(at(START_MINUTES + 12 * HOUR), 0, 0); // (20:00)
    const night = heroRimAt(at(START_MINUTES + 15 * HOUR), 0, 0);
    expect(noon.strength).toBeLessThan(0.1);
    expect(noon.ink).toBeCloseTo(HERO_RIM.day.ink);
    expect(noon.own).toBe(0);
    for (const low of [first, dusk]) {
      expect(low.strength).toBeGreaterThan(noon.strength * 8);
      expect(low.own).toBeGreaterThan(HERO_RIM.low.own * 0.5);
      expect(low.ink).toBeLessThan(noon.ink);
    }
    expect(night.strength).toBeCloseTo(HERO_RIM.night.strength);
    expect(night.color.b).toBeGreaterThan(night.color.r); // (the moon's blue)
  });

  it('on snow or a rime: inked, no rim of light (it would be lost on the white)', () => {
    const morning = at(START_MINUTES, 0.19);
    const bare = heroRimAt(morning, 0, 0);
    const snowy = heroRimAt(morning, 1, 0);
    const rimed = heroRimAt(morning, 0, 0.3);
    for (const white of [snowy, rimed]) {
      expect(white.strength).toBe(0);
      expect(white.ink).toBeGreaterThan(bare.ink + 0.3);
    }
  });

  it("dresses the hero's material over people's rim, set each frame from the sky; none indoors", () => {
    const rim = new HeroRim();
    const material = rim.dress(personMaterial());
    const shader = compiled(material);
    expect(shader.fragmentShader).toMatch(/rimColor[\s\S]*edgeLit/); // (people's warm rim, then the hero's own)
    expect(material.customProgramCacheKey()).toMatch(/person-rim\|edge/);
    Object.assign(sky, { golden: 0.9, night: 0, light: 0.6, fog: 0 });
    rim.update(true);
    expect(shader.uniforms.uEdgeLight.value).toBeGreaterThan(0.6);
    rim.update(false);
    expect([shader.uniforms.uEdgeLight.value, shader.uniforms.uEdgeInk.value, shader.uniforms.uEdgeOwn.value]).toEqual([0, 0, 0]);
  });
});

describe('foes at night', () => {
  it('a moonlit edge and eyeshine at night, more in the rain; none by day', () => {
    expect(foeNightAt({ night: 0, rain: 0, light: 1 })).toEqual({ edge: 0, glint: 0 });
    const night = foeNightAt({ night: 1, rain: 0, light: 0 });
    expect(night).toEqual({ edge: FOE_NIGHT.edge, glint: FOE_NIGHT.glint });
    expect(foeNightAt({ night: 1, rain: 1, light: 0 }).edge).toBeGreaterThan(night.edge);
  });

  it("a wolf's eyes glint at night in the world, not by day, nor down in a dungeon, nor once it's dead", () => {
    const wolf = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).enemies.find((e) => e.kind === 'wolf')!;
    const glintOf = (scene: THREE.Scene) => {
      let glint: THREE.Mesh | undefined;
      scene.traverse((o) => o.name === 'glint' && (glint = o as THREE.Mesh));
      return glint!;
    };
    const shining = (glint: THREE.Mesh) => glint.visible && (glint.material as THREE.MeshBasicMaterial).visible && (glint.material as THREE.MeshBasicMaterial).opacity > 0.5;
    for (const [scale, night, state, shines] of [[1, 1, 'wander', true], [1, 0, 'wander', false], [INDOOR_SCALE, 1, 'wander', false], [1, 1, 'dead', false]] as const) {
      Object.assign(sky, { night, light: 1 - night, rain: 0 });
      const scene = new THREE.Scene();
      const views = new EnemyViews(scene, scale);
      views.update([{ ...wolf, state }], wolf.x + 2, wolf.z, 0.1);
      const glint = glintOf(scene);
      expect(glint, 'its eyes').toBeTruthy();
      expect((glint.geometry.getAttribute('position').count / 6) | 0).toBeGreaterThan(0); // (two eyes' faces, no more)
      expect(glint.geometry.getAttribute('position').count).toBeLessThan(60);
      expect(shining(glint), `${scale} ${night} ${state}`).toBe(shines);
    }
  });
});

describe('told moves under the trees', () => {
  it("a foe coming on, winding up a blow, flares through a crown in the tell's own ink", () => {
    const wolf = new GameModel(TEST_SEEDS[0], TEST_MAP_SIZE).enemies.find((e) => e.kind === 'wolf')!;
    const inks = (scene: THREE.Scene) => {
      const shown = new Set<number>();
      scene.traverse((o) => o.renderOrder === 1 && o.visible && shown.add(((o as THREE.Mesh).material as THREE.MeshBasicMaterial).color.getHex()));
      return [...shown];
    };
    for (const [swingFor, ink] of [[null, FOE_INK], [0.1, TELL_INK]] as const) {
      const scene = new THREE.Scene();
      new EnemyViews(scene).update([{ ...wolf, state: 'chase', swingFor }], wolf.x + 2, wolf.z, 0.1);
      expect(inks(scene)).toEqual([ink]);
    }
  });

  it("a bear's slam ring is drawn through what hides it too, a little fainter", () => {
    const scene = new THREE.Scene();
    const none = { moves: [] };
    const moves = { slams: { moves: [{ x: 3, z: 4, t: 0.5 }] }, charges: none, pounces: none } as unknown as WildMoves;
    new WildMovesView(scene).update(moves, () => 0, 0.1, true);
    const ring = scene.children.find((o) => o.visible) as THREE.Mesh;
    const hidden = ring.children[0] as THREE.Mesh;
    const [seen, through] = [ring.material, hidden.material] as THREE.MeshBasicMaterial[];
    expect(through.depthFunc).toBe(THREE.GreaterDepth);
    expect(hidden.renderOrder).toBe(1);
    expect(through.opacity).toBeGreaterThan(0);
    expect(through.opacity).toBeLessThan(seen.opacity);
  });
});
