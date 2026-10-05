// The shapes a menu is made from (menu.ts): its options and tabs, and what
// a tab shows (actions, slots, a paper doll), each described where it's declared.

import type { VoxelModel } from './voxelIcon';

// An icon: makes a canvas showing it at `size` CSS pixels (e.g. voxelIcon).
export type MenuIcon = (size: number) => HTMLCanvasElement;

export interface MenuAction {
  icon?: MenuIcon;
  title: string;
  detail?: string;
  section?: string; // a header over it, starting a group of rows (e.g. a cheat tab's "Summon")
  run(): string | void; // may return a line for the status bar
  isOn?(): boolean; // present for toggles
  // For rows showing a setting (e.g. what's worn in a slot): its current
  // detail, icon and value (shown at the right), refreshed after every use.
  current?(): { detail?: string; icon?: MenuIcon; value?: string };
}

// A line of a slot's tooltip: plain, or with a part to play, which sets its
// look (menu.css): what kind of thing it is (under its name), a stat it
// gives, a header over what follows (what wearing it would change), a gain
// (green) or a loss (red), a word about it (italic), its price, or a hint of
// what to do with it (small, last). The tooltip draws a rule before each new
// part: the header, the hints, the price.
export type LineTone = 'kind' | 'stat' | 'extra' | 'head' | 'gain' | 'loss' | 'flavor' | 'price' | 'hint';
export type MenuLine = string | { text: string; tone: LineTone };
export const toned = (tone: LineTone, text: string): MenuLine => ({ text, tone });
export const lineText = (line: MenuLine): string => (typeof line === 'string' ? line : line.text);

// One square of a grid of slots (an inventory, a shop): its icon, how many,
// and what its tooltip says (shown beside it on hover or when selected).
export interface MenuSlot {
  icon: MenuIcon;
  count?: number;
  title: string;
  tone?: string; // colors the title (e.g. an item quality: 'junk')
  lines?: MenuLine[];
  // If given, the slot can be dragged out of the menu; let go outside it,
  // this runs with what's under the pointer (another menu, or the world).
  dragOut?(over: Element | null): void;
  // Which kind of doll slot it fits (e.g. 'head'): while it's dragged, that
  // slot glows, and hovering a doll slot shows green if it fits, red if not.
  fits?: string;
  // Clicked (or Enter): e.g. buy it; a right-click: e.g. eat it. Each may
  // return a line for the status bar; the menu's redrawn after.
  use?(): string | void;
  alt?(): string | void;
  tag?: Array<string | HTMLElement>; // a label in a band along its bottom (e.g. a price)
  badge?: string; // a small mark in its top-right corner (e.g. how many are left: "×6")
  badgeTone?: 'progress' | 'ready' | 'past'; // in a list, a pill: under way, done (to hand in), over with
  dim?: boolean; // shown faded (there, but not to be had: e.g. sold out)
  warn?: boolean; // its icon and tag in red (e.g. a price the hero can't pay)
  move?(to: number): void; // dragged onto another slot of its grid (e.g. to reorder a bag)
  preview?: { key: string; model: () => VoxelModel }; // hovered, a window over its tooltip with its model turning (itemPreview.ts)
  note?: string; // in a list (rows), a line under its title (e.g. where a quest sends you)
  key?: string; // who it is: redrawn, the one chosen stays chosen wherever it's moved to
  // In a list, a checkbox at the row's start (e.g. a quest tracked on screen), toggled on its own.
  check?: { on: boolean; label: string; locked?: boolean; toggle(): void }; // locked: can't be ticked now (shown so; a click still tries, to say why)
}

// A slot around a paper doll: its name, what's in it, and what shows while
// it's empty (a faded silhouette); hovering an empty one names it.
export interface DollSlot {
  label: string;
  slot: MenuSlot | null;
  placeholder?: MenuIcon;
  accepts?: string; // what can be dropped in it: a dragged slot whose `fits` matches
}

export interface MenuTab {
  name: string;
  icon?: MenuIcon;
  actions?: MenuAction[];
  facts?(): Array<[string, string, string[]?]>; // a ledger, refreshed when shown: each label, its value, and lines telling of it on hover
  // A grid of slots (null: an empty one), refreshed when shown; the
  // arrow keys move around it.
  // With `rows`, a list instead: a row each, its icon, title and note (`columns` of them side by side);
  // `sections` put a header before the cell each starts at.
  slots?(): MenuSlots;
  // A figure with slots down its left and right and along the bottom (a
  // character sheet), shown above any facts.
  doll?(): { figure: HTMLElement; left: DollSlot[]; right: DollSlot[]; bottom: DollSlot[] };
  // A line over everything else (e.g. a shopkeeper talking), and one under
  // it all (e.g. the purse under a bag), refreshed when shown.
  header?(): HTMLElement;
  footer?(): HTMLElement;
  // With a grid: a panel beside it telling of the slot chosen (clicked, or
  // with the arrows), e.g. an item and a button to buy it; no tooltips then.
  detail?(slot: MenuSlot | null): HTMLElement;
}

export interface MenuOptions {
  title: string;
  tabs: MenuTab[];
  toggleKey?: string; // a key code that opens and closes this menu
  // With Escape as its toggle key (a pause menu), it only opens when no other
  // menu is open: Escape closes those first.
  keyHints?: boolean; // the line of key hints along the bottom (default: shown)
  // Modal (the default): the world dims, clicks outside close the menu, and
  // it takes every key. Modeless (false): the world stays clear and playable
  // around it, and only Escape and its toggle key reach the menu.
  modal?: boolean;
  place?: 'center' | 'left' | 'bottom-right'; // where a modeless menu sits (default: bottom right)
  onOpenChange?(open: boolean): void;
}

export interface Menu {
  readonly isOpen: boolean;
  open(tab?: number): void; // on its `tab`th tab (else the one it was last on)
  close(): void;
  toggle(): void;
  // Redraws the open tab (after what it shows has changed), keeping the
  // tooltip of the slot under the pointer.
  refresh(): void;
  // A new title (e.g. whose wares these are).
  setTitle(title: string): void;
}

// What a tab's grid (or list) shows: its slots (null: an empty one), how
// many to a row, whether it's a list of rows, and its sections' headers.
export interface MenuSlots {
  cells: Array<MenuSlot | null>;
  columns: number;
  rows?: boolean;
  sections?: Array<{ title: string; from: number }>;
}
