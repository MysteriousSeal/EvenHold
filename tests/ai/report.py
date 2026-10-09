"""What the trainer says as it goes (train.py): each life as it ends, in a line (its level, coin, quests, falls, what it
did), written to lives.jsonl too; and now and then where the training stands (decisions done, lives, the mean of the
last lives' rewards and levels). A life that never opened a window, never took a quest, never went indoors is the part
to read: what the game lets a player skip."""

import json
import time
from pathlib import Path

from stable_baselines3.common.callbacks import BaseCallback


class Reporter(BaseCallback):
    def __init__(self, total: int, log: Path):
        super().__init__()
        self.total = total
        self.log = log
        self.lives = 0
        self.recent: list[dict] = []
        self.started = time.time()
        self.last_said = 0.0

    def _on_training_start(self) -> None:
        self.log.write_text("")

    def _on_step(self) -> bool:
        for done, info in zip(self.locals["dones"], self.locals["infos"]):
            if not done:
                continue
            self.lives += 1
            life = {k: v for k, v in info.items() if k not in ("episode", "terminal_observation", "TimeLimit.truncated")}  # (the game's tally alone)
            life["reward"] = float(info.get("episode", {}).get("r", 0.0))
            life["decisions"] = int(self.num_timesteps)
            with self.log.open("a") as f:
                f.write(json.dumps(life) + "\n")
            self.recent = (self.recent + [life])[-20:]
            q = life["quests"]
            never = [k for k in ("bought", "sold", "crafted", "salvaged", "chopped", "shifts", "chests", "ales") if not life.get(k)]
            print(
                f"  life {self.lives}: level {life['level']}, {life['money']} copper, {q['done']}/{q['taken']} quests, {life['falls']} falls, {life['kills']} slain; "
                f"windows {sum(life['windows'].values())}, indoors {sum(v for k, v in life['places'].items() if k != 'outdoors') / 60:.0f} min; reward {life['reward']:.2f}"
                + (f"; never: {', '.join(never)}" if never else ""),
                flush=True,
            )
        now = time.time()
        if now - self.last_said >= 60:
            self.last_said = now
            rate = self.num_timesteps / max(1e-9, now - self.started)
            left = (self.total - self.num_timesteps) / max(rate, 1e-9)
            mean = lambda k: sum(l[k] for l in self.recent) / max(1, len(self.recent))
            print(
                f"{self.num_timesteps:,}/{self.total:,} decisions ({rate:.0f}/s, about {left / 60:.0f} min left), {self.lives} lives; "
                f"last {len(self.recent)}: reward {mean('reward'):.2f}, level {mean('level'):.1f}, falls {mean('falls'):.1f}",
                flush=True,
            )
        return True
