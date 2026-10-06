// The hero's skills, learnt by doing (as a crafter's or a gatherer's trade, apart from the fighting): the main ones
// (lumberjacking: lumber.ts), and the secondary (cooking, fishing). Each a level from 1 to SKILL_MAX, climbed through its tiers (an apprentice's to an artisan's),
// each tier opening what's told of it (UNLOCKS). Every hero has them all from the start, at 1, and keeps them
// (saved). Practice raises them, a level at a time (raiseSkill), told when it does: lumberjacking by chopping; the
// others not yet.

export type SkillId = 'lumberjacking' | 'cooking' | 'fishing';

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
