import { afterEach, describe, expect, it } from 'vitest';
import { actionOf, keyLabel, keyOf, keysOf, label, loadKeys, rebind, resetKeys } from '../src/controller/keyBindings';
import { controlsText } from '../src/controller/controls';

afterEach(() => resetKeys());

describe('the keys the player chooses', () => {
  it('come as they always were', () => {
    expect([actionOf('KeyE'), actionOf('ArrowUp'), actionOf('ShiftRight'), actionOf('Digit8'), actionOf('KeyK')]).toEqual(['use', 'up', 'roll', 'bar8', 'skills']);
    expect(actionOf('Escape')).toBeNull();
  });

  it('a key rebound: the action on it, the old key free; one another had: swapped, none left without', () => {
    expect(rebind('use', 'KeyR')).toBe(true);
    expect([actionOf('KeyR'), actionOf('KeyE'), label('use')]).toEqual(['use', null, 'R']);
    expect(rebind('attack', 'KeyR')).toBe(true); // (the use key's: use gets Space)
    expect([keyOf('attack'), keyOf('use')]).toEqual(['KeyR', 'Space']);
    expect(rebind('up', 'KeyI')).toBe(true);
    expect(keysOf('up')).toEqual(['KeyI', 'ArrowUp']); // (the arrow kept beside it)
  });

  it('never Escape nor the cheats\' key', () => {
    expect(rebind('use', 'Escape')).toBe(false);
    expect(rebind('use', 'Backquote')).toBe(false);
    expect(keyOf('use')).toBe('KeyE');
  });

  it('read back from what was kept, anything unsound left as it came', () => {
    loadKeys(JSON.stringify({ use: ['KeyR'], bag: ['KeyR'], sheet: ['Escape'], skills: 'KeyJ', __proto__: ['KeyZ'] }));
    expect(keyOf('use')).toBe('KeyR');
    expect(keyOf('bag')).toBe('KeyB'); // (two on one key: the later back as it came)
    expect(keyOf('sheet')).toBe('KeyC');
    expect(keyOf('skills')).toBe('KeyK');
    loadKeys('not json');
    expect(keyOf('use')).toBe('KeyE');
  });

  it('printed as on the key; the controls told with the player\'s own', () => {
    expect(['KeyE', 'Digit3', 'ShiftLeft', 'ArrowLeft', 'Numpad4', 'Semicolon'].map(keyLabel)).toEqual(['E', '3', 'Shift', '←', 'Num 4', ';']);
    rebind('guard', 'KeyV');
    expect(controlsText()).toContainEqual(['Guard (raise it as a blow lands: parry)', 'Hold V']);
  });
});
