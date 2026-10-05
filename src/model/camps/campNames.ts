// A bandit camp's name (campGate.ts tells it at its gate), from the seed and
// where it stands, the same every time: an outlaws' name for their holdfast,
// one of ten thousand, four ways of naming it: whose it is ("Redhand's Lair"),
// what's been seen there ("the Crow's Roost", "Gallows Hollow"), what it is in
// a word ("the Sunken Stockade"), who's there ("Den of Thieves"). (The crypts'
// names: crypts/cryptNames.ts; the caves': caves/caveNames.ts.)

import { hashUnit, pickAt } from '../../util/random';

export const CAMP_NAMES = {
  // Whose it is: "Redhand's Lair".
  owners: ["Redhand's", "One-Eye's", "Black Tom's", "the Butcher's", "Crookback's", "Old Gil's", "the Fox's", "Grimwald's", "Scarface's", "the Widow's", "Mad Hob's", "Long Will's", "the Hangman's", "Ratcatcher's", "Bloody Bess's", "Gutter Jack's", "the Tinker's", "Halfhand's", "Mother Grue's", "the Brothers'", "Sly Edric's", "Barrow Ned's", "Cutpurse Kate's", "the Miller's", "Ironjaw's", "Snake-Eye's", "Toothless Tam's", "the Pardoner's", "Wat Tyler's", "Grey Morwen's", "Little John's", "Pockmark's", "the Bishop's", "Badger Bill's", "the Twins'", "Hookhand's", "Squint's", "Old Nan's", "Rufus's", "the Poacher's", "Ragged Rob's", "Blind Osric's", "Copperhair's", "the Smuggler's", "Gallows Gwen's", "Thatcher's", "Dirty Dunstan's", "the Deserter's", "Fat Walter's", "Whistling Wat's", "the Reeve's", "Lame Leofric's", "Cold Hal's", "Merry Meg's", "Burnt Bertram's", "the Mute's", "Knuckles'", "Red Agnes's", "Grimsby's", "Jack Straw's", "Wolf-Tooth's", "the Friar's", "Cross-Eyed Cuthbert's", "Sour Simon's", "the Ferryman's", "Mag Mudd's", "Brokenose's", "Tall Tom's", "Shiv's", "the Gravedigger's", "Ash-Face's", "Eel's", "Godric the Grim's", "Pike's", "the Skinner's", "Old Crow's", "Stubbs's", "Hedgehog's", "the Outlaw's", "Weasel's"],
  // What it is: a stockade, a holdfast.
  holds: ['Stockade', 'Camp', 'Hold', 'Den', 'Roost', 'Lair', 'Nest', 'Hideout', 'Fort', 'Haunt', 'Keep', 'Pale', 'Redoubt', 'Bastion', 'Lodge', 'Warren', 'Rookery', 'Holdfast', 'Palisade', 'Encampment', 'Fastness', 'Nook', 'Snug', 'Retreat', 'Bolthole', 'Earthwork', 'Barricade', 'Watch', 'Muster', 'Huddle', 'Kennel', 'Pen', 'Hovel', 'Shack', 'Hall', 'Rest', 'Hole', 'Perch', 'Steading', 'Garrison'],
  // What it's like, or what's been seen there: "the Crow's Roost", "Gallows Hollow".
  marks: ["Crow's", 'Gallows', 'Cutthroat', 'Blackpike', 'Rook', 'Bloodstone', 'Wolfsbane', 'Thornwall', 'Broken Wheel', 'Hanged Man', 'Rusty Blade', 'Raven', 'Skull', 'Cinder', 'Dead Oak', "Mourner's", 'Crooked Knife', 'Gibbet', 'Black Dog', 'Stolen Bell', 'Red Mill', 'Bramble', 'Nettle', 'Hemlock', 'Foxglove', 'Wormwood', 'Dagger', 'Flint', 'Bonepile', 'Grave', 'Wolf', "Boar's", 'Hog', 'Magpie', 'Vulture', 'Jackdaw', 'Owl', 'Adder', 'Toad', 'Rat', "Bandit's", "Thief's", "Outcast's", "Brigand's", 'Moot', 'Burnt Mill', 'Drowned Man', 'Lost Coin', 'Three Gallows', 'Split Oak', "Blind Man's", 'Iron Gate', 'Red Hand', 'Black Hood', 'Seven Swords', 'Weeping Stone', 'Crookhorn', 'Coldwater', 'Mudwater', 'Briar', 'Sallow', 'Hollin', 'Gorse', 'Blackthorn', 'Rotwood', 'Hangman Tree', 'Kettle', 'Crossbones', 'Gutter', 'Barrow'],
  places: ['Hollow', 'Clearing', 'Rise', 'Camp', 'Roost', 'Stockade', 'Dell', 'Hill', 'Field', 'Ridge', 'Glade', 'Copse', 'Heath', 'Moor', 'Knoll', 'Brake', 'Thicket', 'Spinney', 'Coombe', 'Gully', 'Bottom', 'Ford', 'Crossing', 'Mire', 'Fen', 'Tor', 'Scar', 'Edge', 'Shaw', 'Holt', 'Wold', 'Lea', 'Green', 'End', 'Hatch', 'Gate', 'Cross', 'Wood', 'Bank', 'Dale'],
  // What it is, in a word: "the Sunken Stockade".
  adjectives: ['Hidden', 'Bloody', 'Rotten', 'Crooked', 'Black', 'Sunken', 'Burnt', 'Ragged', 'Grim', 'Silent', 'Thieving', 'Lawless', 'Cursed', 'Forsaken', 'Hungry', 'Drunken', 'Muddy', 'Broken', 'Rusty', 'Smoky', 'Wicked', 'Grey', 'Red', 'Cold', 'Foul', 'Lost', 'Last', 'Old', 'Mean', 'Sour', 'Starving', 'Restless', 'Shadowed', 'Squalid', 'Wretched', 'Godless', 'Moonless', 'Thorny', 'Tangled', 'Leaning', 'Sorry', 'Merry', 'Hanging', 'Howling', 'Bitter', 'Low', 'Lonely', 'Ashen', 'Charred', 'Crumbling', 'Stinking', 'Bleak', 'Ruined', 'Shabby', 'Rough', 'Wild', 'Dark', 'Gloomy', 'Sly', 'Nameless'],
  // Who's there, or what it's known for: "Den of Thieves", "Hold of the Red Hand".
  epithets: ['Thieves', 'Cutthroats', 'Knaves', 'Rogues', 'Brigands', 'Outlaws', 'Cutpurses', 'Poachers', 'Deserters', 'Exiles', 'the Red Hand', 'the Black Hood', 'the Broken Crown', 'the Hanged', 'the Lost', 'Ill Repute', 'Broken Oaths', 'Ashes', 'Bones', 'Ravens', 'Crows', 'Wolves', 'Rats', 'the Damned', 'Sorrows', 'Shadows', 'the Gallows', 'Stolen Gold', 'Dead Men', 'Bad Luck', 'Last Chances', 'the Fallen', 'Many Knives', 'No Mercy', 'Old Grudges', 'Hard Men', 'Black Ale', 'Spilt Blood', 'Empty Purses', 'Wicked Deeds'],
} as const;

// How many names there are to be had, all told (each of its four ways).
export const CAMP_NAME_COUNT = CAMP_NAMES.owners.length * CAMP_NAMES.holds.length + CAMP_NAMES.marks.length * CAMP_NAMES.places.length + CAMP_NAMES.adjectives.length * CAMP_NAMES.holds.length + CAMP_NAMES.holds.length * CAMP_NAMES.epithets.length;

// A camp's name, one of four ways (each as likely as the names it makes): whose it is ("Redhand's Lair"), what's been
// seen there ("the Crow's Roost", "Gallows Hollow"), what it is in a word ("the Sunken Stockade"), who's there ("Den of
// Thieves").
export function campName(camp: { x: number; z: number }, seed: number): string {
  const { owners, holds, marks, places, adjectives, epithets } = CAMP_NAMES;
  const pick = pickAt(camp.x, camp.z, seed * 131);
  const form = hashUnit(camp.x, camp.z, seed * 131 + 600) * CAMP_NAME_COUNT;
  const [a, b, c] = [owners.length * holds.length, marks.length * places.length, adjectives.length * holds.length];
  if (form < a) return `${pick(owners, 601)} ${pick(holds, 602)}`;
  if (form < a + b) {
    const mark = pick(marks, 603);
    return `${mark.endsWith("'s") ? 'the ' : ''}${mark} ${pick(places, 604)}`;
  }
  if (form < a + b + c) return `the ${pick(adjectives, 605)} ${pick(holds, 606)}`;
  return `${pick(holds, 607)} of ${pick(epithets, 608)}`;
}
