// What quests look like and say, in the board's window and the journal:
// a quest's picture, its notice's words, and how dangerous it is in a word.

import { makeEnemy } from '../model/enemies/enemies';
import type { Quest } from '../model/quests/quests';
import { hashUnit } from '../util/random';
import { lootIcon } from '../view/ui/itemIcons';
import type { MenuIcon } from '../view/ui/menu';
import { voxelIcon } from '../view/ui/voxelIcon';
import { humanBust } from '../view/meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../view/meshes/enemy/wolfVoxels';

// What each notice says, by what it asks (one of three, the same for a given notice).
const NOTICES = {
  'kill:wolf': [
    'The wolves took three sheep this week. Thin the pack before they come for the lambs.',
    'Howling by the old fence every night. Nobody in the village has slept in days.',
    'A pack has been circling the woodcutters. Drive them off for good.',
  ],
  'kill:bandit': [
    "Bandits robbed the miller's cart on the road. Make them pay for it.",
    'Cutthroats are camped too close for comfort. Clear them out.',
    "They took the tax chest, and the tax collector's boots. Deal with them.",
  ],
  'collect:wolf': [
    'The tanner wants pelts before the frost. Good ones, mind, not moth-eaten.',
    "Winter's coming and the children need warm cloaks. Bring wolf pelts.",
    "Pelts from the pack that's been at the flock. The shepherd will sleep better.",
  ],
  'collect:bandit': [
    'Every one of those bandits wears a tin token. Bring them back as proof.',
    'The reeve pays for tokens taken off bandits, no questions asked.',
    "Proof or it didn't happen: bring back their tokens.",
  ],
} as const;
export const notice = (q: Quest, seed: number) => {
  const lines = NOTICES[`${q.kind}:${q.foe}`];
  return lines[Math.floor(hashUnit(q.board * 131 + Number(q.key.split(':')[1]), seed % 1_000_003, 97) * lines.length)];
};
export const DANGER = { trivial: 'Easy', even: 'Fair', tough: 'Tough', hard: 'Hard', deadly: 'Deadly' } as Record<string, string>;

// A quest's picture: the foe's head to slay, or the thing to bring.
export const questIcon = (q: Quest): MenuIcon => (size) => {
  if (q.item) return lootIcon(q.item)(size);
  if (q.foe === 'wolf') return voxelIcon('quest:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), size);
  const { human } = makeEnemy(0, 'bandit', q.x, q.z);
  return voxelIcon(`quest:bandit:${q.x}:${q.z}`, () => humanBust(human!.look, human!.equipment, 'right'), size);
};
