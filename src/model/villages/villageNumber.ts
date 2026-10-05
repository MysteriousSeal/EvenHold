// A streamed world's village's own number (its notice board's: quests are by it), from where its well stands: the
// same however its regions come to be made; and back, where one of a number stands (to make its region before it's
// needed: a save's quests' boards). (A classic world's villages are numbered by their place in its list.)

export const villageNumber = (village: { x: number; z: number }, depth: number): number => village.x * depth + village.z;

export const villagePlace = (n: number, depth: number): { x: number; z: number } => ({ x: Math.floor(n / depth), z: n % depth });
