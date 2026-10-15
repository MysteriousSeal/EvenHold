// The places' sound, each frame from where the hero is and the sky (render/sky.ts): outdoors, birds by day and
// crickets at night (none in winter), the rain and the wind as hard as they are, a smithy's forge roaring as they pass;
// indoors, an inn's talk and every hearth's crackle, the forge in a smithy, the rain muffled through the roof; a pot on
// the fire while they cook. Their footsteps, a step each stride walked, by what they walk on (grass, the road, a
// village's flags, floorboards, snow); a door, going in or out.

import type { GameModel } from '../../model/GameModel';
import type { Entrance } from '../../model/interiors/interiors';
import { Nearby } from '../../util/nearby';
import { sky, skyUniforms } from '../render/sky';
import type { Sound } from './sound';
import type { LoopId, SoundId } from './soundBank';

export const STEP = Math.PI / 4.5; // world units a step: half a walk cycle (meshes/human/humanRig.ts STRIDE)
const FORGE_REACH = 7; // tiles off a smithy's door its forge is heard
const ON_GROUND = 0.05; // how far over the ground the hero's feet can be, stepping (a hop's: no steps)

type World = Pick<GameModel, 'hero' | 'inside' | 'tiles' | 'cooking' | 'moves' | 'seated' | 'entrances' | 'getGroundY'>;

const clamp = (v: number) => Math.min(1, Math.max(0, v));

// What the hero walks on where they are (`snow`: how much lies, 0..1).
export function groundOf(m: Pick<World, 'hero' | 'inside' | 'tiles'>, snow: number): SoundId {
  if (m.inside) {
    const floor = m.inside.room.floor;
    return floor === 'flagstones' ? 'stepStone' : floor === 'earth' ? 'stepDirt' : 'stepWood';
  }
  if (snow > 0.3) return 'stepSnow';
  const surface = m.tiles.surface(Math.round(m.hero.x), Math.round(m.hero.z));
  return surface === 'plaza' ? 'stepStone' : surface === 'path' ? 'stepDirt' : 'stepGrass';
}

// Each loop's level for the hero where they are (0..1 each, over its own).
export function loopLevels(m: Pick<World, 'inside' | 'cooking'>, s: Pick<typeof sky, 'outdoors' | 'night' | 'rain' | 'wind' | 'season'>, forgeNear: number): Record<LoopId, number> {
  const levels: Record<LoopId, number> = { birds: 0, crickets: 0, rain: 0, wind: 0, inn: 0, hearth: 0, forge: 0, sizzle: m.cooking.making ? 1 : 0 };
  const type = m.inside?.entrance.type;
  if (!m.inside) {
    const winter = s.season === 'winter';
    levels.birds = clamp((1 - s.night) * (1 - s.rain * 0.8)) * (winter ? 0.25 : 1);
    levels.crickets = winter ? 0 : clamp(s.night * (1 - s.rain * 0.7));
    levels.rain = clamp(s.rain);
    levels.wind = clamp(0.15 + (s.wind - 0.3) * 0.8);
    levels.forge = forgeNear;
  } else if (type === 'inn' || type === 'house' || type === 'smithy') {
    levels.rain = clamp(s.rain) * 0.3; // (on the roof)
    levels.inn = type === 'inn' && !m.inside.below ? 1 : type === 'inn' ? 0.35 : 0; // (upstairs: through the floor)
    levels.hearth = type === 'smithy' ? 0 : m.inside.below ? 0.3 : 1;
    levels.forge = type === 'smithy' ? 1 : 0;
  } else levels.wind = 0.12; // (a crypt's, a cave's draught)
  return levels;
}

export class Ambience {
  private walked = 0;
  private at: { x: number; z: number } | null = null;
  private was: GameModel['inside'] | undefined = undefined;
  private smithies: Nearby<Entrance> | null = null;

  constructor(private readonly sound: Sound) {}

  update(m: World): void {
    const { hero } = m;
    if (this.was !== undefined && this.was !== m.inside) this.sound.play('door');
    this.was = m.inside;
    // The forge heard the nearer its smithy's door, outdoors.
    this.smithies ??= new Nearby(m.entrances, (e) => e, FORGE_REACH);
    let forge = 0;
    if (!m.inside) for (const e of this.smithies.near(hero)) if (e.type === 'smithy') forge = Math.max(forge, clamp(1 - Math.hypot(e.x - hero.x, e.z - hero.z) / FORGE_REACH) * 0.6);
    const levels = loopLevels(m, sky, forge);
    for (const id of Object.keys(levels) as LoopId[]) this.sound.setLoop(id, levels[id]);
    // A step every stride they walk on the ground (not rolled, not hopped, not carried sat down).
    const moved = this.at ? Math.hypot(hero.x - this.at.x, hero.z - this.at.z) : 0;
    this.at = { x: hero.x, z: hero.z };
    const grounded = m.inside ? true : hero.y - m.getGroundY(hero.x, hero.z) < ON_GROUND;
    if (moved > 1 || m.moves.roll || m.seated || !grounded) return; // (a jump across the map, a door: no step)
    this.walked += moved;
    if (this.walked < STEP) return;
    this.walked -= STEP;
    this.sound.play(groundOf(m, skyUniforms.uSnow.value)); // (the snow lying)
  }
}
