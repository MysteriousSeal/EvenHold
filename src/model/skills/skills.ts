// The hero's skills, learnt by doing (as a crafter's or a gatherer's trade, apart from the fighting): the main ones
// (lumberjacking, gathering: lumber.ts; woodworking, making: woodworking.ts), and the secondary (cooking, fishing). Each a level from 1 to SKILL_MAX, climbed through its tiers (an apprentice's to an artisan's),
// each tier opening what's told of it (UNLOCKS). Every hero has them all from the start, at 1, and keeps them
// (saved). Practice raises them, a level at a time (raiseSkill), told when it does: lumberjacking by chopping,
// woodworking by making things, cooking by cooking, fishing by landing what bites (fishing.ts); the others not yet. As in WoW, how likely a try teaches is by how hard the thing
// is for them (difficulty: its level against theirs), orange always, then yellow, green, and grey never; and a level
// wants so many tries that taught (its skill's STEPS at its tier: the quicker a try, the more), so a tier's an hour or
// so of the trade, the whole of it three to five.

export type SkillId = 'lumberjacking' | 'woodworking' | 'salvaging' | 'cooking' | 'fishing';

export interface Skill {
  name: string;
  kind: 'main' | 'secondary'; // a trade of its own, or one alongside (listed so)
  practice?: string; // how it's raised (none: not yet)
  verb: string; // what's done to raise it ("cook", "fish")
  about: string; // what it is, in a line
  unlocks: ReadonlyArray<{ at: number; what: string }>; // what each level reached opens (from its tier's start)
  steps: readonly [number, number, number, number]; // tries that taught, a level, at each tier (a chop's a few seconds, a meal's makings a hunt)
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
    steps: [11, 11, 10, 9], // (the ancient and elder trees, fewer: a walk between)
    kind: 'main',
    verb: 'chop',
    practice: 'Chop trees with an axe in hand (a hatchet, from the smith): E by a trunk.',
    about: 'Fell the trees of the wilds for their wood, a log knocked loose at every chop. Harder woods want a practised hand.',
    unlocks: [
      { at: 1, what: 'Fell birches' },
      { at: 40, what: 'Fell pines' },
      { at: 75, what: 'Chop quicker: a swing fewer each tier on' },
      { at: 90, what: 'Fell oaks' },
      { at: 100, what: 'A second log now and then, the likelier the better you are; resin in the pines' },
      { at: 140, what: 'Fell ancient pines: two logs a chop, rich in resin' },
      { at: 190, what: 'Fell ancient oaks: two logs a chop, and their heartwood' },
      { at: 240, what: 'Fell elder oaks: heartwood oftener, and now and then a burl' },
    ],
  },
  woodworking: {
    name: 'Woodworking',
    steps: [7, 5, 3, 2], // (its first tiers' planks cheap and quick; its last's oak, varnish and heartwood a while to come by)
    kind: 'main',
    verb: 'work wood',
    practice: 'Make things from the logs you fell: pick a recipe below and craft it, the materials in your bag.',
    about: 'Saw logs into planks, and planks into bowls, weapons and shields; the finest from varnished oak and ancient heartwood.',
    unlocks: [
      { at: 1, what: 'Birch planks; a wooden sword at 10' },
      { at: 20, what: 'A bedroll, to lie down on anywhere; wooden bowls at 25' },
      { at: 30, what: 'A birch-framed pack: room in the bag; a bentwood ring at 40' },
      { at: 50, what: 'Pine planks; a knotted club at 65' },
      { at: 80, what: 'A felling axe: a chop a swing quicker; a quarterstaff at 90' },
      { at: 100, what: 'Oak planks; a pine pack at 110, carved tankards at 125, a carved pendant at 130' },
      { at: 150, what: 'Plank shields; varnish from resin at 160, a broad axe at 180' },
      { at: 200, what: 'A varnished quarterstaff' },
      { at: 230, what: 'Heartwood: an amulet; a shield at 240, a pack at 255, the finest staff at 270' },
    ],
  },
  salvaging: {
    name: 'Salvaging',
    steps: [1, 1, 1, 1],
    kind: 'secondary',
    practice: 'Break gear down at the salvage bench in a smithy (the workbench with the vice, out on his floor).',
    verb: 'salvage',
    about: "Break down weapons, armour and jewellery you don't need at a smithy's salvage bench into what they're made of: iron scrap, leather, linen, silver and gem shards, planks. The finer the piece, the more it leaves, and a rare one leaves something finer besides.",
    unlocks: [
      { at: 1, what: 'Common gear of the first levels' },
      { at: 9, what: 'Uncommon pieces' },
      { at: 21, what: 'Rare pieces: a tempered ingot or a cut gem from each' },
      { at: 61, what: 'Epic pieces: two finer things from each' },
      { at: 75, what: 'Common gear up to level 27' },
      { at: 121, what: 'Legendary pieces: three' },
      { at: 225, what: 'The finest gear there is, broken down to the last rivet' },
    ],
  },
  cooking: {
    name: 'Cooking',
    steps: [3, 3, 2, 1], // (an artisan's feast: a hunt's makings)
    kind: 'secondary',
    verb: 'cook',
    practice: 'Cook by a fire: a camp’s, a hearth indoors, or one you kindle (a pedlar’s firewood, or two logs). E by it opens your recipes.',
    about: "Turn what's caught and hunted into meals that heal more than anything sold, and keep the hero going for a while after.",
    unlocks: [
      { at: 1, what: 'Roast boar and small fry over any fire: Well fed a few minutes after' },
      { at: 25, what: 'Wolf skewers; seared lynx at 45, bear steaks at 60' },
      { at: 75, what: 'Grilled trout; salt-baked perch at 90' },
      { at: 100, what: "Stews at a hearth: Well fed after, mending as you go (a fisherman's stew at 115, honey-glazed bear at 130)" },
      { at: 150, what: 'Roast pike; pies at a hearth from 160 (a pike pie at 180, a honey cake at 200): Fortified after' },
      { at: 225, what: "Feasts before a hard fight: Feasted after (a river feast at 250, a lord's at 275)" },
    ],
  },
  fishing: {
    name: 'Fishing',
    steps: [5, 3, 4, 4], // (what teaches, half what bites)
    kind: 'secondary',
    verb: 'fish',
    practice: 'Fish from a lake shore with a rod in your bag (pedlars sell them): E facing the water, and E again when it bites.',
    about: 'Cast a line from the shore of a lake or a river, and land what bites: food for the pot, and now and then something stranger. Every water has something to teach, however practised you are.',
    unlocks: [
      { at: 1, what: 'Small fry from any shore' },
      { at: 40, what: 'Roach from any shore' },
      { at: 55, what: 'Now and then a lucky trout or perch' },
      { at: 75, what: "River trout in a lake's narrows, lake perch in its open water; bites come quicker each tier on" },
      { at: 110, what: 'Eels in the narrows' },
      { at: 150, what: 'Pike, where the line lies far from any bank' },
      { at: 200, what: 'Char in open water' },
      { at: 225, what: 'What the water hides: a lost locket, an old coin, a torc in the deep' },
      { at: 250, what: 'Sturgeon in the deep' },
    ],
  },
};

export const SKILL_IDS = Object.keys(SKILLS) as SkillId[];

// The hero's level in a skill, and the tries toward the next that have taught (none yet: none).
export interface SkillRecord {
  level: number;
  toward?: number;
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

// How many tries that taught a level of `skill` wants, at `level` (its tier's).
export const stepsOf = (skill: SkillId, level: number): number => SKILLS[skill].steps[tierOf(level).index];

// A skill raised `by` levels (to SKILL_MAX at most), what was toward the next let go: the levels it rose by (0 at the top).
export function raiseSkill(hero: Skilled, skill: SkillId, by = 1): number {
  const record = skillOf(hero, skill);
  const before = record.level;
  record.level = Math.min(SKILL_MAX, before + Math.max(0, Math.floor(by)));
  if (record.level > before) delete record.toward;
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

// A try at something wanting `needs` (a tree felled at, a thing made): whether it taught, as its difficulty allows
// (`roll`: 0..1, the try's own; `chance`: its own, where it isn't the difficulty's), toward the next level (`worth`
// tries' worth: a dish of a hunt's meat, dear to come by, more than one of fish); enough of them (stepsOf), the skill
// raised, told; the levels it rose by.
export function practise(hero: Skilled, skill: SkillId, needs: number, roll: number, report: (event: { kind: 'skillUp'; skill: string; level: number }) => void, chance?: number, worth = 1): number {
  const record = skillOf(hero, skill);
  const level = record.level;
  if (level >= SKILL_MAX || roll >= (chance ?? difficulty(needs, level).chance)) return 0;
  record.toward = (record.toward ?? 0) + Math.max(1, Math.floor(worth));
  if (record.toward < stepsOf(skill, level) || raiseSkill(hero, skill) === 0) return 0;
  report({ kind: 'skillUp', skill: SKILLS[skill].name, level: level + 1 });
  return 1;
}

// A save's skills, as far as they're sound (an older save's: none, each at 1 when asked for; its tries toward the
// next, none).
export function readSkills(saved: unknown): Partial<Record<SkillId, SkillRecord>> {
  const out: Partial<Record<SkillId, SkillRecord>> = {};
  if (!saved || typeof saved !== 'object') return out;
  for (const skill of SKILL_IDS) {
    const level = (saved as Record<string, Partial<SkillRecord> | undefined>)[skill]?.level;
    if (typeof level !== 'number' || !Number.isFinite(level)) continue;
    const record: SkillRecord = (out[skill] = { level: Math.min(SKILL_MAX, Math.max(1, Math.floor(level))) });
    const toward = (saved as Record<string, Partial<SkillRecord> | undefined>)[skill]?.toward; // (an older save's: none)
    if (typeof toward === 'number' && toward >= 1 && toward < stepsOf(skill, record.level)) record.toward = Math.floor(toward);
  }
  return out;
}
