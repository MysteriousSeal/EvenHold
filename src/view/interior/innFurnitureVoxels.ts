// The inn's own furniture in voxels (see furnitureVoxels.ts for how pieces
// are painted): the bar (bottle shelves, the counter, stools, kegs), the
// hearth corner's armchairs and bear rug, tavern tables laid for a meal, and
// what hangs on its walls (antlers, a shield, lanterns, a notice board).

import { WOOD, WOOD_DARK, WOOD_LIGHT, RED, TEAL, LINEN, EMBER, IRON, IRON_LIGHT, SOOT, BRASS, RED_DARK, RED_LIGHT, FUR_DARK, FUR, FUR_LIGHT, BONE, BONE_DARK, CLAY, CLAY_DARK, GLASS_GREEN, GLASS_AMBER, WINE, GLASS_CLEAR, BREAD, ROAST, PARCHMENT, INK, BRASS_DARK, drink, type Box } from './furniturePalette';

export type InnKind = 'counter' | 'keg' | 'armchair' | 'bearRug' | 'barStool' | 'bottleShelf' | 'tavernTable' | 'antlers' | 'wallShield' | 'noticeBoard' | 'wallLantern';

export const INN_PAINTERS: Record<InnKind, (box: Box, len: number, dep: number) => void> = {
  // The inn's counter: a slim wooden bar (a third of a tile deep, in the
  // middle of its tiles), panelled on the customers' side, under a thick
  // overhanging top with a lit edge, and a brass foot rail along its foot;
  // bare on top (the barmaid brings drinks as they're ordered).
  counter: (box, len) => {
    box(1, 1, 9, len - 2, 2, 16, WOOD_DARK); // kick plinth
    box(1, 3, 8, len - 2, 11, 16, (u, y, v) => (v === 16 && (u % 10 === 0 || y === 3 || y === 11) ? WOOD_DARK : WOOD)); // panels, framed
    box(0, 12, 7, len - 1, 13, 18, (_u, y, v) => (y === 12 ? WOOD_DARK : v === 18 ? WOOD_LIGHT : WOOD)); // the top
    box(1, 4, 18, len - 2, 4, 18, BRASS); // foot rail
    for (let u = 4; u < len - 2; u += 12) box(u, 3, 17, u, 3, 17, BRASS_DARK); // its brackets
  },
  // A keg on its side on a wooden cradle, pointing out into the room: an
  // eight-sided body of staves (v along its length), two iron hoops, the
  // front end in lighter wood with a dark rim and a brass tap. Short, so
  // it reaches only 0.6 of its tile out (the barmaid pours beside its tap).
  keg: (box) => {
    for (const v of [3, 9]) box(5, 1, v, 19, 2, v + 1, WOOD_DARK); // the cradle's two chocks
    const cu = 12;
    const cy = 9; // the keg's axis
    const r = 6;
    for (let du = -r; du <= r; du++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.abs(du) + Math.abs(dy) > r + Math.floor(r / 2)) continue; // eight-sided, stepped
        const rim = Math.abs(du) + Math.abs(dy) >= r + Math.floor(r / 2) - 1 || Math.abs(du) === r || Math.abs(dy) === r;
        box(cu + du, cy + dy, 1, cu + du, cy + dy, 12, (_u, _y, v) => {
          if (v === 12) return rim ? WOOD_DARK : WOOD_LIGHT; // the front end
          if (v === 3 || v === 10) return IRON; // hoops
          return ((Math.abs(dy) >= Math.abs(du) ? du : dy) + 20) % 3 === 0 ? WOOD_DARK : WOOD; // staves
        });
      }
    }
    box(11, 6, 13, 13, 8, 13, BRASS); // the tap
    box(12, 4, 14, 12, 6, 14, BRASS); // its spout, pointing down
  },
  // A wingback armchair turned to the fire: a tall tufted back with wings
  // out either side at the top, plump rolled arms with brass studs, a deep
  // cushion catching the light along its front, stubby dark legs.
  armchair: (box) => {
    for (const [u, v] of [[4, 4], [19, 4], [4, 19], [19, 19]]) box(u, 1, v, u + 1, 2, v + 1, WOOD_DARK); // legs
    box(4, 3, 4, 20, 5, 20, RED_DARK); // the base, in shadow
    box(7, 6, 8, 17, 8, 20, (_u, y, v) => (y === 8 && v === 20 ? RED_LIGHT : RED)); // the cushion
    box(5, 6, 4, 19, 22, 7, (u, y, v) => (y === 22 ? RED_LIGHT : v === 7 && u % 4 === 0 && y % 4 === 2 ? RED_DARK : RED)); // the back, buttoned
    for (const [u0, u1] of [[3, 5], [19, 21]]) {
      box(u0, 14, 4, u1, 21, 10, (_u, y) => (y === 21 ? RED_LIGHT : RED)); // wing
      box(u0, 6, 7, u1, 12, 20, (_u, y, v) => (y === 12 ? RED_LIGHT : v === 20 ? RED_DARK : RED)); // rolled arm
      box(u0 + 1, 10, 21, u0 + 1, 10, 21, BRASS); // its stud
    }
  },
  // A bear's pelt spread on the floor: its shape, stepped, in dark, mid and
  // light fur with a darker line down the spine, four legs splayed out with
  // pale claws, and the head raised off the floor, toward the fire (drawn
  // head toward +v, then flipped: the hearth is on the back wall, at -v).
  bearRug: (paint, len, dep) => {
    const box: Box = (u0, y0, v0, u1, y1, v1, color) =>
      paint(u0, y0, dep - 1 - v1, u1, y1, dep - 1 - v0, typeof color === 'number' ? color : (u, y, v) => color(u, y, dep - 1 - v));
    const mid = len / 2 - 0.5;
    const half = (v: number) => (v >= 14 && v <= 36 ? 13 : v >= 12 && v <= 38 ? 11 : v >= 10 && v <= 40 ? 8 : -1);
    const fur = (u: number, v: number, edge: boolean) =>
      edge ? FUR_DARK : Math.abs(u - mid) < 1.5 ? FUR_DARK : (u * 7 + v * 13) % 9 === 0 ? FUR_LIGHT : (u * 5 + v * 3) % 11 === 0 ? FUR_DARK : FUR;
    box(0, 1, 10, len - 1, 1, 40, (u, _y, v) => {
      const h = half(v);
      if (Math.abs(u - mid) > h) return 0;
      return fur(u, v, Math.abs(u - mid) > h - 1 || v === 10 || v === 40);
    });
    // Legs, splayed out to the sides, claws at their tips.
    for (const [v0, v1] of [[12, 17], [33, 38]]) {
      for (const [u0, u1, claw] of [[4, 11, 4], [len - 12, len - 5, len - 5]]) {
        box(u0, 1, v0, u1, 1, v1, (u, _y, v) => (u === claw ? (v % 2 === 0 ? BONE : FUR_DARK) : fur(u, v, v === v0 || v === v1)));
      }
    }
    box(19, 1, 40, 30, 1, 42, (u, _y, v) => fur(u, v, false)); // the neck
    box(18, 1, 42, 31, 5, 46, (u, y, v) => (y === 5 && (u + v) % 3 === 0 ? FUR_LIGHT : fur(u, v, u === 18 || u === 31))); // the head
    for (const u of [18, 30]) box(u, 6, 42, u + 1, 7, 43, FUR_DARK); // ears
    box(21, 1, 47, 28, 3, 49, (_u, y) => (y === 3 ? FUR_LIGHT : FUR)); // the snout
    box(23, 2, 49, 26, 3, 49, SOOT); // its nose
    for (const u of [20, 29]) box(u, 4, 47, u, 4, 47, SOOT); // eyes
    box(22, 1, 49, 27, 1, 49, BONE); // teeth, bared
  },
  // A tall stool at the bar, a footrest round its legs, pulled up to the
  // front of its tile so it sits right at the counter.
  barStool: (box) => {
    const f = 7; // toward the bar
    for (const [u, v] of [[8, 8 + f], [15, 8 + f], [8, 15 + f], [15, 15 + f]]) box(u, 1, v, u + 1, 11, v + 1, WOOD_DARK);
    box(8, 5, 8 + f, 16, 5, 16 + f, WOOD); // footrest
    box(7, 12, 7 + f, 17, 13, 17 + f, (_u, y) => (y === 12 ? WOOD_DARK : WOOD)); // seat
    box(8, 14, 9 + f, 16, 14, 16 + f, (u, _y, v) => (v === 16 + f ? RED_LIGHT : u === 8 || u === 16 ? RED_DARK : RED)); // cushion
  },
  // Shelves of bottles behind the bar: a dark back panel in a framed case
  // under a crown moulding, three lipped shelves stocked with tall bottles
  // (green, amber, wine-dark or clear glass, each corked), squat clay jugs
  // with a darker band and handles, and little clear flasks.
  bottleShelf: (box, len) => {
    box(1, 1, 0, len - 2, 31, 1, WOOD_DARK); // back panel
    for (const u of [1, len - 2]) box(u, 1, 0, u, 31, 8, WOOD); // sides
    box(0, 32, 0, len - 1, 33, 9, WOOD_DARK); // crown moulding
    box(1, 1, 0, len - 2, 2, 8, WOOD); // plinth
    const shelves = [10, 20];
    for (const y of shelves) {
      box(2, y, 1, len - 3, y, 7, WOOD);
      box(2, y + 1, 7, len - 3, y + 1, 7, WOOD_DARK); // a lip along the front
    }
    const glass = [GLASS_GREEN, WINE, GLASS_AMBER, GLASS_CLEAR];
    // Stock each shelf (and the floor of the case) with a run of vessels.
    for (const y of [3, 11, 21]) {
      let u = 4;
      let n = y;
      while (u < len - 6) {
        const kind = n % 5;
        if (kind === 0 || kind === 2 || kind === 4) {
          // A tall bottle: body, shoulder, neck, cork.
          const color = glass[(n + u) % glass.length];
          box(u, y, 3, u + 1, y + 4, 4, color);
          box(u, y + 5, 3, u, y + 6, 3, color);
          box(u, y + 7, 3, u, y + 7, 3, WOOD_LIGHT); // cork
          u += 4;
        } else if (kind === 1) {
          // A squat clay jug with a handle.
          box(u, y, 2, u + 2, y + 3, 4, (_u, yy) => (yy === y + 2 ? CLAY_DARK : CLAY));
          box(u + 1, y + 4, 3, u + 1, y + 4, 3, CLAY);
          box(u + 3, y + 1, 3, u + 3, y + 2, 3, CLAY_DARK);
          u += 6;
        } else {
          // A little flask.
          box(u, y, 3, u + 1, y + 2, 4, GLASS_CLEAR);
          box(u, y + 3, 3, u, y + 3, 3, WOOD_LIGHT);
          u += 4;
        }
        n++;
      }
    }
  },
  // A tavern table laid for a meal: two pewter plates, a loaf and a roast, a tankard and a mug, a candle.
  tavernTable: (box) => {
    for (const [u, v] of [[3, 3], [20, 3], [3, 20], [20, 20]]) box(u, 1, v, u + 1, 8, v + 1, WOOD_DARK);
    box(1, 9, 1, 23, 10, 23, (u) => (u % 6 === 0 ? WOOD_DARK : WOOD));
    for (const [u, v] of [[3, 3], [15, 15]]) box(u, 11, v, u + 5, 11, v + 5, IRON_LIGHT); // plates
    box(4, 12, 4, 7, 13, 6, (u, y) => (y === 13 && u % 2 === 1 ? BREAD : y === 13 ? WOOD_LIGHT : BREAD)); // a loaf on one, scored
    box(16, 12, 16, 19, 13, 18, (_u, y) => (y === 13 ? ROAST : CLAY_DARK)); // a roast on the other,
    box(20, 13, 17, 21, 13, 17, BONE); // its bone sticking out
    [[17, 4], [4, 17]].forEach(([u, v], i) => drink(box, u, 11, v, i)); // a full tankard and an empty mug
    box(11, 11, 11, 12, 15, 12, LINEN); // candle
    box(11, 16, 11, 11, 16, 11, EMBER);
  },
  // A stag's antlers mounted high on the wall: a stepped wooden plaque, the
  // pale skull on it, and two bone beams branching out and up with tines,
  // darker at their roots.
  antlers: (box) => {
    box(9, 17, 0, 15, 24, 1, (u, y) => (u === 9 || u === 15 || y === 17 || y === 24 ? WOOD_DARK : WOOD)); // plaque
    box(10, 20, 2, 14, 23, 3, BONE); // the skull
    box(11, 17, 2, 13, 19, 4, BONE_DARK); // its muzzle
    for (const u of [10, 14]) box(u, 22, 4, u, 22, 4, SOOT); // eye sockets
    for (const s of [-1, 1]) {
      const at = (d: number) => (s < 0 ? 10 - d : 14 + d); // outward from the skull
      const [a, b] = [at(1), at(6)];
      box(Math.min(a, b), 24, 2, Math.max(a, b), 25, 3, (u) => (Math.abs(u - 12) < 4 ? BONE_DARK : BONE)); // the beam, out
      box(Math.min(at(6), at(7)), 24, 2, Math.max(at(6), at(7)), 31, 3, BONE); // and up
      for (const [d, top] of [[2, 28], [4, 29]]) box(at(d), 26, 2, at(d), top, 2, BONE); // tines
    }
  },
  // A heater shield on the wall in EvenHold's turquoise, a sand stripe down
  // it, an iron rim, a brass boss and rivets; a sword stands upright either
  // side of it, hilts up.
  wallShield: (box) => {
    for (const u of [4, 20]) {
      box(u, 12, 0, u, 25, 1, IRON_LIGHT); // blade
      box(u - 2, 26, 0, u + 2, 26, 1, BRASS); // crossguard
      box(u, 27, 0, u, 29, 1, WOOD_DARK); // grip
      box(u, 30, 0, u, 30, 1, BRASS_DARK); // pommel
    }
    const width = (y: number) => (y >= 18 ? 5 : y >= 16 ? 4 : y === 15 ? 2 : -1); // stepped to its point
    box(7, 14, 1, 17, 29, 2, (u, y) => {
      const w = width(y);
      if (Math.abs(u - 12) > w) return 0;
      if (Math.abs(u - 12) === w || y === 29 || y === 14 || (y < 18 && Math.abs(u - 12) === w - 1 && y === 15)) return IRON;
      return Math.abs(u - 12) <= 1 ? LINEN : TEAL;
    });
    box(11, 21, 3, 13, 23, 3, BRASS); // boss
    for (const [u, y] of [[8, 27], [16, 27], [9, 19], [15, 19]]) box(u, y, 3, u, y, 3, BRASS_DARK); // rivets
  },
  // A notice board by the door under a little roof: a framed board with
  // pinned parchment notices, lines of ink on each.
  noticeBoard: (box) => {
    box(3, 10, 0, 21, 24, 1, (u, y) => (u === 3 || u === 21 || y === 10 || y === 24 ? WOOD_DARK : WOOD_LIGHT));
    box(2, 25, 0, 22, 26, 3, (_u, y) => (y === 26 ? WOOD_DARK : WOOD)); // its roof
    for (const [u, y] of [[5, 16], [11, 12], [15, 17]]) {
      box(u, y, 2, u + 4, y + 5, 2, (_u, yy) => ((yy - y) % 2 === 1 && yy < y + 5 ? INK : PARCHMENT)); // a notice
      box(u + 2, y + 5, 3, u + 2, y + 5, 3, RED); // its pin
    }
  },
  // A lantern on an iron bracket, glowing (its light is added in roomView.ts):
  // an iron frame round bright panes, a hot band across the middle of each, under a
  // stepped cap with a ring the bracket holds.
  wallLantern: (box) => {
    box(12, 25, 0, 12, 25, 6, IRON); // bracket
    box(12, 24, 6, 12, 24, 6, IRON); // hook
    box(10, 15, 4, 14, 21, 8, (u, y, v) =>
      y === 15 || ((u === 10 || u === 14) && (v === 4 || v === 8)) ? IRON : (u === 12 || v === 6) && y >= 17 && y <= 19 ? LINEN : EMBER,
    );
    box(10, 22, 4, 14, 22, 8, IRON); // the cap, stepped
    box(11, 23, 5, 13, 23, 7, IRON);
  },
};

