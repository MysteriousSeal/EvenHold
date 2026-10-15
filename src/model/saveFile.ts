// A hero as a file (the pause menu's Export hero and Import hero: controller/storage/heroFiles.ts): their save (save.ts),
// wrapped with what it is and which version of the game wrote it. A file read back comes from outside (anyone's,
// any size, anything in it), so it's read with care before anything is kept: plain text of a sane length, the
// wrapper's own word for what it is, a world's seed and size the game can make, a hero's name it can show, and a save
// parseSave takes. Whatever else in it is unsound, restore (save.ts) lets go of, never the game.

import { parseSave, type SaveData } from './save';
import { STREAMED_SIZE } from './worldgen/regions';

export const HERO_FILE = 'evenhold-hero'; // the wrapper's word for what it is
export const FILE_MOST = 8 * 1024 * 1024; // characters: no save comes near it
const NAME_MOST = 40; // characters in a hero's name (the hero forge's are shorter)
const SIDE = { least: 16, most: STREAMED_SIZE.width }; // tiles a side a world may be

// The file for a save: its text, and a name to save it under ("Aelric-world-1234.evenhold.json").
export function heroFile(data: SaveData, game: string): { text: string; name: string } {
  const text = JSON.stringify({ kind: HERO_FILE, game, savedAt: new Date().toISOString(), save: data });
  const name = `${data.hero.name.replace(/[^A-Za-z0-9-]+/g, '_') || 'hero'}-world-${data.seed}.evenhold.json`;
  return { text, name };
}

export type ReadHero = { seed: number; name: string; level: number; raw: string } | { error: string };

// A file's hero, if it's one the game can play: its world's seed, who they are, and the save as text to keep; else
// why not, in words for the player.
export function readHeroFile(text: unknown): ReadHero {
  if (typeof text !== 'string' || text.length === 0) return { error: 'That file is empty.' };
  if (text.length > FILE_MOST) return { error: 'That file is far too big to be a hero.' };
  let file: unknown;
  try {
    file = JSON.parse(text);
  } catch {
    return { error: "That isn't an EvenHold hero file." };
  }
  const wrapper = (file && typeof file === 'object' && !Array.isArray(file) ? file : {}) as Record<string, unknown>;
  const save = (wrapper.kind === HERO_FILE ? wrapper.save : wrapper) as Record<string, unknown> | undefined; // (a bare save, as the browser keeps it, taken too)
  if (!save || typeof save !== 'object' || Array.isArray(save)) return { error: "That isn't an EvenHold hero file." };
  const seed = save.seed;
  if (typeof seed !== 'number' || !Number.isSafeInteger(seed) || seed < 0) return { error: "That hero's world can't be found (its seed is broken)." };
  const size = save.size as Record<string, unknown> | undefined;
  const side = (n: unknown) => Number.isInteger(n) && (n as number) >= SIDE.least && (n as number) <= SIDE.most;
  if (size !== undefined && (!size || typeof size !== 'object' || !side(size.width) || !side(size.depth))) return { error: "That hero's world is no size the game can make." };
  const hero = save.hero as Record<string, unknown> | undefined;
  if (typeof hero?.name !== 'string' || hero.name.trim().length === 0 || hero.name.length > NAME_MOST) return { error: "That hero's name can't be read." };
  const raw = JSON.stringify(save);
  const data = parseSave(raw, seed);
  if (!data) return { error: 'That hero was saved by a version of the game this one can’t read, or the file is damaged.' };
  return { seed, name: data.hero.name, level: Math.max(1, Math.floor(data.hero.level)), raw };
}
