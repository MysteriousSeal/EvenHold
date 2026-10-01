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
  Object.assign(veil.style, { position: 'fixed', inset: '0', background: '#050302', opacity: '0', transition: `opacity ${FADE}s ease`, pointerEvents: 'none', display: 'grid', placeItems: 'center', zIndex: '50' });
  Object.assign((veil.firstElementChild as HTMLElement).style, { color: '#f0e2c4', font: '500 22px Fredoka, sans-serif', letterSpacing: '0.04em', opacity: '0.9' });
  document.body.append(veil);
  let busy = false;
  return (whileDark, done) => {
    if (busy) return;
    busy = true;
    veil.style.pointerEvents = 'auto';
    veil.style.opacity = '1';
    window.setTimeout(() => {
      whileDark();
      window.setTimeout(() => {
        done(); // (the morning: going again, as it fades back in)
        veil.style.opacity = '0';
        window.setTimeout(() => {
          veil.style.pointerEvents = 'none';
          busy = false;
        }, FADE * 1000);
      }, DARK * 1000);
    }, FADE * 1000);
  };
}
