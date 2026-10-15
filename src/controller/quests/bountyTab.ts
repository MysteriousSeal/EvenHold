// The notice board's Bounties tab (questBoardPanel.ts): its wanted posters (model/quests/bounties.ts), each who and
// what they did, roughly where, how dangerous, the reward, and when it comes down; Accept sets the hunt on (a red pin
// on the map), Hand in pays once the grisly sack's in the bag. A bounty taken here whose poster's since come down, its
// target slain, still listed: to hand in.

import type { GameModel } from '../../model/GameModel';
import { MAX_BOUNTIES, TROPHY, type Poster } from '../../model/quests/bounties';
import { boardSpot } from '../../model/quests/noticeBoards';
import { inMeters, type Quest } from '../../model/quests/quests';
import { clockAt } from '../../model/clock';
import { coinParts } from '../../view/ui/coins';
import { detailParts } from '../../view/ui/menuDetail';
import { line } from '../../view/ui/dom';
import { lootIcon } from '../../view/ui/itemIcons';
import type { MenuIcon, MenuSlot, MenuTab } from '../../view/ui/menu';
import { questFacts, questIcon } from './questText';

// A poster's picture: the outlaw's face, the wolf's or boar's head; a bear's or a lynx's, the sack it'll fill.
const posterIcon = (p: Poster): MenuIcon => (p.foe === 'bandit' || p.foe === 'wolf' || p.foe === 'boar' ? questIcon({ foe: p.foe, item: null, x: p.x, z: p.z } as Quest) : lootIcon(TROPHY));

export function bountyTab(model: GameModel, board: () => number, refresh: () => void): MenuTab {
  const { bounties } = model;
  const shown = new WeakMap<MenuSlot, Poster>();
  let said = '';
  let saidFor = '';
  const posters = (): Poster[] => {
    const up = bounties.postersAt(board());
    const done = bounties.taken.filter((t) => t.poster.board === board() && !up.some((p) => p.key === t.poster.key)).map((t) => t.poster); // (down since, slain: to hand in)
    return [...up, ...done];
  };
  const stateOf = (p: Poster) => {
    const taken = bounties.takenOf(p.key);
    if (bounties.isCompleted(p.key)) return { badge: 'Paid', tone: 'past' as const };
    if (!taken) return { badge: 'Wanted', tone: undefined };
    return taken.slain ? { badge: bounties.ready(taken) ? '✓ Ready' : 'Slain', tone: 'ready' as const } : { badge: 'Hunting', tone: 'progress' as const };
  };
  const slotOf = (p: Poster): MenuSlot => {
    const { badge, tone } = stateOf(p);
    const slot: MenuSlot = { key: p.key, icon: posterIcon(p), title: p.name, badge, badgeTone: tone, dim: bounties.isCompleted(p.key), tag: coinParts(p.copper), note: `Level ${p.level} · ${p.where}` };
    shown.set(slot, p);
    return slot;
  };

  const detail = (slot: MenuSlot | null) => {
    const pane = document.createElement('div');
    const p = slot && shown.get(slot);
    if (!p) {
      pane.append(line('menu-detail-hint', 'Pick a poster to read it.'));
      return pane;
    }
    if (saidFor !== p.key) said = '';
    const taken = bounties.takenOf(p.key);
    const { icon, facts, fact } = detailParts(posterIcon(p)(72), 'menu-detail-facts quest-facts');
    const from = boardSpot(model, board()) ?? model.hero;
    fact('Where', [`${p.where}, about ${inMeters(Math.round(Math.hypot(p.x - from.x, p.z - from.z) / 10) * 10)}`]);
    if (p.pack) fact('With it', [`A pack of ${p.pack} wolves`]);
    questFacts(fact, { item: null, level: p.level, copper: p.copper } as Quest, model.hero.level, bounties.xpFor(p));
    const down = clockAt(p.ends);
    if (!bounties.isCompleted(p.key)) fact('Comes down', [model.minutes >= p.ends ? 'Already down' : `Day ${down.day}, ${down.time}`]);
    const what = p.kind === 'outlaw' ? '' : `a ${p.foe === 'wolf' ? 'grey wolf' : p.foe} `; // (an outlaw's crime says who)
    pane.append(icon, line('menu-detail-name', `Wanted: ${p.name}`), line('menu-detail-about', `“Wanted, dead: ${p.name}, ${what}${p.crime}. Last seen ${p.where}. Bring proof to this board.”`), facts);
    if (bounties.isCompleted(p.key)) {
      pane.append(line('menu-detail-said quest-completed', said || 'Paid. The poster is crossed through.'));
      return pane;
    }
    const why = taken ? (taken.slain ? (bounties.ready(taken) ? '' : 'Bring the grisly sack: it lies where the target fell.') : '') : bounties.full ? `You've taken ${MAX_BOUNTIES} bounties already.` : '';
    const buttons = document.createElement('div');
    buttons.className = 'quest-buttons';
    const main = document.createElement('button');
    main.className = 'menu-detail-button';
    main.textContent = taken ? 'Hand in' : 'Accept';
    main.classList.toggle('unavailable', !!why || (!!taken && !bounties.ready(taken)));
    main.addEventListener('click', () => {
      if (taken && !taken.slain) return;
      said = why || (taken ? bounties.handIn(p.key) ?? '' : bounties.accept(p) ? 'Taken. It is pinned on your map (M).' : '');
      saidFor = p.key;
      refresh();
    });
    buttons.append(main);
    if (taken && !taken.slain) {
      const drop = document.createElement('button');
      drop.className = 'quest-abandon';
      drop.textContent = 'Abandon';
      drop.addEventListener('click', () => {
        bounties.abandon(p.key);
        said = 'Abandoned. The poster stays up.';
        saidFor = p.key;
        refresh();
      });
      buttons.append(drop);
    }
    pane.append(line('menu-detail-said', said || why || (taken && !taken.slain ? 'The hunt is on. Look for the red pin on your map.' : '')), buttons);
    return pane;
  };

  return {
    name: 'Bounties',
    slots: () => ({ cells: posters().map(slotOf), columns: 1, rows: true }),
    detail,
    header: () => line('quest-board-lead', `Wanted, dead. Fresh posters each week; the farther from where you set out, the richer the bounty. ${bounties.taken.length}/${MAX_BOUNTIES} taken.`),
    footer: () => {
      const row = document.createElement('div');
      row.className = 'menu-purse';
      row.append(...coinParts(model.hero.money, true));
      return row;
    },
  };
}
