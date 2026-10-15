// The game's sounds (public/sounds/, CC0: public/sounds/CREDITS.md): each a few takes ("swing-1.mp3" .. "swing-4.mp3",
// one of them played at a time) or one loop ("rain.mp3"), on its bus, at its level.

export type Bus = 'effects' | 'ambience';

export interface SoundSpec {
  takes: number; // files of it (0: a loop, one file of its own name)
  bus: Bus;
  gain: number; // its level, 0..1, before the bus's
  pitch?: number; // how far a take's pitch strays, either way (a share: 0.06, 6%)
}

const fx = (takes: number, gain: number, pitch = 0.06): SoundSpec => ({ takes, bus: 'effects', gain, pitch });
const loop = (gain: number): SoundSpec => ({ takes: 0, bus: 'ambience', gain });

export const SOUNDS = {
  // the fight
  swing: fx(4, 0.45, 0.1),
  roll: fx(2, 0.5),
  dodge: fx(2, 0.4, 0.1),
  hitFlesh: fx(4, 0.75),
  hitArmour: fx(3, 0.6),
  crit: fx(2, 0.85),
  hurt: fx(3, 0.8),
  parry: fx(3, 0.7, 0.04),
  block: fx(3, 0.65),
  broken: fx(1, 0.8),
  slain: fx(3, 0.7),
  fallen: fx(1, 0.9, 0),
  frost: fx(2, 0.5), // (caught in a draugr's breath)
  web: fx(2, 0.55), // (in a spider's web)
  hatch: fx(2, 0.6), // (the brood's eggs)
  sting: fx(2, 0.7, 0.03), // (a gong: a boss risen, a nest torn open, a gate unbarred, a dungeon come into)
  // the bag, charms
  drink: fx(2, 0.55),
  eat: fx(3, 0.45),
  cast: fx(2, 0.5),
  mend: fx(1, 0.4, 0.03),
  blessing: fx(1, 0.5, 0),
  // windows, coin, being told
  open: fx(2, 0.35),
  close: fx(2, 0.3),
  coin: fx(3, 0.5),
  skillUp: fx(1, 0.45, 0),
  levelUp: fx(1, 0.55, 0),
  quest: fx(1, 0.4, 0),
  error: fx(2, 0.35, 0.02),
  locked: fx(1, 0.55),
  door: fx(2, 0.4),
  // work
  chop: fx(3, 0.6),
  felled: fx(1, 0.8),
  mine: fx(3, 0.55),
  anvil: fx(3, 0.5, 0.04),
  bench: fx(2, 0.5),
  crafted: fx(1, 0.5), // (something made, into the bag)
  salvaged: fx(2, 0.45), // (a piece broken down: its bits)
  castLine: fx(1, 0.5, 0.1),
  catch: fx(1, 0.6),
  lost: fx(1, 0.45),
  // footsteps, by the ground
  stepGrass: fx(4, 0.22, 0.08),
  stepStone: fx(4, 0.2, 0.08),
  stepWood: fx(4, 0.24, 0.08),
  stepDirt: fx(4, 0.2, 0.08),
  stepSnow: fx(3, 0.22, 0.08),
  // loops
  birds: loop(0.5),
  crickets: loop(0.4),
  rain: loop(0.7),
  wind: loop(0.45),
  inn: loop(0.5),
  hearth: loop(0.45),
  forge: loop(0.55),
  sizzle: loop(0.35),
  lute: loop(0.3), // (a tune at the inn: RandomMind's The Old Tower Inn)
} satisfies Record<string, SoundSpec>;

export type SoundId = keyof typeof SOUNDS;
export const LOOPS = ['birds', 'crickets', 'rain', 'wind', 'inn', 'hearth', 'forge', 'sizzle', 'lute'] as const satisfies readonly SoundId[];
export type LoopId = (typeof LOOPS)[number];

// The file of one take of a sound (`take`: 0-based), or of a loop.
export const fileOf = (id: SoundId, take = 0): string => `sounds/${SOUNDS[id].takes ? `${id}-${take + 1}` : id}.mp3`;
