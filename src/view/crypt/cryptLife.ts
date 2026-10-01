// What moves in a crypt's scene, besides the hero (cryptView.ts the rest):
// its guards and lord (the enemies' own views, drawn as big as the hero is in
// a room), the arrows its bowmen loose, flying; the draugr's frost
// (frostBreathView.ts) and the strip their cleave falls along; the lord's
// told moves and souls (lordMovesView.ts), his tomb whole or burst, his chest;
// and what the slain leave on its floor.

import * as THREE from 'three';
import type { CryptInside } from '../../model/crypts/crypts';
import type { CryptFoes } from '../../model/crypts/cryptFoes';
import { floorHeight } from '../../model/crypts/cryptProps';
import { greedyMesh } from '../meshes/voxel/greedyMesh';
import { BURST, CRYPT_PALETTE, CRYPT_VOXEL, GLOW, cryptProp } from './cryptVoxels';
import { glowMaterial } from '../meshes/common/glow';
import { INDOOR_SCALE } from '../../model/constants';
import type { GameModel } from '../../model/GameModel';
import { EnemyViews } from '../meshes/enemy/enemyViews';
import { arrowGeometry } from '../meshes/enemy/undeadRig';
import { LootViews } from '../meshes/loot/lootViews';
import { CoinViews } from '../meshes/loot/coinViews';
import { personMaterial } from '../meshes/human/humanParts';
import { LordMovesView } from './lordMovesView';
import { FrostBreathView } from './frostBreathView';
import { ImpactView } from './impactView';
import { CLEAVE_HALF, CLEAVE_LENGTH, CLEAVE_TELL } from '../../model/crypts/cleave';
import { CHEST_HINGE, chestBoxGeometry, chestLidGeometry } from './chestVoxels';

// Whether a crypt's great tomb is burst: its lord's risen from it (or been slain, and gone).
export const tombBurst = (crypt: CryptFoes | null): boolean => !!crypt && (crypt.lord !== null || crypt.chest !== null);

const ARROW_HEIGHT = 0.3 * INDOOR_SCALE; // about a bowman's chest
const AXE_REACH = 1.45; // tiles before a draugr its axe's head strikes the floor, cleaving (skeletonRig.ts: its swing)

export class CryptLife {
  private readonly enemies: EnemyViews;
  private readonly loot: LootViews;
  private readonly coins: CoinViews;
  private readonly arrowGeometry = arrowGeometry();
  private readonly arrowMaterial = personMaterial();
  private readonly arrows: THREE.Mesh[] = []; // a pool, as many shown as fly
  private readonly lordMoves: LordMovesView; // the lord's told moves on the floor, his souls

  // How hard the floor's rumbling (0..1: the lord's bones coming): the camera's to shake by.
  get rumble(): number {
    return this.lordMoves.rumble;
  }
  private chest: { box: THREE.Mesh; lid: THREE.Mesh } | null = null;
  private readonly frost: FrostBreathView; // the draugr's breath
  private readonly strip = new THREE.PlaneGeometry(CLEAVE_LENGTH, CLEAVE_HALF * 2).rotateX(-Math.PI / 2).translate(CLEAVE_LENGTH / 2, 0, 0); // a cleave's (along +X from its foot)
  private readonly strips: THREE.Mesh[] = []; // a pool, one to a cleave
  private readonly impacts: ImpactView; // where a cleave comes down: chips, dust
  private readonly landed = new WeakSet<object>(); // the cleaves already come down

  private tomb: { burst: boolean; meshes: THREE.Mesh[] } | null = null; // the great tomb, whole or burst
  private readonly tombMaterials = [new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })]; // (its stone lit, its flames aglow)

  constructor(
    private readonly scene: THREE.Scene,
    private readonly inside: CryptInside,
  ) {
    this.enemies = new EnemyViews(scene, INDOOR_SCALE);
    this.loot = new LootViews(scene, INDOOR_SCALE);
    this.coins = new CoinViews(scene, INDOOR_SCALE);
    this.frost = new FrostBreathView(scene);
    this.impacts = new ImpactView(scene);
    this.lordMoves = new LordMovesView(scene, this.impacts);
  }

  update(model: GameModel, dt: number): void {
    const { hero } = model;
    const crypt = model.crypt;
    this.enemies.update(model.foes, hero.x, hero.z, dt, model.focused?.id ?? null);
    this.loot.update(model.groundHere.loot, hero.x, hero.z, dt);
    this.coins.update(model.groundHere.coins, hero.x, hero.z, dt);
    // The great tomb: whole till its lord's risen (or slain, and gone), burst after.
    this.showTomb(tombBurst(crypt));
    this.lordMoves.update(crypt, dt); // the lord's slam and specials, his souls
    this.frost.update(crypt?.frost.moves ?? [], dt); // the draugr's frost breath
    // The draugr's cleaves: a red strip where the axe will fall, brightening; a flash as it comes down, fading.
    const cleaves = crypt?.cleaves.moves ?? [];
    while (this.strips.length < cleaves.length) {
      const strip = new THREE.Mesh(this.strip, glowMaterial(0xff3020));
      this.scene.add(strip);
      this.strips.push(strip);
    }
    this.strips.forEach((strip, i) => {
      const cleave = cleaves[i];
      strip.visible = !!cleave;
      if (!cleave) return;
      strip.position.set(cleave.x, 0.013, cleave.z);
      strip.rotation.y = Math.atan2(-cleave.dz, cleave.dx);
      const material = strip.material as THREE.MeshBasicMaterial;
      const down = cleave.t - CLEAVE_TELL;
      if (down >= 0.06 && !this.landed.has(cleave)) {
        this.landed.add(cleave); // (where the axe's head strikes the floor: a tile and a half on along the strip)
        this.impacts.hit(cleave.x + cleave.dx * AXE_REACH, cleave.z + cleave.dz * AXE_REACH, cleave.dx, cleave.dz);
      }
      material.color.setHex(down < 0 ? 0xff3020 : 0xffd8c0);
      material.opacity = down < 0 ? 0.12 + 0.4 * (cleave.t / CLEAVE_TELL) : 0.9 * Math.max(0, 1 - down / 0.35);
    });
    this.impacts.update(dt);
    // His chest, once he's slain: shut, or its lid swung back.
    const chest = crypt?.chest ?? null;
    if (chest && !this.chest) {
      const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 });
      this.chest = { box: new THREE.Mesh(chestBoxGeometry(), material), lid: new THREE.Mesh(chestLidGeometry(), material) };
      this.chest.lid.position.set(0, CHEST_HINGE.y, CHEST_HINGE.z);
      this.chest.box.add(this.chest.lid);
      this.chest.box.position.set(chest.x, floorHeight(this.inside.props, chest.x, chest.z), chest.z); // (up on the dais, where he rose)
      this.scene.add(this.chest.box);
    }
    if (chest && this.chest) this.chest.lid.rotation.x = chest.open ? -1.9 : 0;
    const flying = crypt?.arrows ?? [];
    while (this.arrows.length < flying.length) {
      const arrow = new THREE.Mesh(this.arrowGeometry, this.arrowMaterial);
      arrow.scale.setScalar(INDOOR_SCALE);
      this.scene.add(arrow);
      this.arrows.push(arrow);
    }
    this.arrows.forEach((mesh, i) => {
      const arrow = flying[i];
      mesh.visible = !!arrow;
      if (!arrow) return;
      mesh.position.set(arrow.x, ARROW_HEIGHT, arrow.z);
      mesh.rotation.set(0, Math.atan2(arrow.dx, arrow.dz), 0); // (pointing the way it flies)
    });
  }

  // The great tomb, drawn whole or burst (afresh as it changes): centred on its tiles as any prop.
  private showTomb(burst: boolean): void {
    if (this.tomb?.burst === burst) return;
    for (const mesh of this.tomb?.meshes ?? []) {
      mesh.removeFromParent();
      mesh.geometry.dispose();
    }
    const prop = this.inside.props.find((p) => p.kind === 'greatSarcophagus');
    if (!prop) return void (this.tomb = { burst, meshes: [] });
    const grid = cryptProp('greatSarcophagus', burst ? BURST : 0);
    const [sx, , sz] = grid.size;
    const origin = new THREE.Vector3((-sx / 2) * CRYPT_VOXEL, 0, (-sz / 2) * CRYPT_VOXEL);
    const meshes = this.tombMaterials.map((material, glow) => {
      const mesh = new THREE.Mesh(greedyMesh(grid, CRYPT_PALETTE, CRYPT_VOXEL, origin, (c) => GLOW.has(c) === (glow === 1)), material);
      mesh.position.set(prop.x + (prop.w - 1) / 2, 0, prop.z + (prop.d - 1) / 2);
      this.scene.add(mesh);
      return mesh;
    });
    this.tomb = { burst, meshes };
  }

  dispose(): void {
    for (const mesh of this.tomb?.meshes ?? []) mesh.geometry.dispose();
    for (const material of this.tombMaterials) material.dispose();
    for (const arrow of this.arrows) arrow.removeFromParent();
    this.frost.dispose();
    this.impacts.dispose();
    for (const strip of this.strips) (strip.material as THREE.Material).dispose();
    this.strip.dispose();
    this.lordMoves.dispose();
    this.arrowGeometry.dispose();
    this.arrowMaterial.dispose();
  }
}
