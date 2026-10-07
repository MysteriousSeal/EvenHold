// The hero's bag, opened and closed with B, in the shared menu
// (view/ui/menu.ts): its four bag sockets on top, then what's carried in rows
// by what it is (bag.ts BAG_GROUPS, each group under its title), a slot to
// each stack (bagStacks.ts) with its voxel icon and how many, the free slots
// at the bottom; hover one for what it is, the thing turning above. Drag loot
// out onto the world to drop it; drag gear onto the hero sheet (C) to wear
// it, or onto the world to put it down; drag a thing onto another slot of its
// group to swap them. The game plays on around it: it only takes Escape and B.
// While trading (a shop's window open beside it), right-clicking what the
// keeper would buy, or dragging it onto their window, sells it; what they
// wouldn't is greyed out. Away from shops, each thing says what it'd fetch.
// A button by the purse tidies it (bagStacks.ts: sortedBag).
import { POTIONS, POTION_COOLDOWN, isPotion, potionText } from '../../model/loot/potions';
import { setAction } from '../../model/hero/actionBar';
import { coinParts, coinWords } from '../../view/ui/coins';
import type { GameModel } from '../../model/GameModel';
import { BAG_GROUPS, groupOf, isLootItem, kindOf, type BagItem } from '../../model/hero/bag';
import { bagStacks, moveSlot, sortedBag } from '../../model/hero/bagStacks';
import { BAG_SOCKETS, ROOM_PER_BAG, bagRoom, fitBag, unfitBag } from '../../model/hero/bagSlots';
import { isBagItem, type BagId } from '../../model/loot/bags';
import { SLOT_NAMES } from '../../model/human/equipment';
import { canWear, gearName, rarityOf, slotOfGear, type GearKey } from '../../model/human/items/gear';
import { LOOT, LOOT_QUALITY } from '../../model/loot/loot';
import { PROVISIONS, givesText, isProvision } from '../../model/loot/provisions';
import { sellValue } from '../../model/shops/sellValue';
import { againstWorn, gearLines } from './gearLines';
import { createMenu, toned, type LineTone, type Menu, type MenuLine, type MenuSlot } from '../../view/ui/menu';
import { bagIcon, bagItemPreview } from '../../view/ui/itemIcons';
import { voxelIcon } from '../../view/ui/voxelIcon';
import { BAG_MODELS } from '../../view/meshes/loot/bagVoxels';
import './inventoryPanel.css';

const COLUMNS = 14; // (wide and low: with every bag on, eight across ran off the bottom of the screen)
const SOCKET_ROW = BAG_SOCKETS; // the sockets, the first row; the bag's own slots from there (on a row of their own: the separator spans the grid)

// A shop the hero's trading with: what its keeper would buy, for how much, and selling it them.
export interface Seller {
  wants(item: BagItem): boolean;
  price(item: BagItem): number;
  sell(item: BagItem): void;
}

// Onto the shop's window (the one with its keeper talking).
const ontoShop = (over: Element | null) => !!over?.closest('.menu')?.querySelector('.shop-talk');

// Whether a tooltip line plays one of these parts (a hint, a price).
const playing = (line: MenuLine, ...tones: LineTone[]) => typeof line !== 'string' && tones.includes(line.tone);

// `at`: the bag's slot it's in (what's dropped from it, off that very stack).
function slotFor(model: GameModel, item: BagItem, count: number, seller: Seller | null, at?: number): MenuSlot {
  const base = baseSlot(model, item, count, at);
  const value = sellValue(item);
  const lines = base.lines ?? [];
  const slot = value === null ? base : { ...base, lines: [...lines.filter((l) => !playing(l, 'hint')), toned('price', `Sells for ${coinWords(value)}`), ...lines.filter((l) => playing(l, 'hint'))] }; // (its price before its hints: those last)
  if (!seller) return slot;
  if (!seller.wants(item)) return { ...slot, dim: true, lines: [...(slot.lines ?? []), toned('loss', 'Not bought here')] };
  // Trading: right-click (or drag onto the shop) sells it, instead of what it'd do.
  const dragOut = slot.dragOut;
  return {
    ...slot,
    lines: [...(slot.lines ?? []).filter((line) => !playing(line, 'hint', 'price')), toned('price', `Right-click to sell for ${coinWords(seller.price(item))}`)], // (its hints and price, for the keeper's)
    alt: () => seller.sell(item),
    dragOut: (over) => (ontoShop(over) ? seller.sell(item) : dragOut?.(over)),
  };
}

function baseSlot(model: GameModel, item: BagItem, count: number, at?: number): MenuSlot {
  if (isLootItem(item)) {
    return {
      icon: bagIcon(item),
      count,
      title: LOOT[item].name,
      tone: LOOT_QUALITY[item],
      lines: isPotion(item)
        ? [toned('kind', kindOf(item)), toned('stat', potionText(item)), toned('flavor', POTIONS[item].about), toned('hint', `Right-click to drink it (then ${POTION_COOLDOWN} s before another), or drag it onto the action bar`)]
        : isProvision(item)
        ? [toned('kind', kindOf(item)), toned('stat', givesText(item)), toned('hint', `Right-click to ${PROVISIONS[item].drink ? 'drink' : 'eat'} it, or drag it onto the action bar`)]
        : isBagItem(item)
          ? [toned('kind', kindOf(item)), toned('stat', `+${ROOM_PER_BAG} bag slots`), toned('hint', 'Drag onto a bag socket (or right-click) to fit it')]
          : [toned('kind', kindOf(item))],
      alt: isPotion(item)
        ? () => (model.drinkPotion(item) ? `You drink the ${LOOT[item].name}.` : (model.hero.potionCooldown ?? 0) > 0 ? `Not yet: another potion in ${Math.ceil(model.hero.potionCooldown!)} s.` : '')
        : isProvision(item)
        ? () => (model.consume(item) ? `You ${PROVISIONS[item].drink ? 'drink' : 'eat'} the ${LOOT[item].name}.` : model.hero.eating ? 'Finish what you have first.' : '')
        : isBagItem(item)
          ? () => (fitBag(model.hero, item) ? `The ${LOOT[item].name} is fitted: ${ROOM_PER_BAG} more slots.` : 'Every bag socket is taken.')
          : undefined,
      dragOut: (over) => {
        const action = over?.closest<HTMLElement>('.action-slot'); // onto the action bar: food or drink there, a shortcut to it
        if (action) setAction(model.hero, Number(action.dataset.slot), item);
        else if (!over?.closest('.menu')) model.dropFromBag(item, at); // onto the world, not another window (off this stack)
      },
    };
  }
  const gear = item as GearKey;
  const slot = slotOfGear(gear);
  const wearable = canWear(gear, model.hero.level);
  return {
    icon: bagIcon(gear),
    count,
    title: gearName(gear),
    tone: rarityOf(gear), // (its name and frame in its rarity's colour)
    warn: !wearable, // (under its level: shown red)
    lines: [toned('kind', SLOT_NAMES[slot]), ...gearLines(gear, model.hero.level), ...againstWorn(gear, model.hero.equipment), toned('hint', wearable ? `Drag onto your hero's ${SLOT_NAMES[slot].toLowerCase()} slot to wear it` : 'Too high a level to wear yet')],
    fits: slot,
    // Only its own slot on the hero sheet takes it; the world, the ground.
    dragOut: (over) => {
      const target = over?.closest<HTMLElement>('[data-accepts]');
      if (target?.dataset.accepts === slot) model.equipFromBag(gear);
      else if (!over?.closest('.menu')) model.dropFromBag(gear, at);
    },
  };
}

// A fitted bag in socket `socket`: off with a right-click, or dragged down into the bag's slots (from `slotsFrom` on).
function socketSlot(model: GameModel, socket: number, fitted: BagId, slotsFrom: number): MenuSlot {
  const off = () => (unfitBag(model.hero, socket) ? `The ${LOOT[fitted].name} is off, back in the bag.` : 'Make room first: what it holds has nowhere else to go.');
  return {
    icon: bagIcon(fitted),
    title: LOOT[fitted].name,
    tone: 'bag',
    lines: [toned('kind', 'Bag · fitted'), toned('stat', `+${ROOM_PER_BAG} bag slots`), toned('hint', 'Right-click (or drag it down into the bag) to take it off')],
    alt: off,
    move: (to) => void (to >= slotsFrom && off()),
  };
}

// A socket with no bag in it.
const emptySocket = (): MenuSlot => ({
  icon: (size) => voxelIcon('bag-socket', () => ({ grid: BAG_MODELS.roughSack.build(), palette: BAG_MODELS.roughSack.palette, alpha: 0.22 }), size), // (a faint sack: a bag goes here)
  title: 'Bag socket',
  lines: [toned('kind', 'Empty'), `Fit a bag for ${ROOM_PER_BAG} more slots`, toned('hint', 'Drag one here, or right-click it in the bag')],
  dim: true,
});

// Under the bag: the button to tidy it, and the purse (gold, silver and copper, each by its coin).
function footer(money: number, tidy: () => void): HTMLElement {
  const line = document.createElement('div');
  line.className = 'menu-purse bag-footer';
  const sort = document.createElement('button');
  sort.className = 'menu-button bag-sort';
  sort.textContent = 'Sort';
  sort.title = `Tidy the bag: ${BAG_GROUPS.map((g) => g.title.toLowerCase()).join(', ')}`;
  sort.addEventListener('click', tidy);
  const coins = document.createElement('span');
  coins.className = 'bag-coins';
  coins.append(...coinParts(money, true));
  line.append(sort, coins);
  return line;
}

// Returns the bag's menu, and the function to call each frame (it redraws
// the bag when what's in it changed).
// `trade(seller)`: a shop opened beside it (null: closed).
export function createInventoryPanel(model: GameModel): { menu: Menu; update(): void; trade(seller: Seller | null): void } {
  let seller: Seller | null = null;
  const menu = createMenu({
    title: 'Bag',
    toggleKey: 'KeyB',
    keyHints: false,
    modal: false,
    tabs: [
      {
        name: 'Bag',
        // Each thing in its own slot, in rows by what it is (bag.ts BAG_GROUPS:
        // a titled header over each group carried, free slots at the bottom),
        // where the hero's put it in its group; drag one onto another of its
        // group's to swap them.
        slots: () => {
          const { hero } = model;
          const room = bagRoom(hero);
          // The sockets on top, a row to themselves: a fitted bag (right-click, or drag it down into the bag, to take it
          // off), or an empty socket; then the bag's own slots.
          const top: Array<MenuSlot | null> = hero.bags.map((fitted, s) => (fitted ? socketSlot(model, s, fitted, SOCKET_ROW) : emptySocket()));
          const { layout, counts } = bagStacks(hero.bag, hero.bagOrder, hero.bagCounts, room); // (each stack its own count: junk twenty to a slot at most)
          const at: number[] = []; // (each cell after the sockets: the bag's slot it shows)
          const sections: Array<{ title: string; from: number }> = [{ title: '', from: SOCKET_ROW }]; // (a line under the sockets)
          for (const { group, title } of BAG_GROUPS) {
            const mine = layout.flatMap((item, i) => (item && groupOf(item) === group ? [i] : []));
            if (!mine.length) continue;
            sections.push({ title, from: SOCKET_ROW + at.length });
            at.push(...mine);
          }
          const cells = at.map((i): MenuSlot => {
            const item = layout[i]!;
            const slot = slotFor(model, item, counts[i], seller, i);
            slot.preview = bagItemPreview(item); // (hovered: a window with it turning, over its tooltip)
            // Onto another of its group's slots: swapped with it; a bag onto a free socket (on top): fitted there.
            slot.move = (to) => {
              const other = at[to - SOCKET_ROW];
              if (to >= SOCKET_ROW && other !== undefined && groupOf(layout[other]!) === groupOf(item)) moveSlot(hero, i, other, room);
              else if (to < SOCKET_ROW && isBagItem(item)) fitBag(hero, item, to);
            };
            return slot;
          });
          const free = Math.max(0, room - at.length);
          if (free) sections.push({ title: '', from: SOCKET_ROW + at.length }); // (a line, then the free slots)
          return { cells: [...top, ...cells, ...Array.from({ length: free }, () => null)], columns: COLUMNS, sections };
        },
        footer: () =>
          footer(model.hero.money, () => {
            [model.hero.bagOrder, model.hero.bagCounts] = [sortedBag(model.hero.bag), []]; // (packed: each thing's stacks full but the last)
            menu.refresh();
          }),
      },
    ],
  });
  let shown = '';
  const update = () => {
    const contents = JSON.stringify([model.hero.bag, model.hero.bagOrder, model.hero.bagCounts, model.hero.bags, model.hero.money, model.hero.equipment]); // (what's worn: each piece's comparison with it)
    if (contents === shown) return;
    shown = contents;
    menu.refresh();
  };
  const trade = (next: Seller | null) => {
    seller = next;
    menu.refresh();
  };
  return { menu, update, trade };
}
