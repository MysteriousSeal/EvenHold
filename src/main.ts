import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { generateRandomSeed } from './util/random';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const seedLabel = document.getElementById('seed-label') as HTMLDivElement;

const seed = generateRandomSeed();
seedLabel.textContent = `seed: ${seed}`;

const model = new GameModel(seed);
const view = new GameView(canvas, model);
const controller = new GameController(model, view);

view.update(model);
view.render();
controller.start();
