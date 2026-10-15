// The sets: pieces made to be worn together, each set of one make, one palette
// and one motif (the view's setPalettes.ts), found where their makers were.
// Wearing a whole one only looks the part; it adds nothing more than its pieces.

export const GEAR_SETS = {
  headsman: { name: "The Headsman's", tale: "A stronghold gaol's: black hood, butcher's apron, the axe for the block." },
  barrow: { name: 'Barrow', tale: "What the draugr were buried in: mail and plate gone to rust, grave-gold, green with age." },
  ossuary: { name: 'Ossuary', tale: "Bone on bone, wired together by the crypts' dead out of those who went before them." },
  flayer: { name: "The Flayer's", tale: "A bandit band's worst: other men's hides, cured and stitched, teeth on a cord." },
  cinder: { name: 'Cinder', tale: "The fire-cult's of the strongholds: ash-grey robes, soot, embers kept in a censer." },
  palmer: { name: "The Palmer's", tale: "The pilgrims' road clothes: a broad hat, a short cape, a staff, the scallop shell." },
  watch: { name: "The Watch's", tale: "EvenHold's own, forged at the smithy for the roads' guards: teal, steel and brass." },
  sunward: { name: 'Sunward', tale: "A lost order's harness, gilded and white-enamelled, a sun on every plate: kings' tombs keep it." },
  velvet: { name: 'Velvet court', tale: "A noble's finery, taken on the road by the bandits' chiefs: velvet, ermine, gold." },
  reliquary: { name: 'Reliquary', tale: "What the Gilded Deacon was rebuilt from, and his saints with him: gilt, bone and red silk, a relic behind every window." },
  blackbanner: { name: 'Blackbanner', tale: "The strongholds' soldiers' kit: black cloth, blackened iron, a pavise to shoot from." },
} as const;

export type GearSet = keyof typeof GEAR_SETS;
