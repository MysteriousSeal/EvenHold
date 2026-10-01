// A night's sleep (model/inn/roomLetting.ts): the screen fading to black, a
// line while it's dark ("You sleep till morning…"), the night passing then,
// and fading back in on the morning.

const FADE = 0.9; // seconds to fade out, and back in
const DARK = 1.4; // seconds held dark

// `whileDark`: once it's dark (the night passing); `done`: as it starts fading back in.
export function createSleepFade(): (whileDark: () => void, done: () => void) => void {
  const veil = document.createElement('div');
  veil.className = 'sleep-fade';
  veil.innerHTML = '<span>You sleep till morning…</span>';
  veil.style.transitionDuration = `${FADE}s`; // (hud.css: the rest of its look)
  document.body.append(veil);
  let busy = false;
  return (whileDark, done) => {
    if (busy) return;
    busy = true;
    veil.classList.add('dark');
    window.setTimeout(() => {
      whileDark();
      window.setTimeout(() => {
        done(); // (the morning: going again, as it fades back in)
        veil.classList.remove('dark');
        window.setTimeout(() => {
          busy = false;
        }, FADE * 1000);
      }, DARK * 1000);
    }, FADE * 1000);
  };
}
