import { GameModel } from './model/GameModel';
import { GameView } from './view/GameView';
import { GameController } from './controller/GameController';
import { resolveSeed } from './util/seed';
import { createFpsCounter } from './view/hud/fpsCounter';
import { readRenderOptions } from './view/render/renderOptions';

const canvas = document.getElementById('app') as HTMLCanvasElement;
const seedLabel = document.getElementById('seed-label') as HTMLDivElement;

const seed = resolveSeed();
seedLabel.textContent = `seed: ${seed}`;

const model = new GameModel(seed);
const options = readRenderOptions();
const view = new GameView(canvas, model, options);
const countFrame = createFpsCounter(document.getElementById('fps-label') as HTMLDivElement, () => view.getRenderStats());
new GameController(model, view, { uncapped: options.uncapped, onFrame: countFrame }).start();
