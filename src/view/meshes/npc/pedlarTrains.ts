// Each pedlar's mule and cart on screen (model/travellers/pedlarCamp.ts), near the hero: by day the mule a pace behind
// the pedlar in their steps (the trail they've walked, so round a bend or onto another road it follows them, never
// across the fields), the cart behind it in the same steps, turned the way it's going, its wheels turning as it
// rolls; of a night, drawn up at their camp off the road, the mule tethered past it, grazing, a fire beyond them
// (kindledFire.ts' stones and logs, a camp's flames). Each eased to where it's going: nothing jumps.
import * as THREE from 'three';
import type { GameModel } from '../../../model/GameModel';
import type { Traveller } from '../../../model/travellers/travellers';
import type { Hen } from '../../../model/spells/turned';
import { greedyMesh } from '../voxel/greedyMesh';
import { Nearby } from '../common/nearby';
import { FireEffect } from '../common/fire';
import { pit } from '../camp/kindledFire';
import { DonkeyRig } from '../turned/donkeyRig';
import { CART_PALETTE, CART_SIZE, CART_VOXEL, WHEEL_AT, WHEEL_RADIUS, WHEEL_X, cartGrid, wheelGrid } from './pedlarCartVoxels';

const MULE_BACK = 0.75; // tiles behind the pedlar, in their steps, the mule walks
const CART_BACK = 1.35; // and the cart (its axle: its shafts up by the mule's flanks)
const STEP = 0.08; // tiles between the points of a trail
const EASE = 6; // how fast each eases to where it's going
const MULE_COAT = 1; // brown

interface Train {
  trail: Array<{ x: number; z: number }>; // where the pedlar's walked, the latest first
  mule: DonkeyRig;
  cart: THREE.Group;
  wheels: THREE.Mesh[];
  at: { mule: THREE.Vector3; cart: THREE.Vector3; facing: number }; // where each is drawn (eased)
  fire: { group: THREE.Group; flames: FireEffect } | null;
}

// Meshed once, shared by every cart.
let shapes: { cart: THREE.BufferGeometry; wheel: THREE.BufferGeometry; pit: THREE.BufferGeometry } | null = null;
const shapesOf = () =>
  (shapes ??= {
    cart: greedyMesh(cartGrid(), CART_PALETTE, CART_VOXEL, new THREE.Vector3((-CART_SIZE[0] / 2) * CART_VOXEL, 0, (-WHEEL_AT.z - 1) * CART_VOXEL)), // (about its axle, its middle across)
    wheel: greedyMesh(wheelGrid(), CART_PALETTE, CART_VOXEL, new THREE.Vector3(0, -(WHEEL_RADIUS + 0.5) * CART_VOXEL, -(WHEEL_RADIUS + 0.5) * CART_VOXEL)),
    pit: pit(),
  });

export class PedlarTrains {
  private readonly shown = new Nearby<Traveller, Train>(
    (t) => this.make(t),
    (train) => {
      train.mule.root.removeFromParent();
      train.cart.removeFromParent();
      if (train.fire) [train.fire.group.removeFromParent(), train.fire.flames.dispose()];
    },
  );

  constructor(
    private readonly scene: THREE.Object3D,
    private readonly material: THREE.Material,
  ) {}

  private make(t: Traveller): Train {
    const { cart: cartShape, wheel } = shapesOf();
    const cart = new THREE.Group();
    const body = new THREE.Mesh(cartShape, this.material);
    body.castShadow = true;
    cart.add(body);
    const wheels = WHEEL_X.map((x) => {
      const w = new THREE.Mesh(wheel, this.material);
      w.position.set((x - CART_SIZE[0] / 2) * CART_VOXEL, (WHEEL_AT.y + 0.5) * CART_VOXEL, 0);
      w.castShadow = true;
      cart.add(w);
      return w;
    });
    const mule = new DonkeyRig(this.material, MULE_COAT);
    for (const o of [cart, mule.root]) this.scene.add(o);
    // Seeded behind them, the way they face: a trail as though they'd come along it.
    const back = (d: number) => ({ x: t.x - Math.sin(t.facing) * d, z: t.z - Math.cos(t.facing) * d });
    const trail = Array.from({ length: Math.ceil(CART_BACK * 1.5 / STEP) }, (_, i) => back(i * STEP));
    const m = back(MULE_BACK);
    const c = back(CART_BACK);
    return { trail, mule, cart, wheels, at: { mule: new THREE.Vector3(m.x, t.y, m.z), cart: new THREE.Vector3(c.x, t.y, c.z), facing: t.facing }, fire: null };
  }

  // Each frame, outdoors: every pedlar near the hero's.
  update(model: GameModel, dt: number, time: number): void {
    const out = !model.inside;
    this.shown.update(model.travellers.list, model.hero.x, model.hero.z, (t, train) => this.step(model, t, train, dt, time), (t) => out && t.role === 'pedlar');
  }

  private step(model: GameModel, t: Traveller, train: Train, dt: number, time: number): void {
    const ground = (x: number, z: number) => model.getGroundY(x, z);
    // The trail: the pedlar's steps, as they take them (a point each STEP), as long as the cart's way behind.
    const [head] = train.trail;
    if (!head || Math.hypot(t.x - head.x, t.z - head.z) >= STEP) train.trail.unshift({ x: t.x, z: t.z });
    train.trail.length = Math.min(train.trail.length, Math.ceil((CART_BACK * 1.5) / STEP));
    const behind = (d: number) => {
      let left = d;
      for (let i = 1; i < train.trail.length; i++) {
        const [a, b] = [train.trail[i - 1], train.trail[i]];
        const seg = Math.hypot(b.x - a.x, b.z - a.z);
        if (seg >= left) return { x: a.x + ((b.x - a.x) * left) / Math.max(seg, 1e-6), z: a.z + ((b.z - a.z) * left) / Math.max(seg, 1e-6) };
        left -= seg;
      }
      return train.trail[train.trail.length - 1];
    };
    // Where each goes: camped, the camp's spots; else in the pedlar's steps.
    const camp = t.camp ?? null;
    const muleTo = camp ? camp.mule : behind(MULE_BACK);
    const cartTo = camp ? camp.cart : behind(CART_BACK);
    const ahead = camp ? null : behind(MULE_BACK);
    const facing = camp ? camp.cart.facing : Math.atan2(ahead!.x - cartTo.x, ahead!.z - cartTo.z);
    const k = Math.min(1, EASE * dt);
    const was = train.at.cart.clone();
    train.at.mule.x += (muleTo.x - train.at.mule.x) * k;
    train.at.mule.z += (muleTo.z - train.at.mule.z) * k;
    train.at.mule.y = ground(train.at.mule.x, train.at.mule.z);
    train.at.cart.x += (cartTo.x - train.at.cart.x) * k;
    train.at.cart.z += (cartTo.z - train.at.cart.z) * k;
    train.at.cart.y = ground(train.at.cart.x, train.at.cart.z);
    train.at.facing += Math.atan2(Math.sin(facing - train.at.facing), Math.cos(facing - train.at.facing)) * k;
    train.cart.position.copy(train.at.cart);
    train.cart.rotation.y = train.at.facing;
    const rolled = Math.hypot(train.at.cart.x - was.x, train.at.cart.z - was.z);
    for (const w of train.wheels) w.rotation.x += rolled / (WHEEL_RADIUS * CART_VOXEL); // (turning as it rolls)
    const muleFacing = camp ? camp.mule.facing : Math.atan2(t.x - train.at.mule.x, t.z - train.at.mule.z);
    train.mule.update({ x: train.at.mule.x, y: train.at.mule.y, z: train.at.mule.z, facing: muleFacing } as Hen, dt);
    // The fire, camped: lit, its flames going; struck at dawn.
    if (camp && !train.fire) {
      const group = new THREE.Group();
      group.add(new THREE.Mesh(shapesOf().pit, this.material));
      const flames = new FireEffect(0.2, 0.15, 0.04, t.id);
      flames.group.position.y = 0.06;
      group.add(flames.group);
      group.position.set(camp.fire.x, ground(camp.fire.x, camp.fire.z), camp.fire.z);
      this.scene.add(group);
      train.fire = { group, flames };
    } else if (!camp && train.fire) {
      [train.fire.group.removeFromParent(), train.fire.flames.dispose()];
      train.fire = null;
    }
    train.fire?.flames.update(time);
  }
}
