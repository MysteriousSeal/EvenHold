// The brood mother fought in her own cave (caves/caveFoes.ts), as the fight curve fights (fightCurve.ts duel): the
// rest of the cave slain, the hero of a stage stood at her nest's edge, her volleys, charges and young all as they
// come; she and her young of `level`.
import { GameModel } from '../../src/model/GameModel';
import { caveInside } from '../../src/model/caves/caves';
import { enemyPower } from '../../src/model/enemies/enemyLevels';
import { mulberry32 } from '../../src/util/random';
import { duel, heroAt, type Stage, type Style } from './fightCurve';

const MID = { width: 512, depth: 512 };

export function broodFight(stage: Stage, style: Style, level = stage.level, seed = 1, noYoung = false) {
  const random = Math.random;
  Math.random = mulberry32(seed * 7919 + level);
  try {
    const model = new GameModel(seed, MID);
    const cave = model.caves[0];
    cave.level = level;
    model.teleport(cave.entrance.x, cave.entrance.z);
    model.useDoor();
    heroAt(model, stage);
    const nest = caveInside(model.seed, cave.entrance).plan.hollows.at(-1)!;
    const mother = model.foes.find((f) => f.kind === 'broodMother')!;
    for (const f of model.foes) if (f !== mother) [(f.state = 'dead'), model.slayGuard(f)];
    const p = enemyPower('broodMother', level);
    Object.assign(mother, { level, maxHp: p.maxHp, hp: p.maxHp, damage: p.damage });
    Object.assign(model.hero, { x: nest.x, z: nest.z + 1.6 });
    const young = () => model.foes.filter((f) => f.kind === 'hatchling');
    const r = duel(model, mother, style, 120, noYoung ? () => young().forEach((f) => (f.state = 'dead')) : undefined);
    return { ...r, young: young().length, youngSlain: young().filter((f) => f.state === 'dead').length };
  } finally {
    Math.random = random;
  }
}
