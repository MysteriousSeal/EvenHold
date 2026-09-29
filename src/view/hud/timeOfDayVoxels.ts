// The time of day in tiny voxels, for the clock's card (clockHud.ts), seen
// straight on (ui/frontIcon.ts), in bright colors each outlined in ink: a sun
// half risen over a green hill (morning), the full sun ringed with ink rays
// (day), an orange sun half set behind a dusky band (evening), a crescent
// moon with a star (night).

import type { FrontVoxels } from '../ui/frontIcon';

const K = 0x2e1f14; // the ink outline

export const morningModel: FrontVoxels = {
  rows: ['...KKKKK...', '..KLLSSSK..', '.KLSSSSSSK.', 'KKKKKKKKKKK', 'KGGGGGGGGGK', 'KKKKKKKKKKK'],
  colors: { K, S: 0xffe86a, L: 0xfff8d0, G: 0x7ac86a },
};

export const dayModel: FrontVoxels = {
  rows: [
    '......K......',
    '.K....K....K.',
    '..K.......K..',
    '....KKKKK....',
    '...KLLSSSK...',
    '...KLSSSSK...',
    'KK.KSSSSSK.KK',
    '...KSSSSSK...',
    '...KSSSSSK...',
    '....KKKKK....',
    '..K.......K..',
    '.K....K....K.',
    '......K......',
  ],
  colors: { K, S: 0xffd23a, L: 0xfff4b0 },
};

export const eveningModel: FrontVoxels = {
  rows: ['...KKKKK...', '..KLOOOOK..', '.KLOOOOOOK.', 'KKKKKKKKKKK', 'KPPPPPPPPPK', 'KKKKKKKKKKK'],
  colors: { K, O: 0xff8a30, L: 0xffc070, P: 0xb06aa0 },
};

export const nightModel: FrontVoxels = {
  rows: ['..KKK....K.', '.KMMK...KTK', 'KMMK.....K.', 'KMMK.......', 'KMMK.......', '.KMMK......', '..KKK......'],
  colors: { K, M: 0xf4f8ff, T: 0xfff2a0 },
};
