// The hero's skills, learnt by doing (as a crafter's or a gatherer's trade, apart from the fighting): the main ones
// (lumberjacking, gathering: lumber.ts; woodworking, making: woodworking.ts), and the secondary (cooking, fishing). Each a level from 1 to SKILL_MAX, climbed through its tiers (an apprentice's to an artisan's),
// each tier opening what's told of it (UNLOCKS). Every hero has them all from the start, at 1, and keeps them
// (saved). Practice raises them, a level at a time (raiseSkill), told when it does: lumberjacking by chopping,
// woodworking by making things; the others not yet. As in WoW, how likely a try raises it is by how hard the thing
// is for them (difficulty: its level against theirs), orange always, then yellow, green, and grey never.

export type SkillId = 'lumberjacking' | 'woodworking' | 'salvaging' | 'cooking' | 'fishing';

export interface Skill {
  name: string;
  kind: 'main' | 'secondary'; // a trade of its own, or one alongside (listed so)
  practice?: string; // how it's raised (none: not yet)
  verb: string; // what's done to raise it ("cook", "fish")
  about: string; // what it is, in a line
  unlocks: ReadonlyArray<{ at: number; what: string }>; // what each level reached opens (from its tier's start)
}

export interface SkillTier {
  name: string;
  from: number; // the level it starts at
  to: number; // and tops out at (the next one's start)
}

export const SKILL_MAX = 300;
export const SKILL_TIERS: readonly SkillTier[] = [
  { name: 'Apprentice', from: 1, to: 75 },
  { name: 'Journeyman', from: 75, to: 150 },
  { name: 'Expert', from: 150, to: 225 },
  { name: 'Artisan', from: 225, to: SKILL_MAX },
];

export const SKILLS: Record<SkillId, Skill> = {
  lumberjacking: {
    name: 'Lumberjacking',
    kind: 'main',
    verb: 'chop',
    practice: 'Chop trees with an axe in hand (a hatchet, from the smith): E by a trunk.',
    about: 'Fell the trees of the wilds for their wood, a log knocked loose at every chop. Harder woods want a practised hand.',
    unlocks: [
      { at: 1, what: 'Fell birches' },
      { at: 25, what: 'Fell pines' },
      { at: 50, what: 'Fell oaks' },
      { at: 75, what: 'Chop quicker: a swing fewer each tier on' },
      { at: 100, what: 'A second log now and then, the likelier the better you are' },
      { at: 125, what: 'Fell ancient pines: two logs a chop' },
      { at: 150, what: 'Find resin in the pines' },
      { at: 175, what: 'Fell ancient oaks: two logs a chop, and their heartwood' },
    ],
  },
  woodworking: {
    name: 'Woodworking',
    kind: 'main',
    verb: 'work wood',
    practice: 'Make things from the logs you fell: pick a recipe below and craft it, the materials in your bag.',
    about: 'Saw logs into planks, and planks into bowls, weapons and shields; the finest from varnished oak and ancient heartwood.',
    unlocks: [
      { at: 1, what: 'Birch planks, a wooden sword' },
      { at: 50, what: 'Pine planks, a knotted club' },
      { at: 100, what: 'Oak planks, a quarterstaff' },
      { at: 150, what: 'Plank shields, varnish from resin' },
      { at: 225, what: 'Heartwood: the finest staffs and shields' },
    ],
  },
  salvaging: {
    name: 'Salvaging',
    kind: 'secondary',
    practice: 'Break gear down at a village\'s salvage bench (the workbench with the vice, on the square by the well).',
    verb: 'salvage',
    about: "Break down weapons, armour and jewellery you don't need at a salvage bench into what they're made of: iron scrap, leather, linen, silver and gem shards, planks. The finer the piece, the more it leaves, and a rare one leaves something finer besides.",
    unlocks: [
      { at: 1, what: 'Common gear of the first levels' },
      { at: 9, what: 'Uncommon pieces' },
      { at: 21, what: 'Rare pieces: a tempered ingot or a cut gem from each' },
      { at: 61, what: 'Epic pieces: two finer things from each' },
      { at: 75, what: 'Common gear of level 27 and over' },
      { at: 121, what: 'Legendary pieces: three' },
      { at: 225, what: 'The finest gear there is, broken down to the last rivet' },
    ],
  },
  cooking: {
    name: 'Cooking',
    kind: 'secondary',
    verb: 'cook',
    about: "Turn what's caught and gathered into meals that heal more and keep the hero going longer than raw food.",
    unlocks: [
      { at: 1, what: 'Roast meat and fish over a campfire' },
      { at: 75, what: 'Hearty stews at an inn’s hearth' },
      { at: 150, what: 'Pies and pastries that fortify' },
      { at: 225, what: 'Feasts to share before a hard fight' },
    ],
  },
  fishing: {
    name: 'Fishing',
    kind: 'secondary',
    verb: 'fish',
    about: 'Cast a line from the shore of a lake or a river, and land what bites: food for the pot, and now and then something stranger.',
    unlocks: [
      { at: 1, what: 'Small fry from any shore' },
      { at: 75, what: 'River trout and lake perch' },
      { at: 150, what: 'Pike in the deep water' },
      { at: 225, what: 'Rare catches, and what the water hides' },
    ],
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

// The hero's level in a skill.
export interface SkillRecord {
  level: number;
}

type Skilled = { skills?: Partial<Record<SkillId, SkillRecord>> };

// The hero's record in `skill` (at 1, made, if they've none yet).
export function skillOf(hero: Skilled, skill: SkillId): SkillRecord {
  hero.skills ??= {};
  return (hero.skills[skill] ??= { level: 1 });
}

// The tier a level's in (the top one at the top), its place among them, and how far through it (0..1).
export function tierOf(level: number): { tier: SkillTier; index: number; toward: number } {
  let index = 0;
  while (index + 1 < SKILL_TIERS.length && level >= SKILL_TIERS[index + 1].from) index++;
  const tier = SKILL_TIERS[index];
  return { tier, index, toward: Math.min(1, (level - tier.from) / (tier.to - tier.from)) };
}

// A skill raised `by` levels (to SKILL_MAX at most): the levels it rose by (0 at the top).
export function raiseSkill(hero: Skilled, skill: SkillId, by = 1): number {
  const record = skillOf(hero, skill);
  const before = record.level;
  record.level = Math.min(SKILL_MAX, before + Math.max(0, Math.floor(by)));
  return record.level - before;
}

// How hard a thing (wanting `needs` of the skill) is for someone at `level`, as WoW colours it, and how likely a try
// at it raises the skill: orange (always), yellow, green, grey (never; nothing more to learn from it).
export const RISE: ReadonlyArray<{ within: number; chance: number; color: string; name: string }> = [
  { within: 25, chance: 1, color: '#ff8040', name: 'orange' },
  { within: 50, chance: 0.6, color: '#ffd23f', name: 'yellow' },
  { within: 75, chance: 0.25, color: '#58c060', name: 'green' },
  { within: Infinity, chance: 0, color: '#9a9a9a', name: 'grey' },
];
export const difficulty = (needs: number, level: number) => RISE.find((r) => level < needs + r.within)!;

// A try at something wanting `needs` (a tree felled at, a thing made): the skill raised, as its difficulty allows
// (`roll`: 0..1, the try's own), told; the levels it rose by.
export function practise(hero: Skilled, skill: SkillId, needs: number, roll: number, report: (event: { kind: 'skillUp'; skill: string; level: number }) => void): number {
  const level = skillOf(hero, skill).level;
  if (roll >= difficulty(needs, level).chance || raiseSkill(hero, skill) === 0) return 0;
  report({ kind: 'skillUp', skill: SKILLS[skill].name, level: level + 1 });
  return 1;
}

// A save's skills, as far as they're sound (an older save's: none, each at 1 when asked for).
export function readSkills(saved: unknown): Partial<Record<SkillId, SkillRecord>> {
  const out: Partial<Record<SkillId, SkillRecord>> = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const skill of SKILL_IDS) {
    const level = (saved as Record<string, Partial<SkillRecord> | undefined>)[skill]?.level;
    if (typeof level === 'number' && Number.isFinite(level)) out[skill] = { level: Math.min(SKILL_MAX, Math.max(1, Math.floor(level))) };
  }
  return out;
}
