// The wind as the smoke feels it: which way it blows (a unit vector on the
// ground, x and z) and how hard (0 still .. 1 a full wind), easing through
// the day and gusting: across the screen and a little toward it, so the
// smoke leans off sideways as it rises (blown toward the camera, it would
// fold back down its own column). (Till the weather has a wind of its own
// to read, this is it.)

const DIRECTION = (() => {
  const [x, z] = [1, -0.35];
  const d = Math.hypot(x, z);
  return { x: x / d, z: z / d };
})();

// `minutes`: the time of day (the wind rising and falling over hours); `seconds`: the moment (its gusts).
export function windNow(seed: number, minutes: number, seconds: number): { x: number; z: number; strength: number } {
  const steady = 0.45 + 0.25 * Math.sin(minutes / 170 + (seed % 97));
  const gust = 0.15 * Math.max(0, Math.sin(seconds * 0.7) * Math.sin(seconds * 0.23 + 1));
  return { ...DIRECTION, strength: Math.min(1, Math.max(0, steady + gust)) };
}
