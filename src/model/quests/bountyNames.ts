// Who a bounty's posted for (bounties.ts), from a roll: a named outlaw ("Wat Cutpurse"), a beast the country's given
// a name ("Old Grizzle"), the leader of a wolf pack ("Greymuzzle"); and what they did, for the poster ("who took the
// miller's daughter's teeth"). The name's over the foe once it's found.

import { pickAt } from '../../util/random';

export type BountyKind = 'outlaw' | 'beast' | 'pack';

export const BOUNTY_NAMES = {
  given: ['Wat', 'Hob', 'Jack', 'Tom', 'Will', 'Ned', 'Dick', 'Gib', 'Hal', 'Rafe', 'Kit', 'Col', 'Godric', 'Osric', 'Edric', 'Dunstan', 'Agnes', 'Bess', 'Mag', 'Gwen', 'Joan', 'Kate', 'Maud', 'Alys'],
  outlawed: ['Cutpurse', 'Halfhand', 'the Knife', 'Crookback', 'Redbeard', 'One-Ear', 'Blackhood', 'the Tanner', 'Gallowsbird', 'Ratface', 'the Flayer', 'Toothless', 'Longshanks', 'Hookhand', 'the Weasel', 'Brokenose', 'Mudd', 'the Butcher', 'Saltbones', 'Grimwald'],
  beasts: ['Old Grizzle', 'the Widow-maker', 'Black Tusk', 'Bramblehide', 'the Mangler', 'Old Scratch', 'Gutripper', 'the Hollow Hunger', 'Mossback', 'Red Maw', 'the Shepherd-taker', 'Ironhide'],
  leaders: ['Greymuzzle', 'Old One-Eye', 'the Night Howl', 'Silverback', 'Ragged Ear', 'Bloodfang', 'the Pale Bitch', 'Hungry Tom', 'Frostjaw', 'the Lean Grey'],
  crimes: {
    outlaw: ["who took the miller's daughter's teeth", 'who burned the tithe barn with the tithe in it', "who robbed the priest and wore his cassock to the ale-house", 'who hanged a reeve with his own chain', 'who sold the same cow to three farms', "who knifed a pedlar for his boots and they didn't fit", 'who stole the bell from the chapel, clapper and all', "who drank the abbot's cellar dry and set the rest alight"],
    beast: ['that took two shepherds and a mule', "that broke into the church and ate the bell-rope", 'that has been at the sheepfolds every new moon', "that left the charcoal-burner in three places", "that no hound will follow"],
    pack: ['that run the sheep off the hills every night', 'that took a child from the lane at dusk', "that have the carrier's horses spooked past using", 'that dug up the churchyard'],
  },
} as const;

// A bounty's name and its line, by the roll (salt: the poster's).
export function bountyName(kind: BountyKind, x: number, z: number, salt: number): { name: string; crime: string } {
  const pick = pickAt(x, z, salt);
  const crime = pick(BOUNTY_NAMES.crimes[kind], 71);
  if (kind === 'outlaw') return { name: `${pick(BOUNTY_NAMES.given, 72)} ${pick(BOUNTY_NAMES.outlawed, 73)}`, crime };
  return { name: pick(kind === 'beast' ? BOUNTY_NAMES.beasts : BOUNTY_NAMES.leaders, 74), crime };
}
