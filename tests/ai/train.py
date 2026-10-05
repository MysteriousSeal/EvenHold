"""Trains with PPO (Stable-Baselines3), over several copies of the game at once: a fighter in the arena (arena.ts),
or a player of the whole game by keys, from nothing (player.ts: --env player). Writes it out: the model
(tests/ai/models/<name>.zip, to train on from) and its policy's weights as JSON (<name>.json) to play with in
TypeScript (fighterPolicy.ts: evaluate.ts, the watch page), no Python needed. Names: fighter, player.

  npm run ai:train                      a million steps more, on from the fighter saved (a fresh one if there's none)
  npm run ai:train -- --steps 3000000   longer
  npm run ai:train -- --fresh           a fresh one, the one saved replaced
  npm run ai:player:train               the player, likewise (-- --steps, -- --fresh)
"""

import argparse
import json
import os
from pathlib import Path

import torch
from stable_baselines3 import PPO
from stable_baselines3.common.vec_env import SubprocVecEnv, VecMonitor

from arena_env import ArenaEnv
from report import Reporter

MODELS = Path(__file__).resolve().parent / "models"


def export(model: PPO, path: Path) -> None:
    """The policy's layers (its shared trunk, then the way and the move heads) as plain lists, for fighter.ts."""
    layers = [m for m in model.policy.mlp_extractor.policy_net if isinstance(m, torch.nn.Linear)]
    head = model.policy.action_net
    as_list = lambda t: t.detach().cpu().numpy().tolist()
    path.write_text(json.dumps({
        "activation": "tanh",
        "layers": [{"weight": as_list(l.weight), "bias": as_list(l.bias)} for l in layers],
        "head": {"weight": as_list(head.weight), "bias": as_list(head.bias)},
        "splits": [int(n) for n in model.action_space.nvec],
    }))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--steps", type=int, default=1_000_000)
    parser.add_argument("--envs", type=int, default=max(1, (os.cpu_count() or 2) - 1))
    parser.add_argument("--fresh", action="store_true", help="start a fresh one (the one saved is replaced)")
    parser.add_argument("--env", choices=["arena", "player"], default="arena")
    args = parser.parse_args()
    MODELS.mkdir(exist_ok=True)
    name = "player" if args.env == "player" else "fighter"
    what = "a player of the whole game, by keys (player.ts)" if name == "player" else "a fighter, in the arena (arena.ts)"
    print(f"Training {what}: {args.steps:,} steps, on {args.envs} games at once.", flush=True)
    print(f"Starting {args.envs} games (each its own server: vite-node tests/ai/server.ts)…", flush=True)
    env = VecMonitor(SubprocVecEnv([lambda i=i: ArenaEnv(seed=i + 1, kind=args.env) for i in range(args.envs)]))
    print(f"  each sees {env.observation_space.shape[0]:,} numbers a step and chooses {' × '.join(str(n) for n in env.action_space.nvec)} ways", flush=True)
    resume = not args.fresh and (MODELS / f"{name}.zip").exists()
    if resume:
        model = PPO.load(MODELS / f"{name}.zip", env=env)
        print(f"On from the {name} saved: {model.num_timesteps:,} steps trained so far.", flush=True)
    else:
        print(f"A fresh {name}: knowing nothing yet{' (the one saved is replaced)' if (MODELS / f'{name}.zip').exists() else ''}.", flush=True)
        model = PPO(
            "MlpPolicy",
            env,
            policy_kwargs={"net_arch": {"pi": [256, 256], "vf": [256, 256]} if name == "player" else {"pi": [128, 128], "vf": [128, 128]}},
            n_steps=2048 if name == "player" else 1024,
            batch_size=2048,
            learning_rate=3e-4,
            gamma=0.995 if name == "player" else 0.99,  # (the player's rewards come far apart: looked further ahead)
            ent_coef=0.01,
            verbose=0,
        )
    layers = " → ".join(str(l.out_features) for l in model.policy.mlp_extractor.policy_net if isinstance(l, torch.nn.Linear))
    print(f"  its network: {env.observation_space.shape[0]:,} → {layers} → its choices; learns every {model.n_steps * model.n_envs:,} steps, looking {1 / (1 - model.gamma):.0f} steps ahead", flush=True)
    print(f"Saved at the end (or on Ctrl+C) to {MODELS / f'{name}.zip'} and {name}.json.\n", flush=True)
    try:
        model.learn(total_timesteps=args.steps, callback=Reporter(args.steps, name), reset_num_timesteps=not resume)
    finally:
        model.save(MODELS / f"{name}.zip")
        export(model, MODELS / f"{name}.json")
        env.close()
        print(f"Saved: {MODELS / f'{name}.zip'} and {MODELS / f'{name}.json'} ({model.num_timesteps:,} steps trained in all).")


if __name__ == "__main__":
    main()
