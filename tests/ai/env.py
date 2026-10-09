"""The game as a Gymnasium environment (train.py): each one runs its own game server (server.ts, under vite-node) and
talks to it a line of JSON at a time. Seen: a row of numbers, what's on screen (senses.ts). Done: which way to go (9)
and which key (keys.ts: the game's keys, and the clicks in its windows)."""

import base64
import json
import os
import subprocess
from pathlib import Path

import gymnasium as gym
import numpy as np

ROOT = Path(__file__).resolve().parents[2]  # the repository


class GameEnv(gym.Env):
    metadata = {"render_modes": []}

    def __init__(self, seed: int = 0):
        super().__init__()
        self.proc = subprocess.Popen(
            ["npx", "vite-node", "tests/ai/server.ts"],
            cwd=ROOT,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            env={**os.environ},
            text=True,
            bufsize=1,
        )
        spec = self._call({"spec": True})
        self.observation_space = gym.spaces.Box(-np.inf, np.inf, shape=(spec["observation"],), dtype=np.float32)
        self.action_space = gym.spaces.MultiDiscrete([spec["moves"], spec["actions"]])
        self.keys = spec["keys"]  # each key's name (keys.ts), for the trainer's telling
        self._lives = seed * 1_000_003  # each env its own run of worlds

    def _call(self, message: dict) -> dict:
        self.proc.stdin.write(json.dumps(message) + "\n")
        line = self.proc.stdout.readline()
        if not line:
            raise RuntimeError("the game server stopped")
        return json.loads(line)

    def reset(self, *, seed=None, options=None):
        super().reset(seed=seed)
        self._lives += 1
        answer = self._call({"reset": int(seed if seed is not None else self._lives) & 0x7FFFFFFF})
        return self._seen(answer), {}

    @staticmethod
    def _seen(answer: dict) -> np.ndarray:
        return np.frombuffer(base64.b64decode(answer["observation"]), dtype=np.float32).copy()

    def step(self, action):
        answer = self._call({"step": [int(action[0]), int(action[1])]})
        return self._seen(answer), float(answer["reward"]), bool(answer["done"]), bool(answer["truncated"]), answer["info"]

    def close(self):
        if self.proc.poll() is None:
            self.proc.stdin.close()
            self.proc.terminate()
            self.proc.wait(timeout=5)
