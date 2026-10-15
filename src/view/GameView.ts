// View: owns Three.js scene/camera/renderer. No game rules, no input
// handling. Mesh construction is delegated to meshes/; this class wires
// them together and drives the per-frame render.

import { isFoe, type Being } from '../model/spells/beings';
import { isProvision } from '../model/loot/provisions';
import * as THREE from 'three';
import type { GameModel } from '../model/GameModel';
import type { Enemy } from '../model/types';
import { CAMERA_OFFSET, CAMERA_Y_SMOOTHING, INDOOR_ZOOM } from './constants';
import type { Drink, Npc } from '../model/npcs/npcs';
import { INDOOR_SCALE } from '../model/constants';
import { createCamera, computeMovementAxes, resizeCamera, roomAim } from './render/camera';
import type { MovementAxes } from './render/camera';
import { addLights } from './render/lighting';
import { SkyView } from './render/skyView';
import { setWindPusher } from './meshes/common/wind';
import { HumanRig } from './meshes/human/humanRig';
import { personMaterial } from './meshes/human/humanParts';
import { stylize, type Stylizer } from './render/stylize';
import { PostProcessing } from './render/postprocessing';
import type { RenderOptions } from './render/renderOptions';
import { graphics, onGraphics, preset } from './render/graphics';
import { ChunkStreamer } from './world/chunkStreamer';
import { WORLD_BUILDERS, type WorldBuilder } from './world/worldBuilders';
import { WorldRegions } from './world/worldRegions';
import { EnemyViews, focusMarker } from './meshes/enemy/enemyViews';
import { TurnedViews } from './meshes/turned/turnedViews';
import { SmokePuffs } from './meshes/common/smokePuffs';
import { setBarHeroLevel } from './meshes/enemy/enemyParts';
import { WildlifeViews } from './meshes/wildlife/wildlifeViews';
import { NpcViews } from './meshes/npc/npcViews';
import { WorkMarks } from './meshes/inn/workMarks';
import { Cupboard } from './interior/cupboard';
import { IndoorScenes } from './interior/indoorScenes';
import { warmUpAll, warmUpLate } from './render/warmUp';
import { pickNearest, toScreen } from './render/screenPick';
import { BedrollView } from './meshes/scenery/bedrollMesh';
import { FishingView } from './meshes/water/fishingLine';
import { PickInHand } from './meshes/mining/pickInHand';
import { HammerInHand } from './meshes/smithing/hammerInHand';
import { workCostume, workLook } from './meshes/human/gear/costumes';
import { CoinViews } from './meshes/loot/coinViews';
import { PurseView } from './meshes/loot/purseView';
import { zoomLevel } from './render/zoom';
import { LootViews } from './meshes/loot/lootViews';
import { CampFires } from './meshes/camp/campFires';
import { KindledFire } from './meshes/camp/kindledFire';
import { HerbPatches } from './meshes/herbs/herbPatches';
import { CampChests } from './meshes/camp/campChests';
import { BoardMarks } from './meshes/quest/questMarks';
import { RuinMist } from './meshes/ruin/ruinMist';
import { TravellerViews } from './meshes/npc/travellerViews';
import { CarterView } from './meshes/npc/carterView';
import { AmbientLife } from './meshes/wildlife/ambientLife';
import { EntranceLife } from './meshes/entrance/entranceLife';
import { WildMovesView } from './meshes/enemy/wildMovesView';
import { travellerInReach } from '../model/travellers/travellerTalk';
import { armsSheathed } from '../model/interiors/indoors';
import { FrostOnHero } from './meshes/human/frostOnHero';
import { HeroSilhouette } from './meshes/human/heroSilhouette';
import { HeroBeacon } from './meshes/human/heroBeacon';
import type { BodyLook } from '../model/human/humanoid';
import type { GameEvent } from '../model/types';
import { BloodBursts } from './meshes/common/bloodBursts';
import { CameraKick } from './render/cameraKick';

// One named chunk of world building, run by the loader between repaints.
export interface BuildStep {
  label: string;
  run: () => void;
}

export interface RenderStats {
  drawCalls: number;
  triangles: number;
  pixelRatio: number;
}

export class GameView {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private hero: HumanRig; // dressed from the model's equipment every frame (rebuilt if their look changes)
  private eaten = false; // the hero eating from their bag, last frame
  private readonly heroLook = personMaterial();
  // A red glow while the hero's just been hit, like the enemies' flash.
  private readonly heroFlash = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, emissive: 0xff2a1a, emissiveIntensity: 0.9 });
  // Chilled (a draugr's frost): an icy sheen over all of them, pale blue and a little aglow; and frost drifting round them.
  private readonly heroFrost = new THREE.MeshStandardMaterial({ vertexColors: true, color: 0xb8e2ff, roughness: 0.35, emissive: 0x2a6a90, emissiveIntensity: 0.45 });
  private readonly frost = new FrostOnHero();
  private readonly silhouette = new HeroSilhouette(); // (outdoors: their shape through a tree's crown, a roof)
  private readonly beacon = new HeroBeacon(); // (brackets at their feet, the game's first seconds)
  private readonly world: ChunkStreamer;
  private readonly regions: WorldRegions | null; // a streamed world's, drawn region by region as they're made
  private readonly enemies: EnemyViews;
  private readonly wildlife: WildlifeViews;
  private readonly npcs = new NpcViews();
  private readonly workMarks = new WorkMarks(); // (at work: over the patrons, the counter's end)
  private readonly cupboard = new Cupboard(); // (an inn's tankards, sold her, on her shelves)
  private readonly indoors = new IndoorScenes(); // (the room the hero's in, a dungeon's floor, the furniture yard: interior/indoorScenes.ts)
  private herbPatches: HerbPatches | null = null; // (the herbs up round the hero this season, to pick)
  private bedroll: BedrollView | null = null; // (the hero's, under them as they lie outdoors)
  private fishing: FishingView | null = null; // (the hero's rod, line and bobber, a line out)
  private readonly pickInHand = new PickInHand(); // (the hero's pickaxe, in hand while they mine)
  private readonly hammerInHand = new HammerInHand(); // (and a smith's hammer, at the anvil or the salvage bench)
  private readonly travellers: TravellerViews; // on the roads
  private readonly chickens = new TurnedViews((being) => this.standIn(being)); // the beasts people have been turned into (spells/turned.ts)
  private readonly smoke = new SmokePuffs();
  private readonly blood = new BloodBursts(); // (where blows land)
  private readonly kick = new CameraKick(); // (and the camera, kicked by them)
  private readonly kicked = new THREE.Vector3();
  private readonly personMark = focusMarker(); // round whoever's picked out (no foe)
  private peopleIn: THREE.Object3D = new THREE.Object3D(); // where people are drawn now: the scene, or the room
  private carter: CarterView | null = null; // (the man by his wagon, at the start)
  private purse: PurseView | null = null; // (the hero's purse where they last fell: hero/purse.ts)
  private readonly ambient: AmbientLife; // butterflies, songbirds, fireflies round the hero
  private readonly entrances: EntranceLife;
  private readonly wildMoves: WildMovesView; // a bear's slam and charge, a lynx's pounce, told on the ground // what marks the dungeons' ways in near the hero: bats, crows, wisps, glows, fires
  private readonly coins: CoinViews;
  private readonly loot: LootViews;
  private readonly campFires: CampFires;
  private readonly kindledFire: KindledFire; // (the hero's own campfire, to cook over)
  private readonly campChests: CampChests; // (each camp's chest, shut or thrown open)
  private readonly boardMarks: BoardMarks;
  private readonly mist: RuinMist; // low mist in the old ruins
  private readonly sky: SkyView; // the hour's light, the weather, the season
  private readonly movementAxes: MovementAxes;
  private stylizer: Stylizer | null = null;
  private post: PostProcessing | null = null;
  private pixelRatio: number; // the URL's (renderOptions.ts), by the quality's (render/graphics.ts)
  // Per-frame animations (e.g. grass swaying in the wind), fed the time since start.
  private readonly animations: Array<(elapsedSeconds: number) => void> = [];
  private elapsed = 0;
  private cameraY: number;

  // Sets up the renderer and an empty scene; the world is added by running
  // buildSteps() and then finish(), which the loader spreads across frames
  // so the page stays responsive and can show progress.
  constructor(
    canvas: HTMLCanvasElement,
    private readonly model: GameModel,
    private readonly options: RenderOptions,
  ) {
    this.cameraY = model.hero.y;

    // With post-processing, the scene renders into the composer's
    // multisampled target, so canvas antialiasing would be wasted.
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: !options.post });
    // Stats cover the whole frame (scene plus every post pass), so they're
    // reset once per frame in render() rather than per draw.
    this.renderer.info.autoReset = false;
    // Only the firelight indoors casts shadows (roomView.ts); nothing outdoors does.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.pixelRatio = options.pixelRatio * preset().pixelScale;

    this.scene = new THREE.Scene();
    this.camera = createCamera();
    this.movementAxes = computeMovementAxes();

    this.sky = new SkyView(this.scene, addLights(this.scene), this.camera, this.pixelRatio, options.sky);
    this.hero = new HumanRig(model.hero.look, this.heroLook);
    this.scene.add(this.hero.root);
    this.world = new ChunkStreamer(this.scene);
    this.regions = model.world.streamed ? new WorldRegions(this.world, model, (materials) => this.prepare(materials)) : null;
    this.enemies = new EnemyViews(this.scene);
    this.wildlife = new WildlifeViews(this.scene);
    this.coins = new CoinViews(this.scene);
    this.loot = new LootViews(this.scene);
    this.campFires = new CampFires(this.scene);
    this.kindledFire = new KindledFire(this.scene);
    this.campChests = new CampChests(this.scene);
    this.boardMarks = new BoardMarks(this.scene, model);
    this.travellers = new TravellerViews(this.scene);
    this.ambient = new AmbientLife(this.scene, model);
    this.entrances = new EntranceLife(this.scene, model);
    this.wildMoves = new WildMovesView(this.scene);
    this.mist = new RuinMist(this.scene, model.ruins, (x, z) => model.getGroundY(x, z));
    this.applyGraphics();
    onGraphics(() => this.applyGraphics());
  }

  // The graphics settings (render/graphics.ts) as they are now: the resolution, the passes, how far round the land's
  // built, the brightness. (The shadows indoors: the room made again, interior/indoorScenes.ts.)
  private applyGraphics(): void {
    const [p, { options, renderer }] = [preset(), this];
    this.pixelRatio = options.pixelRatio * p.pixelScale;
    renderer.setPixelRatio(this.pixelRatio);
    // Upscaling by a whole factor (1x on a 2x screen) stays crisp, like the
    // voxel art; a fractional one would shimmer, so it's left smooth.
    const upscale = window.devicePixelRatio / this.pixelRatio;
    renderer.domElement.style.imageRendering = upscale > 1 && Number.isInteger(upscale) ? 'pixelated' : 'auto';
    renderer.domElement.style.filter = graphics().brightness === 1 ? '' : `brightness(${graphics().brightness})`;
    this.world.loadRadius = p.loadRadius;
    this.post?.setPasses(options.bloom && p.bloom, options.shafts && p.shafts, Math.min(options.msaa, p.msaa));
    this.resize();
  }

  // The world's layers, each a step the loader can report, and last the
  // chunks around the hero: only those are built now, the rest stream in
  // as the hero walks (see world/chunkStreamer.ts).
  buildSteps(): BuildStep[] {
    const { world: sink, model, regions } = this;
    const near = { label: 'Waking the lands nearby', run: () => this.world.loadAround(model.hero.x, model.hero.z) };
    if (regions) return [{ label: 'Drawing the lands round you', run: () => regions.drawAll() }, near]; // (a streamed world's: the regions made so far)
    const step = (builder: WorldBuilder): BuildStep => ({
      label: builder.label,
      run: () => {
        const animate = builder.build(sink, model);
        if (animate) this.animations.push(animate);
      },
    });
    return [...WORLD_BUILDERS.map(step), near];
  }

  // A region's new materials (a streamed world's, drawn after the start) stylized and compiled before they're seen, off
  // the frame where the browser can (their programs mostly made already: the same shaders as every region's).
  private prepare(materials: THREE.Material[]): void {
    if (!this.stylizer || materials.length === 0) return; // (before the start: finish() does it, for all)
    this.stylizer.patch(materials, true); // (the world's: they take the weather)
    warmUpLate(this.renderer, this.camera, this.scene, materials); // (render/warmUp.ts)
  }

  // After every build step: applies the stylized look (it patches every
  // material in the scene, so it runs last), sets up post-processing, and
  // compiles all shaders up front so the first frames don't hitch.
  async finish(): Promise<void> {
    const materials = [...this.world.materials(), ...this.enemies.materials, ...this.wildlife.materials, this.npcs.material, this.travellers.material, ...this.ambient.materials, ...this.entrances.materials, this.coins.material, ...this.loot.materials, this.blood.material, this.heroLook, this.heroFlash, this.heroFrost];
    this.stylizer = stylize(this.scene, materials, this.world.materials());
    this.post = this.options.post ? new PostProcessing(this.renderer, this.scene, this.camera, this.options) : null;
    this.applyGraphics();
    window.addEventListener('resize', () => this.resize());
    await warmUpAll(this.renderer, this.camera, this.scene, materials); // (every shader, before the first frame: render/warmUp.ts)
  }

  // The living enemy drawn nearest to a point on screen (a click), within
  // PICK_RADIUS pixels, or null. Judged on screen, not by hitting the
  // model exactly, as enemies are small from the isometric camera.
  pickEnemy(clientX: number, clientY: number, enemies: readonly Enemy[]): number | null {
    return this.pick(clientX, clientY, enemies.filter((e) => e.state !== 'dead' && !e.buried), this.scene)?.id ?? null;
  }

  // Whoever of `people` is drawn nearest a point on screen, likewise (where they're drawn: the room, indoors).
  pickPerson<T extends { x: number; y: number; z: number }>(clientX: number, clientY: number, people: readonly T[]): T | null {
    return this.pick(clientX, clientY, people, this.peopleIn);
  }

  private pick<T extends { x: number; y: number; z: number }>(clientX: number, clientY: number, among: readonly T[], within: THREE.Object3D): T | null {
    return pickNearest(this.renderer.domElement, this.camera, clientX, clientY, among, within); // (render/screenPick.ts)
  }

  // A figure of someone on their own, as they stand, facing +Z, nowhere yet (to be staged: cinema/transformCinema.ts).
  standIn(being: Being): THREE.Object3D {
    if (isFoe(being)) return this.enemies.standIn(being);
    const rig = new HumanRig(being.look, personMaterial());
    rig.wear(being.equipment);
    rig.update(0, 0, 0, 0, null, 0, 'stand');
    return rig.root;
  }

  // Where a point in the world is on screen, in page pixels.
  toScreen(x: number, y: number, z: number): { x: number; y: number } {
    return toScreen(this.renderer.domElement, this.camera, x, y, z);
  }

  // The hero drinks (an ale ordered at the bar), sip after sip over `seconds`, or eats (a pie); or stops, leaving the rest.
  heroDrinks(seconds: number, what: Drink = 'ale'): void {
    this.hero.drink(seconds, what);
  }

  heroStopsDrinking(): void {
    this.hero.stopDrinking();
  }

  get canvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }

  getMovementAxes(): MovementAxes {
    return this.movementAxes;
  }

  update(dt: number): void {
    const { model } = this;
    this.elapsed += dt;
    for (const animate of this.animations) animate(this.elapsed);
    this.sky.update(model, this.elapsed, this.post, this.mist.inRuin(model.hero.x, model.hero.z)); // (no sun's shafts in the ruins' mist)
    this.regions?.animate(this.elapsed);

    const { hero } = model;
    const look = workLook(model); // (their own; a pleasure worker at work behind a shut door: without its braies)
    if (this.hero.look !== look) this.reshapeHero(look); // a new look (a cheat, or that): a new body
    // At work, dressed for it (a costume, only to be seen: their gear still on them, its stats and all); else their gear.
    const costume = workCostume(model);
    if (costume) this.hero.dress(costume);
    else this.hero.wear(model.lumber.chopping && model.lumber.axeKey ? { ...hero.equipment, mainHand: model.lumber.axeKey } : hero.equipment); // (chopping with the pack's axe: out, in hand, for it)
    const chilled = !!hero.blessings?.some((b) => b.kind === 'chilled');
    this.hero.setMaterial(hero.hurtFor > 0 ? this.heroFlash : chilled ? this.heroFrost : this.heroLook);
    if (this.frost.group.parent !== this.hero.root) this.hero.root.add(this.frost.group); // (on whichever rig is theirs)
    this.frost.update(chilled, dt);
    // Indoors, the hero is moved into the room's scene; back out, into the world's.
    const yard = this.indoors.yardScene(model);
    const room = yard ? null : this.indoors.roomScene(model, this.elapsed);
    const home = yard ?? room ?? this.scene;
    this.hammerInHand.update(model, this.hero); // (at the anvil or the bench: in hand)
    // Whoever the hero's picked out (hero/selection.ts): the brackets at their feet, as a focused foe's.
    this.peopleIn = home;
    this.chickens.update(model.chickens.here, home, room ? INDOOR_SCALE : 1, dt, this.smoke); // (whoever's been turned into one, if they're here)
    this.smoke.update(dt);
    this.blood.update(dt);
    const chosen = model.chosen.person;
    this.personMark.visible = !!chosen;
    if (chosen) {
      home.add(this.personMark);
      this.personMark.position.set(chosen.x, chosen.y + 0.012, chosen.z);
      this.personMark.scale.setScalar(room ? INDOOR_SCALE : 1);
    }
    if (this.hero.root.parent !== home) {
      home.add(this.hero.root);
      // Rooms are built roomier than the world, so the hero's drawn bigger
      // there, and the camera closes in.
      this.hero.root.scale.setScalar(room ? INDOOR_SCALE : 1);
      this.hero.update(hero.x, hero.y, hero.z, 0); // arrive in place, no walk from where it was
      this.cameraY = hero.y;
    }
    const seated = model.seated?.seat;
    this.hero.sheathe(armsSheathed(model.inside)); // (in an inn, weapons put away)
    this.hero.combat(model.moves.rollProgress, model.moves.guard !== null); // (a roll, the guard up)
    // Eating from the bag, sat down: their weapons out of sight, what's eaten in hand, to the mouth now and then.
    const meal = hero.eating;
    this.hero.hideHeld(!!meal || !!model.fishing.line || !!model.mining.striking || !!model.smithing.making || !!model.salvage.breaking); // (and fishing, mining, at the anvil or the bench: the rod, the pick or the hammer in hand instead)
    if (meal?.item && isProvision(meal.item)) this.hero.sipping({ left: meal.left, seconds: meal.seconds, drink: meal.item });
    else if (this.eaten) this.hero.stopDrinking();
    else this.hero.hold(model.work.carrying ?? false); // (at work: the first order on the tray, in hand)
    this.eaten = !!meal;
    this.hero.update(hero.x, hero.y, hero.z, dt, model.attackProgress, hero.facing, seated ? (seated.lying ? 'lie' : 'sit') : hero.eating ? 'sit' : 'stand'); // (eating from the bag: sat on the ground)
    for (const mesh of this.hero.meshes) mesh.castShadow = !!room; // in the firelight indoors
    this.hero.shaded = !room; // outdoors, the shade on the ground under them
    this.silhouette.update(this.hero, !room && !yard); // (indoors, the walls in the way turn see-through instead)
    this.beacon.update(this.elapsed, home, hero, room ? INDOOR_SCALE : 1);
    if (!room) [this.workMarks.clear(), this.cupboard.clear()]; // (out of the room: its marks gone, her shelves too)
    if (yard) {
      this.followHero(hero, 0, dt);
      return; // the world outside stands still
    }
    this.npcs.update(model.folk, model.inside?.entrance ?? null, hero, home, dt, this.prompted, !!model.work.shift, (npc) => model.story.markOf(npc), this.elapsed); // (the villager the prompt's about: their name gives way to it)
    if (room) {
      this.indoors.room?.life?.update(model, dt); // (a dungeon's foes, what they loose, what they leave)
      this.cupboard.update(model, room);
      this.workMarks.update(model, room, this.elapsed, (x, y, z) => this.toScreen(x, y, z)); // (at work: the patrons waiting, the orders ready; off it, the notice board's "!")
      this.followHero(this.indoors.room?.life || !model.inside ? hero : roomAim(model.inside.room, model.inside.furniture, hero), 0, dt); // (a building's room: framed toward its fire; a dungeon's floor, on the hero)
      const rumble = this.indoors.room?.life?.rumble ?? 0; // (the floor shaking: the camera with it)
      if (rumble > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * 0.08 * rumble, (Math.random() - 0.5) * 0.05 * rumble, (Math.random() - 0.5) * 0.08 * rumble));
      return; // the world outside stands still
    }
    this.regions?.update(); // (a region the model's made drawn, or one it's let go dropped: one a frame)
    this.world.update(hero.x, hero.z);
    (this.carter ??= new CarterView(this.scene, this.travellers.material)).update(model, dt, this.elapsed, !!model.story.carterInReach);
    this.travellers.update(model.travellers.list, hero, dt, travellerInReach(model.travellers.list, hero), (t) => model.story.markOf(t), this.elapsed); // (the one the prompt's over: their name gives way to it)
    setWindPusher(hero.x, hero.z); // crops part around them
    setBarHeroLevel(hero.level); // (the levels over foes' heads, coloured by danger to the hero)
    this.enemies.update(model.enemies, hero.x, hero.z, dt, model.focused?.id ?? null, (e) => model.quests.marked(e));
    this.wildlife.update(model.wildlife, hero.x, hero.z, dt);
    this.loot.update(model.loot, hero.x, hero.z, dt);
    this.coins.update(model.coins, hero.x, hero.z, dt);
    (this.purse ??= new PurseView(this.scene)).update(model.purse, null, (x, z) => model.getGroundY(x, z), dt); // (their purse, where they fell)
    this.campFires.update(model, this.elapsed);
    this.kindledFire.update(model, this.elapsed);
    (this.herbPatches ??= new HerbPatches(this.scene)).update(model, this.elapsed);
    this.campChests.update(model);
    this.boardMarks.update(hero.x, hero.z, this.elapsed);
    this.mist.update(hero.x, hero.z, model.minutes, dt);
    this.ambient.update(dt, hero, model.minutes, true);
    this.entrances.update(dt, hero, model.minutes, true);
    this.wildMoves.update(model.wild, (x, z) => model.getGroundY(x, z), dt, true);
    (this.bedroll ??= new BedrollView(this.scene)).update(model);
    (this.fishing ??= new FishingView(this.scene)).update(model, this.hero, dt, this.elapsed);
    this.pickInHand.update(model, this.hero);

    // The camera eases toward the ground height rather than tracking hero.y
    // directly, so hops don't bounce the whole screen. Exponential decay
    // keeps the feel the same at any frame rate.
    this.followHero(hero, model.getGroundY(hero.x, hero.z), dt);
    this.stylizer?.setFocusHeight(this.cameraY);
  }

  // Rebuilds the hero's rig for a new look, where the old one stood.
  private reshapeHero(look: BodyLook): void {
    const old = this.hero;
    this.hero = new HumanRig(look, this.heroLook);
    this.hero.root.scale.copy(old.root.scale);
    old.root.parent?.add(this.hero.root);
    old.root.removeFromParent();
    this.hero.update(old.root.position.x, old.root.position.y, old.root.position.z, 0);
  }

  private followHero(hero: { x: number; z: number }, groundY: number, dt: number): void {
    this.cameraY += (groundY - this.cameraY) * (1 - Math.exp(-CAMERA_Y_SMOOTHING * dt));
    this.camera.position.set(hero.x + CAMERA_OFFSET.x, this.cameraY + CAMERA_OFFSET.y, hero.z + CAMERA_OFFSET.z);
    this.camera.lookAt(hero.x, this.cameraY, hero.z);
    this.camera.position.add(this.kick.offset(dt, this.kicked)); // (a blow landing: struck)
  }

  // A blow landed (a 'hit', controller/hitFeel.ts its feel): blood thrown where it did (in the room, if they're in
  // one), and the camera kicked `shake` the way it went.
  struck(hit: Extract<GameEvent, { kind: 'hit' }>, shake: number): void {
    this.blood.burst(this.peopleIn, hit, this.indoors.room ? INDOOR_SCALE : 1);
    this.kick.kick(shake, hit.from ? hit.x - hit.from.x : 0, hit.from ? hit.z - hit.from.z : 0);
  }

  prompted: Npc | null = null; // the villager the prompt shown is about (main.ts), whose name gives way to it

  render(): void {
    // The player's zoom (zoom.ts) outdoors; indoors, always the room's own.
    const zoom = this.indoors.room ? INDOOR_ZOOM : zoomLevel().zoom;
    if (this.camera.zoom !== zoom) {
      this.camera.zoom = zoom;
      this.camera.updateProjectionMatrix();
    }
    this.renderer.info.reset();
    if (this.indoors.yardView) this.renderer.render(this.indoors.yardView.scene, this.camera); // the furniture yard: flat grass, no world
    else if (this.indoors.room) this.renderer.render(this.indoors.room.scene, this.camera); // indoors: just the room
    else if (this.post && preset().post) this.post.render(this.elapsed);
    else this.renderer.render(this.scene, this.camera);
  }

  getRenderStats(): RenderStats {
    const { calls, triangles } = this.renderer.info.render;
    return { drawCalls: calls, triangles, pixelRatio: this.pixelRatio };
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.renderer.setSize(width, height);
    resizeCamera(this.camera, width, height);
    this.post?.setSize(width, height, this.pixelRatio);
  }
}
