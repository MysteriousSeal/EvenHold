// What a hero's look is made of, trait by trait, for the character
// creation screen (controller/mainMenu.ts) to draw without knowing them:
// each its label, how it's chosen (a pick between a few, colour swatches,
// a style to step through, a yes or no), the values allowed for a look (a
// woman's hair styles, a man's beard), and each value's name. Its values
// come from humanoid.ts: a new hair style or colour there shows here by
// itself; a new trait (a BodyLook field) is one more entry below.

import { DYE_COUNT, HAIR_COLOR_COUNT, SKIN_TONE_COUNT, STYLES_OF, type BodyLook } from './humanoid';

export type TraitKey = keyof BodyLook;
export type TraitKind = 'pick' | 'swatch' | 'cycle' | 'toggle';

export interface LookTrait {
  key: TraitKey;
  label: string;
  kind: TraitKind;
  values(look: BodyLook): readonly BodyLook[TraitKey][]; // allowed, for this look
  name(value: BodyLook[TraitKey]): string;
  shown?(look: BodyLook): boolean; // (not shown: its first value, e.g. no beard on a woman)
}

const upTo = (count: number) => Array.from({ length: count }, (_, i) => i);
// Skin tones palest to darkest (their numbers, kept for saves, aren't in that order); any added later, after.
const SKIN_ORDER = [4, 0, 1, 6, 2, 7, 3, 5];
// Hair colours light to dark, then grey and white (their numbers, kept for saves, aren't in that order).
const HAIR_ORDER = [5, 2, 3, 6, 0, 1, 4, 7];
const ordered = (order: number[], count: number) => [...order.filter((i) => i < count), ...upTo(count).filter((i) => !order.includes(i))];
const skinTones = () => ordered(SKIN_ORDER, SKIN_TONE_COUNT);
const named = (names: readonly string[], fallback: string) => (value: unknown) => names[value as number] ?? `${fallback} ${(value as number) + 1}`;
// 'twinBraids' → 'Twin braids'
const spaced = (value: unknown) => {
  const words = String(value).replace(/([A-Z])/g, ' $1').toLowerCase();
  return words[0].toUpperCase() + words.slice(1);
};

export const LOOK_TRAITS: readonly LookTrait[] = [
  { key: 'build', label: 'Body', kind: 'pick', values: () => ['male', 'female'], name: (v) => (v === 'female' ? 'Woman' : 'Man') },
  { key: 'skin', label: 'Skin', kind: 'swatch', values: skinTones, name: named(['Fair', 'Light', 'Tanned', 'Deep', 'Pale', 'Dark', 'Olive', 'Bronze'], 'Tone') },
  { key: 'hairStyle', label: 'Hair', kind: 'cycle', values: (look) => STYLES_OF[look.build], name: spaced },
  { key: 'hair', label: 'Hair colour', kind: 'swatch', values: () => ordered(HAIR_ORDER, HAIR_COLOR_COUNT), name: named(['Chestnut', 'Black', 'Fair', 'Red', 'Grey', 'Platinum', 'Auburn', 'White'], 'Colour') },
  { key: 'beard', label: 'Beard', kind: 'toggle', values: () => [false, true], name: (v) => (v ? 'Bearded' : 'Clean-shaven'), shown: (look) => look.build === 'male' },
  { key: 'dye', label: 'Clothes', kind: 'swatch', values: () => upTo(DYE_COUNT), name: named(['Madder red', 'Woad blue', 'Weld green', 'Walnut', 'Charcoal', 'Turquoise', 'Saffron', 'Orchil'], 'Dye') },
];

// The look made sound: each trait's value one it allows (else its first), a hidden one at its first.
export function fitLook(look: BodyLook): BodyLook {
  const fitted = { ...look } as Record<TraitKey, unknown>;
  for (const trait of LOOK_TRAITS) {
    const allowed = trait.values(fitted as unknown as BodyLook);
    const hidden = trait.shown && !trait.shown(fitted as unknown as BodyLook);
    if (hidden || !allowed.includes(fitted[trait.key] as never)) fitted[trait.key] = allowed[0];
  }
  return fitted as unknown as BodyLook;
}

// The look with one trait set (and the rest kept sound: a woman's hair styles, no beard).
export function withTrait(look: BodyLook, key: TraitKey, value: BodyLook[TraitKey]): BodyLook {
  return fitLook({ ...look, [key]: value });
}

// The next (or previous) value of a trait, round.
export function stepTrait(look: BodyLook, key: TraitKey, by: 1 | -1): BodyLook {
  const trait = LOOK_TRAITS.find((t) => t.key === key)!;
  const values = trait.values(look);
  const at = values.indexOf(look[key] as never);
  return withTrait(look, key, values[(at + by + values.length) % values.length]);
}
