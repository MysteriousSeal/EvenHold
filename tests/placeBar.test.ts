// @vitest-environment happy-dom
// The place the hero's in, under their frame (view/hud/placeBar.ts): a crypt's or a cave's name over its bar
// ("Cleared 40%", "Cleared!" gold), or a bandit camp's over its counts (bandits slain of how many, its chief, by a
// bust of each, its level over them; gold once down, "Cleared!" and its chest), or a village's over its level; hidden elsewhere, the quests taken moved down under it.
import { describe, expect, it, vi } from 'vitest';

vi.mock('../src/view/ui/voxelIcon', () => ({ voxelIcon: () => document.createElement('canvas') }));
const { createPlaceBar } = await import('../src/view/hud/placeBar');

const camp = (slain: number, chief: number, chestOpened = false) => ({
  name: "redhand's lair",
  ink: '#e05040',
  camp: { name: "redhand's lair", level: 7, bandits: { slain, of: 5 }, chief: { slain: chief, of: 1 }, cleared: slain === 5 && chief === 1, chestOpened },
});

describe('the place bar', () => {
  it("a crypt's: its name over its bar, how much is cleared; gold once all of it", () => {
    const show = createPlaceBar();
    const bar = document.querySelector('.place-bar') as HTMLElement;
    show({ name: 'the tomb of Lady Morwen', share: 0.4 });
    expect(bar.hidden).toBe(false);
    expect(bar.querySelector('b')!.textContent).toBe('The tomb of Lady Morwen');
    expect(bar.querySelector('.place-bar-track span')!.textContent).toBe('Cleared 40%');
    expect((bar.querySelector('.place-bar-counts') as HTMLElement).hidden).toBe(true);
    show({ name: 'the tomb of Lady Morwen', share: 1 });
    expect(bar.classList.contains('done')).toBe(true);
    show(null);
    expect(bar.hidden).toBe(true);
    expect(document.body.classList.contains('in-place')).toBe(false);
    bar.remove();
  });

  it("a camp's: its bandits slain and its chief, of how many, by their busts; once all down, gold, cleared, its chest", () => {
    const show = createPlaceBar();
    const bar = document.querySelector('.place-bar') as HTMLElement;
    show(camp(2, 0));
    expect(document.body.classList.contains('in-place')).toBe(true);
    expect(bar.querySelector('b')!.textContent).toBe("Redhand's lair (bandit camp)"); // (what it is, after its name)
    expect((bar.querySelector('.place-bar-track') as HTMLElement).hidden).toBe(true);
    const rows = () => Array.from(bar.querySelectorAll('.place-bar-count')).map((r) => r.textContent);
    expect(rows()).toEqual(['Camp level7', 'Bandits slain2/5', 'Chief slain0/1']);
    expect((bar.querySelector('.place-bar-count em') as HTMLElement).style.color).toBe('#e05040'); // (in how dangerous it is for the hero)
    expect(bar.querySelectorAll('.place-bar-count canvas')).toHaveLength(2);
    expect(bar.classList.contains('done')).toBe(false);
    show(camp(5, 1));
    expect(rows()).toEqual(['Camp level7', 'Bandits slain5/5', 'Chief slain1/1', 'Cleared!Chest: unopened']);
    expect(bar.classList.contains('done')).toBe(true);
    show(camp(5, 1, true));
    expect(rows().at(-1)).toBe('Cleared!Chest: opened');
    bar.remove();
  });

  it("a village's: its name, \"(village)\" after it, its level under it (in how hard it is for the hero), its quests done", () => {
    const show = createPlaceBar();
    const bar = document.querySelector('.place-bar') as HTMLElement;
    show({ name: 'Little Ashford', village: { level: 3, ink: '#80d060', quests: { completed: 1, of: 6 } } });
    expect(bar.querySelector('b')!.textContent).toBe('Little Ashford (village)');
    expect((bar.querySelector('.place-bar-track') as HTMLElement).hidden).toBe(true);
    const rows = () => Array.from(bar.querySelectorAll('.place-bar-count')).map((r) => r.textContent);
    expect(rows()).toEqual(['Village level3', 'Quests completed1/6']);
    expect(bar.querySelectorAll('.place-bar-count.cleared, .place-bar-count.done')).toHaveLength(0);
    expect(bar.querySelectorAll('.place-bar-count canvas')).toHaveLength(0);
    expect((bar.querySelector('.place-bar-count em') as HTMLElement).style.color).toBe('#80d060');
    expect(bar.classList.contains('done')).toBe(false);
    show({ name: 'Little Ashford', village: { level: 3, ink: '#80d060', quests: { completed: 6, of: 6 } } });
    expect(rows().slice(1)).toEqual(['Quests completed6/6']);
    expect(bar.querySelector('.place-bar-count:last-child')!.classList.contains('done')).toBe(true); // (all done: gold)
    bar.remove();
  });
});
