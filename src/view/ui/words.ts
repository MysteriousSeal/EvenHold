// Numbers and names in words, for what's shown: several of a thing, how
// many of something, a chance (coins: coins.ts coinWords).

// Several of a thing: "wolf fangs", "torn pouches"; a name already plural ("leather gloves") as it is.
export const plural = (name: string) => (name.endsWith('s') ? name : /(x|ch|sh)$/.test(name) ? `${name}es` : `${name}s`);

// How many of something: "1 point", "3 points".
export const counted = (n: number, noun: string) => `${n} ${n === 1 ? noun : plural(noun)}`;

// A chance as a percentage: "12%".
export const percent = (chance: number) => `${Math.round(chance * 100)}%`;
