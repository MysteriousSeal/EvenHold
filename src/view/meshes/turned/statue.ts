// Someone turned to stone (model/spells/turned.ts: a statue, for good): themselves as they stood, in what they wore
// (a foe: itself), every part of them the one grey stone, set on a low plinth of it. Stood where they were turned,
// never moving.
import * as THREE from 'three';
import { makeEnemy } from '../../../model/enemies/enemies';
import type { Being } from '../../../model/spells/beings';
import type { Hen, Stone } from '../../../model/spells/turned';

export const STONE = 0x8c9196;
const PLINTH = { wide: 0.3, tall: 0.07, color: 0x6c7074 };
// A colour of theirs, in stone: the one grey, lighter or darker as theirs was (so their face is still theirs, carved).
const [GREY, WEIGHTS] = [new THREE.Color(STONE), new THREE.Color(0.3, 0.59, 0.11)];
export const stoned = (color: THREE.Color, into = new THREE.Color()): THREE.Color => ((shade) => into.copy(GREY).multiplyScalar(shade))(0.42 + 0.85 * Math.min(1, color.r * WEIGHTS.r + color.g * WEIGHTS.g + color.b * WEIGHTS.b)); // (weighed first: `into` may be `color` itself)

// Whoever a statue is of, as someone to be drawn as they stood (GameView.standIn): a foe of its kind and number
// (a bandit, in its own look and what it wore), or someone in theirs.
export const beingOf = (of: Stone): Being => (of.foe ? { ...makeEnemy(of.id, of.foe, 0, 0), ...(of.human ? { human: of.human } : {}) } : ({ id: of.id, ...of.human } as Being));

// `figure` (someone as they stand, at the origin) turned to stone, on its plinth: what floats over them and the shade
// under them gone, the rest of them all one stone. `raised`: 0 on the ground still, 1 on its plinth (it rising under them).
export function stoneFigure(figure: THREE.Object3D, raised = 1): { root: THREE.Group; raise(k: number): void } {
  const [carved, plain, tint] = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), new THREE.MeshStandardMaterial({ color: STONE, roughness: 1 }), new THREE.Color()];
  figure.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if ((o as THREE.Sprite).isSprite || o.name === 'overhead') return void (o.visible = false);
    if (!mesh.isMesh || Array.isArray(mesh.material)) return;
    // (Its colours, each in stone: on a geometry of its own, theirs being shared with the living.)
    const colors = mesh.geometry.getAttribute('color');
    // (What's see-through and of no colours of its own: their shade on the ground, a glow. What's see-through in its
    // own colours is themselves, a ghost or a lynx lurking: carved, as solid as any.)
    if (mesh.material.transparent && !colors) return void (mesh.visible = false);
    if (!colors) return void (mesh.material = plain);
    mesh.geometry = mesh.geometry.clone();
    const own = mesh.geometry.getAttribute('color');
    for (let i = 0; i < own.count; i++) {
      stoned(tint.fromBufferAttribute(colors, i), tint);
      own.setXYZ(i, tint.r, tint.g, tint.b);
    }
    mesh.material = carved;
  });
  // (What hovered over the ground, a bat, a ghost: set down on its plinth, as its turning showed it: cinema/actor.ts setDown.)
  figure.updateMatrixWorld(true);
  const box = new THREE.Box3();
  figure.traverseVisible((o) => (o as THREE.Mesh).isMesh && box.expandByObject(o));
  if (!box.isEmpty() && box.min.y > 0.03) for (const part of figure.children) part.position.y -= box.min.y / (figure.scale.y || 1);
  const root = new THREE.Group();
  const plinth =new THREE.Mesh(new THREE.BoxGeometry(PLINTH.wide, PLINTH.tall, PLINTH.wide), new THREE.MeshStandardMaterial({ color: PLINTH.color, roughness: 1 }));
  root.add(figure, plinth);
  const raise = (k: number) => {
    figure.position.y = PLINTH.tall * k;
    plinth.scale.y = Math.max(1e-4, k);
    plinth.position.y = (PLINTH.tall * k) / 2;
  };
  raise(raised);
  return { root, raise };
}

export class StatueRig {
  readonly root: THREE.Group;

  constructor(figure: THREE.Object3D) {
    this.root = stoneFigure(figure).root;
  }

  update(statue: Hen, _dt: number): void {
    this.root.position.set(statue.x, statue.y, statue.z);
    this.root.rotation.y = statue.facing;
  }

  dispose(): void {
    this.root.removeFromParent();
  }
}
