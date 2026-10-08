// What quests look like and say, in the board's window and the journal:
// a quest's picture, its notice's words, and how dangerous it is in a word.

import { innWants, type InnWant } from '../../model/inn/tavernShop';
import { makeEnemy } from '../../model/enemies/enemies';
import { coinParts } from '../../view/ui/coins';
import { difficulty } from '../../model/enemies/enemyLevels';
import type { Quest, QuestFoe } from '../../model/quests/quests';
import type { QuestItemId } from '../../model/quests/questItems';
import { hashUnit } from '../../util/random';
import { lootIcon } from '../../view/ui/itemIcons';
import type { MenuIcon } from '../../view/ui/menu';
import { voxelIcon } from '../../view/ui/voxelIcon';
import { humanBust } from '../../view/meshes/human/humanFigure';
import { WOLF_PALETTE, buildHead } from '../../view/meshes/enemy/wolfVoxels';
import { BOAR_PALETTE, buildBoarHead } from '../../view/meshes/enemy/boarVoxels';

// What a "slay" notice says, by its foe (one of three; for any notice, the same one always).
const NOTICES: Record<QuestFoe, readonly string[]> = {
  wolf: [
    'The wolves took three sheep this week. Thin the pack before they come for the lambs.',
    'Howling by the old fence every night. Nobody in the village has slept in days.',
    'A pack has been circling the woodcutters. Drive them off for good.',
  ],
  bandit: [
    "Bandits robbed the miller's cart on the road. Make them pay for it.",
    'Cutthroats are camped too close for comfort. Clear them out.',
    "They took the tax chest, and the tax collector's boots. Deal with them.",
  ],
  boar: [
    'Boars are tearing up the turnip rows every night. Put a stop to it.',
    'A sounder of boars charged the swineherd. He is still up a tree.',
    'The miller wants boar on his table, and fewer boars in his barley.',
  ],
};
// What a "bring" notice says, by what it asks for (one of two).
const WANTED: Record<QuestItemId, readonly string[]> = {
  wolfPelt: ['The tanner wants pelts before the frost. Good ones, mind, not moth-eaten.', "Winter's coming and the children need warm cloaks. Bring wolf pelts."],
  alphaFang: ['The healer grinds the fangs of pack leaders into her remedies. Do not ask what for.', 'Alpha fangs for the smith: he sets them in charms for the militia.'],
  wolfClaw: ['Claws, to prove the pack is thinning. The reeve pays for each.', 'The old hunter wants claws for his necklace. He is running out of room.'],
  wolfTail: ['Tails for the harvest dance. Bushy ones, if you please.', "A tail for every hen they've taken. The farmer is keeping count."],
  banditToken: ['Every one of those bandits wears a tin token. Bring them back as proof.', 'The reeve pays for tokens taken off bandits, no questions asked.'],
  redBandanna: ['They tie red rags round their faces. Bring them back, and we will know how many are left.', 'The weaver swears those bandannas were cut from her stolen cloth.'],
  lockpicks: ['Someone keeps opening our cellars at night. Take their lockpicks away.', 'Bring back their picks and the doors in this village can stay shut.'],
  stolenLetter: ['They robbed the courier and took his letters. Bring them back, unopened.', "Letters meant for the lord's steward. He would like them back before he is missed."],
  boarHide: ['The cobbler needs thick hides for boots that last a winter.', 'Boar hide makes the best jerkins. Bring some, and the tanner will be grateful.'],
  bristleTuft: ['Bristles for brushes: the painter has worn his down to the wood.', "The broom-maker swears by boar bristle. Bring tufts, as many as you can."],
  wildTruffle: ["The boars root up truffles in the woods. Beat them to it, or take them off them.", "The innkeeper pays well for truffles. Follow the boars' snouts."],
  greatTusk: ['The carver wants great tusks, the big curved ones, for his finest work.', 'A great tusk over the hearth brings luck, the old folk say. Bring a few.'],
};

// An inn's orders (inn/tavernShop.ts INN_WANTS): a woodworker's cups wanted.
const ORDERED: Record<InnWant, readonly string[]> = {
  carvedTankard: ['The bar is short of tankards again: the patrons walk off with them. Carved ones, oak, as many as asked.', 'Tankards wanted for the inn. The innkeeper pays well for good carving.'],
  woodenBowl: ['The kitchen is down to its last bowls. Turned wooden ones, plain and sound.', 'Bowls for the inn: stew is served in them, and they crack. Bring a few.'],
};

export const notice = (q: Quest, seed: number) => {
  const lines = innWants(q.item) ? ORDERED[q.item] : q.item ? WANTED[q.item] : NOTICES[q.foe];
  return lines[Math.floor(hashUnit(q.board * 131 + Number(q.key.split(':')[1]), seed % 1_000_003, 97) * lines.length)];
};
const DANGER = { trivial: 'Easy', even: 'Fair', tough: 'Tough', hard: 'Hard', deadly: 'Deadly' } as Record<string, string>;

// A quest's picture: the foe's head to slay, or the thing to bring.
const FOE_ICONS: Record<QuestFoe, (q: Quest, size: number) => HTMLCanvasElement> = {
  wolf: (_q, size) => voxelIcon('quest:wolf', () => ({ grid: buildHead(), palette: WOLF_PALETTE }), size),
  boar: (_q, size) => voxelIcon('quest:boar', () => ({ grid: buildBoarHead(), palette: BOAR_PALETTE }), size),
  bandit: (q, size) => {
    const { human } = makeEnemy(0, 'bandit', q.x, q.z); // a bandit of those parts, as dressed
    return voxelIcon(`quest:bandit:${q.x}:${q.z}`, () => humanBust(human!.look, human!.equipment, 'right'), size);
  },
};
export const questIcon = (q: Quest): MenuIcon => (size) => {
  if (q.item) return lootIcon(q.item)(size);
  return FOE_ICONS[q.foe](q, size);
};

// A quest's danger (against the hero's level), reward and experience, as facts in its detail pane.
export function questFacts(fact: (label: string, value: Array<string | HTMLElement>) => void, q: Quest, heroLevel: number, xp: number): void {
  const danger = document.createElement('span');
  danger.className = 'quest-danger';
  danger.dataset.difficulty = innWants(q.item) ? 'trivial' : difficulty(q.level, heroLevel); // (an order: no foes to it)
  danger.textContent = `${innWants(q.item) ? 'None' : DANGER[danger.dataset.difficulty]} · level ${q.level}`;
  fact('Danger', [danger]);
  fact('Reward', coinParts(q.copper));
  fact('Experience', [`${xp} XP`]); // to the hero now
}
