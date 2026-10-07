// A place's name across the top of the screen as the hero comes into it (a
// crypt: "The tomb of Lady Morwen", its level under it), or a deed done there ("Crypt
// cleared", the crypt's name under it), or a warning (a cave's nest webbed shut), fading after a while (`shown`, its own
// time on screen if it's to stay longer). Its line under the name may be in parts, a part in its own ink (a bandit
// camp's level, in the colour of how dangerous it is).
// Styles in hud.css.

import { capitalize } from '../../util/text';

const SHOWN = 3500; // ms on screen before it fades (unless told otherwise)

export type BannerLine = string | Array<string | { text: string; ink: string }>;

export function createPlaceBanner(): (name: string, under: BannerLine, shown?: number) => void {
  const banner = document.createElement('div');
  banner.className = 'place-banner';
  const title = document.createElement('b');
  const sub = document.createElement('span');
  banner.append(title, sub);
  document.body.append(banner);
  let timer = 0;
  return (name, under, shown = SHOWN) => {
    title.textContent = capitalize(name);
    sub.replaceChildren(
      ...(typeof under === 'string' ? [under] : under).map((part) => {
        if (typeof part === 'string') return part;
        const inked = document.createElement('em');
        inked.textContent = part.text;
        inked.style.color = part.ink;
        return inked;
      }),
    );
    banner.classList.add('shown');
    window.clearTimeout(timer);
    timer = window.setTimeout(() => banner.classList.remove('shown'), shown);
  };
}
