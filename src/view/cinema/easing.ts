// The ways through a span of time everything played full screen shares (view/cinema/): a span of the whole, how far
// through it a moment is, and how that's eased.
export type Span = [from: number, to: number];
// Slow at either end.
export const smooth = (t: number): number => t * t * (3 - 2 * t);
// How far through `[a, b]` `u` is: 0 before it, 1 after.
export const through = (u: number, [a, b]: Span): number => Math.max(0, Math.min(1, (u - a) / (b - a)));
// At rest either end, at its most in the middle.
export const bell = (t: number): number => Math.sin(Math.max(0, Math.min(1, t)) * Math.PI);
// Steadily, only eased a little at either end.
export const steady = (t: number): number => (t + smooth(t)) / 2;
