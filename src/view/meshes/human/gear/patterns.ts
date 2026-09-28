// Surface patterns shared by gear painters, all grid-aligned. Shell
// coordinates go down to -1, so every pattern wraps with a true modulo.

export const mod = (n: number, m: number): number => ((n % m) + m) % m;

// Chain mail: rings alternating in two shades, like a checkerboard.
export const mail = (x: number, y: number, z: number, ring: number, gap: number): number => (mod(x + y + z, 2) === 0 ? ring : gap);

// Shaggy fur: three shades in a staggered repeat.
export const fur = (x: number, y: number, z: number, shades: [light: number, mid: number, dark: number]): number => shades[mod(x + y * 2 + z, 3)];

// A weave (straw, wicker): two shades in a checker of the two axes given.
export const weave = (a: number, b: number, light: number, dark: number): number => (mod(a + b, 2) === 0 ? light : dark);
