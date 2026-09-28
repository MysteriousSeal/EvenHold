export interface HouseVariant {
  width: number; // along local X (the roof ridge runs this way)
  depth: number; // along local Z (door is on the -Z wall)
  height: number; // wall height, above the foundation
  roofHeight: number;
  twoStorey: boolean;
}

// All variants stay inside the 1x1 cell the house occupies, so collision
// (which is per-cell) doesn't depend on which variant is drawn.
export const HOUSE_VARIANTS: readonly HouseVariant[] = [
  { width: 0.78, depth: 0.72, height: 0.5, roofHeight: 0.56, twoStorey: false }, // cottage
  { width: 0.86, depth: 0.6, height: 0.46, roofHeight: 0.48, twoStorey: false }, // longhouse
  { width: 0.62, depth: 0.6, height: 0.8, roofHeight: 0.6, twoStorey: true }, // townhouse (jettied upper floor)
];
