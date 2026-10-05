// A crypt's name (crypts.ts), from the seed and where it lies, the same every
// time: a burial place and who lies there, or what it's known for: "the tomb
// of Lady Morwen", "the barrow of the Hollow King", "the ossuary of the Grey
// Brothers", "the silent vault". Old names, of the dead long gone, not the
// villagers' (npcs.ts). About twenty thousand of them, no two alike (CRYPT_NAMES).

import { hashUnit, pickAt } from '../../util/random';

export const CRYPT_NAMES = {
  places: ['tomb', 'barrow', 'sepulchre', 'ossuary', 'vault', 'catacombs', 'crypt', 'charnel house', 'resting place', 'undercroft', 'mausoleum', 'cairn', 'cenotaph', 'burial halls', 'bone halls', 'deep tombs', 'grave halls'],
  // A man's titles and names, and a woman's (never a queen called Leofric).
  men: {
    titles: ['Lord', 'Saint', 'King', 'Abbot', 'Prior', 'Duke', 'Baron', 'Sir', 'Bishop', 'Count'],
    names: ['Aldwyn', 'Edric', 'Osric', 'Wulfstan', 'Aethelred', 'Brannoc', 'Cuthbert', 'Leofric', 'Thorold', 'Godric', 'Hereward', 'Maelgwn', 'Eadmund', 'Oswin', 'Wystan', 'Cynric', 'Baldric', 'Ingram', 'Sigebert', 'Ulfric', 'Rhodri', 'Caedmon', 'Alaric', 'Eldred', 'Gerwulf', 'Tancred', 'Haldor', 'Bertram', 'Odo', 'Wilfrid',
      'Aelric', 'Beorn', 'Ceolwulf', 'Drogo', 'Eadric', 'Folcard', 'Gilbert', 'Hrothgar', 'Ivo', 'Jocelin', 'Kenelm', 'Lambert', 'Merewald', 'Nothelm', 'Ordgar', 'Penda', 'Raedwald', 'Saeward', 'Theobald', 'Uhtred', 'Waltheof', 'Aldhelm', 'Benedict', 'Dunstan', 'Ealdred', 'Fulk', 'Guthrum', 'Hamelin', 'Ranulf', 'Swithun'],
  },
  women: {
    titles: ['Lady', 'Saint', 'Queen', 'Abbess', 'Prioress', 'Duchess', 'Dame', 'Baroness', 'Countess'],
    names: ['Morwen', 'Hildegard', 'Ysolde', 'Gwendolen', 'Eadgyth', 'Rowena', 'Elfrida', 'Isolde', 'Aelfgifu', 'Ermengarde', 'Aethelflaed', 'Brunhild', 'Cyneburh', 'Mildrith', 'Ottilie', 'Rohese', 'Seaxburh', 'Wenna', 'Branwen', 'Ethelinda', 'Gunnhild', 'Ragna', 'Sunniva', 'Winifred', 'Eormengyth',
      'Adela', 'Beatrix', 'Cwenburh', 'Domnica', 'Eadburh', 'Frideswide', 'Gisela', 'Hawise', 'Ida', 'Juliana', 'Kyneswith', 'Leofrun', 'Matilda', 'Nesta', 'Osgyth', 'Petronilla', 'Richenza', 'Sexburga', 'Tetta', 'Ursula', 'Wulfrun', 'Aldith', 'Bertha', 'Ealhswith', 'Godgifu', 'Heloise', 'Melisende', 'Oriel', 'Sibyl', 'Werburh'],
  },
  nameless: ['the Hollow King', 'the Pale Queen', 'the Last Bishop', 'the Weeping Knight', 'the Forgotten Lord', 'the Iron Abbess', 'the Nameless Duke', 'the Ashen Prince', 'the Drowned Bride', 'the Silent Warden', 'the Blind Seer', 'the Broken Crown', 'the Grey Widow', 'the Thorn King', 'the Sleeping Saint', 'the Mourning Queen', 'the Black Baron', 'the Lost Heir', 'the Faceless Knight', 'the Bone Bishop', 'the Winter King', 'the Crowned Dead', 'the Hanged Lord', 'the Veiled Lady', 'the Ember Prince', 'the Old Warden', 'the Twice-Buried', 'the Hunter King', 'the Salt Queen', 'the Moth Saint', 'the Raven Lord', 'the Fallen Champion', 'the Stone Bride', 'the Hollow Abbot', 'the Gilded Knight', 'the Wolf Duke', 'the Ash Widow', 'the Starved King', 'the Silent Choir', 'the Thousand Dead'],
  orders: ['the Grey Brothers', 'the Ashen Sisters', 'the Twelve', 'the Fallen Watch', 'the Old Kings', 'the Unremembered', 'the Lantern Order', 'the Black Monks', 'the Silent Sisters', 'the Iron Guard', 'the Bone Choir', 'the Seven', 'the Pilgrims', 'the First Knights', 'the Last Legion', 'the Hooded Brothers', 'the Thorn Order', 'the Crowned Brothers', 'the Wardens', 'the Lost Company', 'the Candle Monks', 'the Raven Order', 'the Old Faith', 'the Weeping Sisters', 'the Drowned Men'],
  // The place alone: "the cold mausoleum".
  bare: ['silent', 'sunken', 'hollow', 'forgotten', 'cold', 'weeping', 'deep', 'nameless', 'broken', 'black', 'grey', 'drowned', 'buried', 'old', 'lost', 'dark', 'whispering', 'shattered', 'ashen', 'mourning'],
} as const;

export function cryptName({ x, z }: { x: number; z: number }, seed: number): string {
  const { places, men, women, nameless, orders, bare } = CRYPT_NAMES;
  const pick = pickAt(x, z, seed * 131);
  const place = pick(places, 301);
  const form = hashUnit(x, z, seed * 131 + 300);
  if (form < 0.4) {
    const who = hashUnit(x, z, seed * 131 + 307) < 0.55 ? men : women;
    return `the ${place} of ${pick(who.titles, 302)} ${pick(who.names, 303)}`;
  }
  if (form < 0.65) return `the ${place} of ${pick(nameless, 304)}`;
  if (form < 0.85) return `the ${place} of ${pick(orders, 305)}`;
  return `the ${pick(bare, 306)} ${place}`;
}
