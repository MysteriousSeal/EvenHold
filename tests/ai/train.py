"""Trains the player with PPO (Stable-Baselines3) over several games at once (env.py), from nothing: it knows the keys
and sees the screen, and is paid for the game's own progress (player.ts PAY). Writes tests/ai/models/player.zip (to train
on from) and player.json (its policy's weights, to play with in TypeScript: policy.ts, play.ts), and a log of each life
(lives.jsonl: what each came to, tally.ts) to read the game by as it learns.

  npm run ai:train                       a million steps more, on from the player saved (a fresh one if there's none)
  npm run ai:train -- --steps 3000000    longer
  npm run ai:train -- --fresh            a fresh one, the one saved replaced
  AI_MINUTES=60 npm run ai:train         longer lives (game minutes; 30 by default)
"""

import argparse
import os

from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor

from env import GameEnv
from report import Reporter
from saving import BEST, LATEST, MODELS, forget, save, score_of


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=1_000_000)
    parser.add_argument("--envs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--fresh", action="store_true", help="start a fresh one (the one saved is replaced)")
    args = parser.parse_args()
    MODELS.mkdir(exist_ok=True)
    print(f"Training a player of the whole game: {args.steps:,} decisions, on {args.envs} games at once, each life {os.environ.get('AI_MINUTES', '30')} game minutes.", flush=True)
    print(f"Starting {args.envs} games (each its own server: vite-node tests/ai/server.ts)…", flush=True)
    env = VecMonitor(SubprocVecEnv([lambda i=i: GameEnv(seed=i + 1) for i in range(args.envs)]))
    print(f"  each sees {env.observation_space.shape[0]:,} numbers a decision and chooses {' × '.join(str(n) for n in env.action_space.nvec)} ways", flush=True)
    resume = not args.fresh and (MODELS / f"{LATEST}.zip").exists()
    if args.fresh:
        forget(BEST)  # (a fresh player sets its own bar)
    if resume:
        model = PPO.load(MODELS / f"{LATEST}.zip", env=env)
        print(f"On from the player saved: {model.num_timesteps:,} decisions trained so far.", flush=True)
    else:
        print(f"A fresh player: knowing nothing yet{' (the one saved is replaced)' if (MODELS / 'player.zip').exists() else ''}.", flush=True)
        model = PPO(
            "MlpPolicy",
            env,
            policy_kwargs={"net_arch": {"pi": [256, 256], "vf": [256, 256]}},
            n_steps=2048,
            batch_size=2048,
            learning_rate=3e-4,
            gamma=0.997,  # (rewards come far apart: looked far ahead)
            ent_coef=0.01,
            verbose=0,
        )
    best = score_of(BEST)
    print(f"Saved every {Reporter.SAVE_EVERY} passes and at the end (or on Ctrl+C) to {MODELS / LATEST}.zip and .json; the best so far{f' (scored {best:.2f})' if best is not None else ''} to {BEST}.zip and .json; each life to lives.jsonl.\n", flush=True)
    reporter = Reporter(args.steps, MODELS / "lives.jsonl", env.get_attr("keys")[0], best)
    try:
        model.learn(total_timesteps=args.steps, callback=reporter, reset_num_timesteps=not resume)
    finally:
        save(model, LATEST, reporter.score())
        env.close()
        print(f"\nSaved: {MODELS / LATEST}.zip and .json ({model.num_timesteps:,} decisions trained in all)" + (f"; the best saved scored {reporter.best:.2f}." if reporter.best > -1e308 else "."))


if __name__ == "__main__":
    main()
