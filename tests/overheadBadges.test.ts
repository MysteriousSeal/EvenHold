// @vitest-environment happy-dom
// Badges over the world (view/hud/overheadBadges.ts: the work marks over the inn's patrons, tables and counter): one
// on the page for each wanted, its word and ink, its tail's tip on its spot, as tall as the world's zoom makes it;
// a word that changes kept in the same badge, one no longer wanted gone, all of them gone on leaving.
import { describe, expect, it } from 'vitest';
import { OverheadBadges, type BadgeAt } from '../src/view/hud/overheadBadges';

// A camera looking on: x across as is, a unit up `zoom` pixels up the screen.
const screen = (zoom: number) => (x: number, y: number, z: number) => ({ x: 100 + x * zoom, y: 300 - y * zoom + z });
const badge = (text: string, ink = '#8fd36a', at = { x: 1, y: 2, z: 0 }): BadgeAt => ({ text, ink, at });
const shown = () => Array.from(document.querySelectorAll<HTMLElement>('.overhead-badge'));

describe('the overhead badges', () => {
  it('one on the page for each wanted, its word and ink, placed by its spot on screen', () => {
    const badges = new OverheadBadges();
    badges.sync(new Map([['a', badge('Ale')], ['b', badge('!', '#ff6a5a', { x: 3, y: 2, z: 0 })]]), screen(40));
    const [ale, call] = shown();
    expect(shown()).toHaveLength(2);
    expect(ale.textContent).toBe('Ale');
    expect(ale.style.getPropertyValue('--ink')).toBe('#8fd36a');
    expect(call.style.getPropertyValue('--ink')).toBe('#ff6a5a');
    expect(ale.style.transform).toContain('translate(140px, 220px)');
    expect(call.style.transform).toContain('translate(220px, 220px)');
    badges.clear();
  });

  it('every one as tall in the world whatever it says, and taller on screen closer in', () => {
    const badges = new OverheadBadges();
    badges.sync(new Map([['a', badge('!')], ['b', badge('Ready!')]]), screen(40));
    const [short, long] = shown();
    expect(short.style.fontSize).toBe(long.style.fontSize); // (the same size, whatever the word)
    const far = parseFloat(short.style.fontSize);
    badges.sync(new Map([['a', badge('!')], ['b', badge('Ready!')]]), screen(80));
    expect(parseFloat(short.style.fontSize)).toBeCloseTo(far * 2);
    badges.clear();
  });

  it('a long word set smaller inside its plate than a short one, to fit', () => {
    const badges = new OverheadBadges();
    badges.sync(new Map([['a', badge('!')], ['b', badge('Clear ×3')]]), screen(40));
    const [short, long] = shown().map((b) => parseFloat((b.firstElementChild as HTMLElement).style.fontSize));
    expect(long).toBeLessThan(short);
    badges.clear();
  });

  it('a changed word kept in its badge; one no longer wanted gone; all gone on clearing', () => {
    const badges = new OverheadBadges();
    badges.sync(new Map([['a', badge('!')], ['b', badge('Clear')]]), screen(40));
    const first = shown()[0];
    badges.sync(new Map([['a', badge('…', '#ffc94a')]]), screen(40));
    expect(shown()).toEqual([first]);
    expect(first.textContent).toBe('…');
    expect(first.style.getPropertyValue('--ink')).toBe('#ffc94a');
    badges.clear();
    expect(shown()).toHaveLength(0);
  });
});
