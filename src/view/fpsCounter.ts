// On-screen frames-per-second readout. Counts animation frames on its own
// requestAnimationFrame loop (which runs in step with the game's), and
// refreshes the label twice a second so the number is readable.

const REFRESH_SECONDS = 0.5;

export function startFpsCounter(label: HTMLElement): void {
  let frames = 0;
  let windowStart = performance.now();
  const tick = (now: number) => {
    frames++;
    const elapsed = (now - windowStart) / 1000;
    if (elapsed >= REFRESH_SECONDS) {
      label.textContent = `fps: ${Math.round(frames / elapsed)}`;
      frames = 0;
      windowStart = now;
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
