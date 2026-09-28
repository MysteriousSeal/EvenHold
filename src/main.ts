import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { startFpsCounter } from './view/fpsCounter';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const seedLabel = document.getElementById('seed-label') as HTMLDivElement;

const seed = resolveSeed();
seedLabel.textContent = `seed: ${seed}`;

const model = new GameModel(seed);
const view = new GameView(canvas, model);
new GameController(model, view).start();
startFpsCounter(document.getElementById('fps-label') as HTMLDivElement);
