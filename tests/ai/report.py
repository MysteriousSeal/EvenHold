"""What training tells as it goes (train.py): a progress line redrawn every second (how far, how fast, how long left,
whether it's playing or learning from what it played), and, as they come, lines that stay: each update's lessons
(how sure its choices are getting, how well it foresees its rewards, how much it changed), and how the lives (the
player's) or fights (the fighter's) just ended went."""

import sys
import threading
import time
from collections import deque

import numpy as np
from stable_baselines3.common.callbacks import BaseCallback

CLEAR = "\r\033[K"  # back to the start of the line, and the line cleared (the progress line, redrawn)


def clock(seconds: float) -> str:
    seconds = int(max(0, seconds))
    h, m, s = seconds // 3600, seconds // 60 % 60, seconds % 60
    return f"{h}h{m:02d}m{s:02d}s" if h else f"{m}m{s:02d}s"


class Reporter(BaseCallback):
    def __init__(self, total: int, name: str):
        super().__init__()
        self.total = total
        self.name = name
        self.phase = "starting the games"
        self.updates = 0
        self.ended = deque(maxlen=50)  # the last lives or fights ended (their info, and their reward)
        self.batch = []  # those ended since last told
        self.lock = threading.Lock()
        self.stopping = threading.Event()

    # A line that stays (the progress line drawn again under it, next second).
    def say(self, text: str) -> None:
        with self.lock:
            sys.stdout.write(f"{CLEAR}{text}\n")
            sys.stdout.flush()

    def _draw(self) -> None:
        done = self.num_timesteps - self.first
        share = min(1.0, done / self.total)
        gone = time.time() - self.started
        rate = done / gone if gone > 0 and done > 0 else 0
        left = (self.total - done) / rate if rate > 0 else 0
        filled = int(share * 30)
        bar = "█" * filled + "░" * (30 - filled)
        with self.lock:
            sys.stdout.write(f"{CLEAR}[{bar}] {share:6.1%}  {done:,}/{self.total:,} steps · {rate:,.0f}/s · {clock(gone)} gone, {clock(left)} left · {self.phase}")
            sys.stdout.flush()

    def _tick(self) -> None:
        while not self.stopping.wait(1.0):
            self._draw()

    def _on_training_start(self) -> None:
        self.first = self.num_timesteps
        self.started = time.time()
        threading.Thread(target=self._tick, daemon=True).start()

    def _on_rollout_start(self) -> None:
        values = self.model.logger.name_to_value
        if self.updates and "train/entropy_loss" in values:
            self.say(
                f"update {self.updates}: choices {-values['train/entropy_loss']:.2f} unsure (falls as it grows sure), "
                f"rewards foreseen {values.get('train/explained_variance', 0):.0%} (explained variance), "
                f"value loss {values.get('train/value_loss', 0):.3f}, changed {values.get('train/approx_kl', 0):.4f} (KL), "
                f"clipped {values.get('train/clip_fraction', 0):.0%}"
            )
        self.phase = f"playing: {self.model.n_steps * self.model.n_envs:,} steps to gather, on {self.model.n_envs} games"

    def _on_rollout_end(self) -> None:
        self.updates += 1
        self.phase = f"learning from them: update {self.updates} ({self.model.n_epochs} passes)"

    def _on_step(self) -> bool:
        for info, done in zip(self.locals["infos"], self.locals["dones"]):
            if done:
                self.batch.append(info)
                self.ended.append(info)
        # (told together: the player's lives as each round of them ends, all at once; the fighter's, twenty at a time)
        enough = self.model.n_envs if self.name == "player" else 20
        if len(self.batch) >= enough:
            self.say(self._tell(self.batch, self.name))
            self.batch = []
        return True

    def _on_training_end(self) -> None:
        self.stopping.set()
        self._draw()
        sys.stdout.write("\n")
        if self.ended:
            self.say(f"over the last {len(self.ended)}: " + self._tell(list(self.ended), self.name, short=True))

    @staticmethod
    def _tell(infos: list, name: str, short: bool = False) -> str:
        mean = lambda k: float(np.mean([i.get(k, 0) for i in infos]))
        reward = float(np.mean([i["episode"]["r"] for i in infos if "episode" in i] or [0]))
        if name == "player":
            head = "" if short else f"{len(infos)} lives ended: "
            return (
                f"{head}level {mean('level'):.1f}, experience {mean('xp'):.0f}, quests taken {mean('taken'):.1f} done {mean('quests'):.1f}, "
                f"damage dealt {mean('dealt'):.0f}, chests {mean('chests'):.1f}, cleared {mean('cleared'):.1f}, falls {mean('falls'):.1f}, "
                f"places found {mean('found'):.1f}, ground walked {mean('patches'):.0f}; reward a life {reward:.2f}"
            )
        won, fell = mean("won"), mean("fell")
        head = "" if short else f"{len(infos)} fight{'s' if len(infos) > 1 else ''}: "
        return f"{head}won {won:.0%}, fell {fell:.0%}, out of time {max(0.0, 1 - won - fell):.0%}, health lost {mean('taken'):.1f}; reward a fight {reward:.2f}"
