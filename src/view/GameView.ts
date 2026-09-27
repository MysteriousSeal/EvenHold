import * as THREE from 'three';
import { GameModel, MAP_WIDTH, MAP_DEPTH, WATER_LEVEL } from '../model/GameModel';

// Fixed isometric offset: camera always sits here relative to the hero,
// and never rotates — Tunic-style pan-and-follow rather than orbit.
const CAMERA_OFFSET = new THREE.Vector3(14, 18, 14);

export interface MovementAxes {
  forward: { x: number; z: number };
  right: { x: number; z: number };
}

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly heroMesh: THREE.Group;
  private readonly movementAxes: MovementAxes;

  constructor(canvas: HTMLCanvasElement, model: GameModel) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1b1f2a);

    this.camera = this.createCamera();
    this.movementAxes = GameView.computeMovementAxes(CAMERA_OFFSET);

    this.addLights();
    this.buildTerrain(model);
    this.buildTrees(model);
    this.heroMesh = this.buildHero();
    this.scene.add(this.heroMesh);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  private createCamera(): THREE.OrthographicCamera {
    const frustumSize = 16;
    const camera = new THREE.OrthographicCamera(-frustumSize, frustumSize, frustumSize, -frustumSize, 0.1, 100);
    camera.position.copy(CAMERA_OFFSET);
    camera.lookAt(0, 0, 0);
    return camera;
  }

  // Movement axes are derived from the camera's fixed direction, flattened
  // to the XZ plane, so WASD lines up visually with the isometric view.
  private static computeMovementAxes(offset: THREE.Vector3): MovementAxes {
    const forward = new THREE.Vector2(-offset.x, -offset.z).normalize();
    const right = new THREE.Vector2(-forward.y, forward.x).normalize();
    return {
      forward: { x: forward.x, z: forward.y },
      right: { x: right.x, z: right.y },
    };
  }

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  private addLights(): void {
    // Soft sky/ground bounce plus a warm sun — a cozy, storybook palette
    // rather than flat uniform lighting.
    const hemisphere = new THREE.HemisphereLight(0xbfe3ff, 0x3a2f22, 0.7);
    this.scene.add(hemisphere);

    const sun = new THREE.DirectionalLight(0xfff1d6, 1.1);
    sun.position.set(20, 30, 10);
    this.scene.add(sun);
  }

  // Low ground is dark grass, higher tiers shift toward pale rock. A lake
  // cell isn't ground-plus-water-layer — it's a distinct water-colored block,
  // so it reads as its own voxel with visible side faces at the shoreline,
  // not a film sitting on top of grass. Every lake cell renders at a fixed
  // WATER_LEVEL height regardless of its actual bed tier (0 or 1), so the
  // lake surface stays flat — using each cell's real tier here would carve
  // a visible internal cliff between adjacent water cells of different
  // depths.
  private static readonly TERRAIN_COLORS = [0x3e8e52, 0x4caf6d, 0x6fbf7a, 0x9bd18a, 0xc9c9a8];
  private static readonly WATER_COLOR = 0x2f8fbf;

  private buildTerrain(model: GameModel): void {
    const geometryByHeight = new Map<number, THREE.BoxGeometry>();
    const materialByKey = new Map<string, THREE.MeshStandardMaterial>();

    for (let x = 0; x < MAP_WIDTH; x++) {
      for (let z = 0; z < MAP_DEPTH; z++) {
        const isLake = model.lakeMap[x][z];
        const h = isLake ? WATER_LEVEL : model.heightMap[x][z];

        let geometry = geometryByHeight.get(h);
        if (!geometry) {
          geometry = new THREE.BoxGeometry(1, h + 1, 1);
          geometryByHeight.set(h, geometry);
        }

        const key = isLake ? 'water' : `land:${h}`;
        let material = materialByKey.get(key);
        if (!material) {
          material = isLake
            ? new THREE.MeshStandardMaterial({
                color: GameView.WATER_COLOR,
                flatShading: true,
                roughness: 0.35,
                metalness: 0.1,
              })
            : new THREE.MeshStandardMaterial({ color: GameView.TERRAIN_COLORS[h % GameView.TERRAIN_COLORS.length] });
          materialByKey.set(key, material);
        }

        const cube = new THREE.Mesh(geometry, material);
        cube.position.set(x, (h + 1) / 2 - 1, z);
        this.scene.add(cube);
      }
    }
  }

  // Rounded, faceted canopy blobs stacked over a tapered trunk — closer to
  // Tunic's soft low-poly foliage than a sharp cartoon cone.
  private static readonly FOLIAGE_LAYERS = [
    { yOffset: 0.5, radius: 0.46, color: 0x2f6b3a },
    { yOffset: 0.82, radius: 0.36, color: 0x3c8049 },
    { yOffset: 1.08, radius: 0.24, color: 0x5aa15c },
  ];

  private buildTrees(model: GameModel): void {
    const count = model.trees.length;
    if (count === 0) return;

    const trunkGeometry = new THREE.CylinderGeometry(0.06, 0.12, 0.5, 6);
    const trunkMaterial = new THREE.MeshStandardMaterial({ color: 0x6b4a30, flatShading: true, roughness: 1 });
    const trunkMesh = new THREE.InstancedMesh(trunkGeometry, trunkMaterial, count);

    const foliageMeshes = GameView.FOLIAGE_LAYERS.map((layer) => {
      const geometry = new THREE.IcosahedronGeometry(1, 0);
      const material = new THREE.MeshStandardMaterial({ color: layer.color, flatShading: true, roughness: 0.9 });
      return new THREE.InstancedMesh(geometry, material, count);
    });

    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const upAxis = new THREE.Vector3(0, 1, 0);
    const position = new THREE.Vector3();
    const scaleVec = new THREE.Vector3();

    model.trees.forEach((tree, i) => {
      quaternion.setFromAxisAngle(upAxis, tree.rotationY);

      scaleVec.set(tree.scale, tree.scale, tree.scale);
      position.set(tree.x, tree.groundHeight + 0.25 * tree.scale, tree.z);
      matrix.compose(position, quaternion, scaleVec);
      trunkMesh.setMatrixAt(i, matrix);

      GameView.FOLIAGE_LAYERS.forEach((layer, layerIndex) => {
        const radius = layer.radius * tree.scale;
        scaleVec.set(radius, radius, radius);
        position.set(tree.x, tree.groundHeight + layer.yOffset * tree.scale, tree.z);
        matrix.compose(position, quaternion, scaleVec);
        foliageMeshes[layerIndex].setMatrixAt(i, matrix);
      });
    });

    this.scene.add(trunkMesh, ...foliageMeshes);
  }

  private buildHero(): THREE.Group {
    const group = new THREE.Group();

    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0xe8823c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.6, 0.35), bodyMaterial);
    body.position.y = 0.3;
    group.add(body);

    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xf5e4c8 });
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), headMaterial);
    head.position.y = 0.75;
    group.add(head);

    return group;
  }

  update(model: GameModel): void {
    const { hero } = model;
    this.heroMesh.position.set(hero.x, hero.y, hero.z);

    this.camera.position.set(hero.x + CAMERA_OFFSET.x, hero.y + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, hero.y, hero.z);
  }

  render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);

    const aspect = width / height;
    const frustumSize = 16;
    this.camera.left = (-frustumSize * aspect) / 2;
    this.camera.right = (frustumSize * aspect) / 2;
    this.camera.top = frustumSize / 2;
    this.camera.bottom = -frustumSize / 2;
    this.camera.updateProjectionMatrix();
  }
}
