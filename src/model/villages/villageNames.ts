// A village's name (villageWelcome.ts tells it as the hero comes in), from the seed and where its well stands, the
// same every time: an old country name, made the way such names were: a word for what grew, stood or lived there,
// or whose it was, run into one for the place ("Ashford", "Bramblewick", "Hartley"); now and then told apart from a
// neighbour's ("Little Ashford", "Upper Hartley"). (The bandit camps': camps/campNames.ts.)

import { hashUnit, pickAt } from '../../util/random';

export const VILLAGE_NAMES = {
  // What grew, stood or lived there, or whose it was: the name's first part.
  stems: [
    'Ash', 'Oak', 'Thorn', 'Bramble', 'Elder', 'Hazel', 'Willow', 'Alder', 'Birch', 'Holly', 'Rush', 'Reed', 'Fern', 'Heath', 'Moss', 'Mill',
    'Brook', 'Stone', 'Chalk', 'Clay', 'Sand', 'Marsh', 'Fen', 'Mere', 'Pool', 'Kings', 'Queens', 'Bishops', 'Abbots', 'Monks', 'Friars', 'Knights',
    'Shep', 'Cold', 'Black', 'White', 'Red', 'Green', 'Long', 'Broad', 'High', 'Low', 'Fox', 'Wolf', 'Hart', 'Buck', 'Hare', 'Crow',
    'Rook', 'Swan', 'Hawk', 'Lark', 'Wren', 'Cow', 'Ox', 'Bram', 'Ed', 'Al', 'Wil', 'Har', 'Thurl', 'Ather', 'Wether', 'Ald',
    'Brad', 'Stan', 'Mar', 'Bar', 'Cran', 'Chester', 'Bourne', 'Wey', 'Ken', 'Wal', 'Bex', 'Dun', 'Glen', 'Hollin', 'Lin', 'Pen',
    'Ross', 'Sel', 'Tam', 'Ux', 'Wynd', 'Yar', 'Barrow', 'Bell', 'Church', 'Cross', 'Dyke', 'Ford', 'Hay', 'Kirk', 'Market', 'Wick',
    'Apple', 'Cherry', 'Pear', 'Plum', 'Rye', 'Barley', 'Wheat', 'Flax', 'Hemp', 'Honey', 'Butter', 'Salt', 'Iron', 'Copper', 'Silver', 'Gold',
  ],
  // The place: a ford, a farm, a clearing, a hill.
  tails: [
    'ford', 'ton', 'by', 'ham', 'wick', 'field', 'ley', 'worth', 'stead', 'bury', 'borough', 'combe', 'dale', 'den', 'don', 'hurst',
    'holm', 'mere', 'moor', 'thorpe', 'well', 'wood', 'bridge', 'brook', 'cote', 'gate', 'hithe', 'hope', 'over', 'stow', 'thwaite', 'wold',
    'lea', 'leigh', 'stone', 'cliffe', 'ridge', 'hill', 'marsh', 'church',
  ],
  // Told apart from a neighbour's: "Little Ashford", "Upper Hartley".
  qualifiers: ['Little', 'Great', 'Upper', 'Lower', 'Nether', 'Old', 'East', 'West', 'North', 'South', 'Church', 'Kings', 'Saint', 'Much', 'Chipping', 'Bishops'],
} as const;

const QUALIFIED = 0.2; // of villages, a word before their name

// The two parts run into one, never three of a letter together ("Mill" and "ley": "Milley", not "Millley"; "Ed" and
// "den": "Edden").
const joined = (stem: string, tail: string): string => (stem.at(-1) === tail[0] && stem.at(-2) === tail[0] ? stem + tail.slice(1) : stem + tail);

export function villageName(village: { x: number; z: number }, seed: number): string {
  const { stems, tails, qualifiers } = VILLAGE_NAMES;
  const pick = pickAt(village.x, village.z, seed * 151);
  const stem = pick(stems, 701);
  let tail = pick(tails, 702);
  if (tail === stem.toLowerCase()) tail = tails[(tails.indexOf(tail) + 1) % tails.length]; // (not "Fordford")
  const name = joined(stem, tail);
  const qualifier = pick(qualifiers, 703);
  return hashUnit(village.x, village.z, seed * 151 + 700) < QUALIFIED && qualifier !== stem ? `${qualifier} ${name}` : name; // (not "Kings Kingsford")
}
