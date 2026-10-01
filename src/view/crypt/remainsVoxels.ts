// The dead in a crypt (cryptProps.ts: skeleton, slumped, bones), in the crypt's
// palette (cryptVoxels.ts), each on its floor tile (25 x 25 voxels), its head
// toward local +v. Drawn for the camera's distance: shapes first, solid and
// thick (an oversized skull, limbs two voxels across, a ribcage that's one
// barrel with its ribs and gaps in light and dark, a pelvis with its hollow),
// detail by colour, not loose single voxels. Bone in three tones: light
// uppermost, shade along it, dark in its hollows. Four looks each (variant % 4),
// and now and then their rusted gear beside them (variant >> 2: 2 a sword,
// 3 a helmet and a shield; 0 and 1 nothing).

import { C, type Box } from './cryptVoxels';

// A limb bone from (u0, v0) to (u1, v1) on the floor at y: two across, knobbed at both ends.
function limb(box: Box, u0: number, v0: number, u1: number, v1: number, y = 0): void {
  const steps = Math.max(Math.abs(u1 - u0), Math.abs(v1 - v0), 1);
  for (let i = 0; i <= steps; i++) {
    const [u, v] = [Math.round(u0 + ((u1 - u0) * i) / steps), Math.round(v0 + ((v1 - v0) * i) / steps)];
    box(u, y, v, u + 1, y, v + 1, C.bone);
  }
  for (const [u, v] of [[u0, v0], [u1, v1]]) box(u - 1, y, v - 1, u + 2, y + 1, v + 2, C.boneShade); // the knobs
}

// The skull, face up: seven across and long, five high, rounded; its sockets dark on top, toward its face (+v);
// a row of teeth along its front (unless `jawless`).
function skullUp(box: Box, u: number, v: number, look: number, jawless = false): void {
  box(u + 1, 0, v, u + 5, 4, v + 6, C.bone);
  box(u, 0, v + 1, u + 6, 3, v + 5, C.bone);
  box(u + 1, 0, v, u + 5, 0, v + 6, C.boneShade); // its underside, in shade
  const eye = look === 2 ? 1 : 0; // (turned a little)
  box(u + 1 + eye, 4, v + 4, u + 2 + eye, 4, v + 5, C.socket);
  box(u + 4 + eye, 4, v + 4, u + 5 + eye, 4, v + 5, C.socket);
  box(u + 3, 4, v + 3, u + 3, 4, v + 3, C.boneDark); // the nose
  if (!jawless) for (let k = u + 1; k <= u + 5; k++) box(k, 0, v + 7, k, 1, v + 7, k % 2 ? C.boneShade : C.boneDark); // the teeth
}

// The skull upright, its face toward +v (bowed, slumped): sockets and nose on its front, the jaw under.
function skullFacing(box: Box, u: number, y: number, v: number): void {
  box(u + 1, y, v, u + 5, y + 5, v + 5, C.bone);
  box(u, y + 1, v + 1, u + 6, y + 4, v + 4, C.bone);
  box(u + 1, y + 5, v + 1, u + 5, y + 5, v + 4, C.boneShade); // the crown, bowed away from the light
  box(u + 1, y + 2, v + 5, u + 2, y + 3, v + 5, C.socket);
  box(u + 4, y + 2, v + 5, u + 5, y + 3, v + 5, C.socket);
  box(u + 3, y + 1, v + 5, u + 3, y + 1, v + 5, C.boneDark);
  box(u + 1, y - 1, v + 1, u + 5, y, v + 5, C.boneShade); // the jaw
}

// The ribcage, lying: a barrel nine across, its ribs across it in light with dark between, the sternum down its middle.
function ribsUp(box: Box, u: number, v0: number, v1: number): void {
  box(u, 0, v0, u + 8, 2, v1, C.boneShade);
  box(u + 1, 3, v0, u + 7, 3, v1, C.boneDark);
  for (let v = v0; v <= v1; v += 2) box(u + 1, 3, v, u + 7, 3, v, C.bone);
  box(u + 4, 3, v0, u + 4, 3, v1, C.bone); // the sternum
}

// The pelvis: a block seven across with its hollow dark.
function pelvis(box: Box, u: number, y: number, v: number): void {
  box(u, y, v, u + 6, y + 2, v + 3, C.bone);
  box(u + 2, y + 2, v + 1, u + 4, y + 2, v + 2, C.boneDark);
}

// Their rusted gear, if any (variant >> 2), by their side at u.
function gear(box: Box, variant: number, u: number): void {
  const kit = variant >> 2;
  if (kit === 2) {
    // A broad sword, rusted, its grip toward the dead's hand.
    box(u, 0, 6, u + 1, 0, 22, C.ironDark);
    for (let v = 8; v <= 22; v += 5) box(u, 0, v, u + 1, 0, v + 1, C.rust);
    box(u - 2, 0, 4, u + 3, 1, 5, C.iron); // the crossguard
    box(u, 0, 1, u + 1, 1, 3, C.wood); // the grip
  } else if (kit === 3) {
    // A dented helmet, and a round shield beside it, its paint long gone.
    box(u - 2, 0, 18, u + 3, 3, 23, C.iron);
    box(u - 2, 4, 19, u + 3, 4, 22, C.ironDark);
    for (let du = -5; du <= 5; du++) for (let dv = -5; dv <= 5; dv++) {
      const r = du * du + dv * dv;
      if (r <= 26) box(u + du, 0, 9 + dv, u + du, 0, 9 + dv, r <= 3 ? C.iron : r >= 18 ? C.ironDark : C.wood);
    }
    box(u - 1, 1, 8, u + 1, 1, 10, C.iron); // the boss
  }
}

// Stretched out on its back: the skull at its head, the ribcage, the pelvis, arms at its sides, legs out.
export function stretchedOut(box: Box, variant: number): void {
  const look = variant % 4;
  skullUp(box, 9 + (look === 2 ? 1 : 0), 16, look, look === 3);
  if (look === 3) box(10, 0, 0, 14, 1, 1, C.boneShade); // its jaw, fallen away by its feet
  box(11, 0, 14, 12, 1, 15, C.boneShade); // the neck
  ribsUp(box, 8, 8, 13);
  box(11, 0, 6, 12, 1, 7, C.boneShade); // the spine's foot
  pelvis(box, 9, 0, 3);
  // The arms: at its sides, or one flung out.
  if (look === 0) limb(box, 6, 12, 2, 17);
  else limb(box, 6, 12, 6, 4);
  limb(box, 17, 12, 17, 4);
  // The legs: out straight; one gone (look 1); crossed (look 2).
  if (look !== 1) limb(box, 10, 2, look === 2 ? 13 : 9, 0);
  limb(box, 14, 2, look === 2 ? 10 : 15, 0);
  gear(box, variant, 21);
}

// Sat with its back to the rock (local -v), head bowed onto its chest, legs out before it, arms hanging.
export function slumpedAgainstTheRock(box: Box, variant: number): void {
  const look = variant % 4;
  pelvis(box, 9, 0, 1); // sat on the floor
  for (let y = 2; y <= 10; y++) box(11, y, 1, 12, y, 2, y % 2 ? C.bone : C.boneDark); // the spine, up the rock
  // The ribcage, upright against the rock: its ribs across its front.
  box(8, 5, 2, 16, 10, 5, C.boneShade);
  for (let y = 5; y <= 10; y += 2) box(9, y, 6, 15, y, 6, C.bone);
  box(12, 5, 6, 12, 10, 6, C.bone); // the sternum
  // The skull, bowed forward onto its chest (or lolled to a side).
  const lean = look === 1 ? -2 : look === 2 ? 2 : 0;
  skullFacing(box, 9 + lean, 10, 4);
  // The legs, out before it (one drawn up, its knee high).
  limb(box, 9, 5, 9, 20);
  if (look === 3) {
    limb(box, 14, 5, 14, 10, 0);
    box(14, 2, 10, 15, 6, 11, C.bone); // the shin, up from the knee
    limb(box, 14, 11, 14, 14, 0);
  } else limb(box, 14, 5, 15, 20);
  // The arms, hanging at its sides to the floor, the hands by its hips.
  for (const u of [6, 17]) box(u, 1, 3, u + 1, 9, 4, C.bone);
  for (const u of [6, 17]) box(u - 1, 0, 4, u + 2, 0, 6, C.boneShade);
  gear(box, variant, 21);
}

// Bones scattered: the skull, its jaw apart, long bones at angles, ribs, the pelvis on its side.
export function scatteredBones(box: Box, variant: number): void {
  const look = variant % 4;
  skullUp(box, 3 + look * 3, 14 - look, look, true);
  box(13 - look, 0, 9, 17 - look, 1, 10, C.boneShade); // the jaw
  limb(box, 3, 3 + look, 12, 8 - look);
  limb(box, 17, 13, 21 - look, 21);
  if (look !== 3) limb(box, 19, 3, 15 + look, 8);
  // A rib or two, curved, lying apart.
  for (const [u, v] of [[6, 20], [17, 6]] as const) {
    box(u, 0, v, u + 1, 1, v + 1, C.bone);
    box(u + 2, 0, v + 1, u + 4, 1, v + 2, C.bone);
    box(u + 5, 0, v, u + 6, 1, v + 1, C.bone);
  }
  if (look % 2 === 0) pelvis(box, 14, 0, 16);
  gear(box, variant, look % 2 ? 21 : 2);
}
