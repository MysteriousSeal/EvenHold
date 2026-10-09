"""What the trainer says as it goes (train.py). Each life as it ends: how it ended (level, coin, quests, falls, slain),
where its time went, what it did and never did, the keys it leaned on; written to lives.jsonl too. After each
learning pass: what the policy's doing now (its key mix over the last pass, how often a decision was paid and what
for, how far it is from random) and what the learning said (the losses, the entropy, how well it foresees). Every
second, a line rewritten in place: where the training stands. A life that never opened a window, never took a quest, never went indoors is
the part to read: what the game lets a player skip. And the saving (saving.py): the latest every SAVE_EVERY passes; the
best whenever the last lives' mean pay (the score) tops the best saved so far."""

import json
import math
import time
from collections import Counter
from pathlib import Path

import numpy as np
from stable_baselines3.common.callbacks import BaseCallback

from saving import BEST, LATEST, save

DOINGS = ("bought", "sold", "crafted", "salvaged", "chopped", "shifts", "chests", "ales", "pies", "rooms", "wishes", "camps", "dungeons", "equipped", "eaten", "potions", "pointsSpent")


def minutes(seconds: float) -> str:
    return f"{seconds / 60:.0f} min"


class Reporter(BaseCallback):
    SAVE_EVERY = 5  # learning passes between saves of the latest
    SCORED_OVER = 20  # lives the score is the mean pay of

    def __init__(self, total: int, log: Path, keys: list[str], best: float | None = None):
        super().__init__()
        self.total = total
        self.log = log
        self.keys = keys
        self.best = best if best is not None else -math.inf  # the best score saved
        self.lives = 0
        self.passes = 0
        self.recent: list[dict] = []
        self.started = time.time()
        self.last_said = time.time()
        self.record = -math.inf  # the best single life's pay
        self.pending = False  # a status line on the screen, to be gone past before anything else is said
        self.lately = (time.time(), 0)  # when and how far, a little while ago: the speed of late

    def _on_training_start(self) -> None:
        self.log.write_text("")
        print(f"The keys: {', '.join(self.keys)}.\n", flush=True)

    def _on_step(self) -> bool:
        for done, info in zip(self.locals["dones"], self.locals["infos"]):
            if done:
                self._life(info)
        now = time.time()
        if now - self.last_said >= 1:
            self.last_said = now
            self._standing(now)
        return True

    # A life over: told in full, and logged.
    def _say(self, text: str) -> None:
        if self.pending:
            print(flush=True)
            self.pending = False
        print(text, flush=True)

    def _life(self, info: dict) -> None:
        self.lives += 1
        life = {k: v for k, v in info.items() if k not in ("episode", "terminal_observation", "TimeLimit.truncated")}  # (the game's tally alone)
        life["reward"] = float(info.get("episode", {}).get("r", 0.0))
        life["decisions"] = int(self.num_timesteps)
        with self.log.open("a") as f:
            f.write(json.dumps(life) + "\n")
        self.recent = (self.recent + [life])[-20:]
        q = life["quests"]
        places = sorted(life["places"].items(), key=lambda kv: -kv[1])
        went = ", ".join(f"{k} {minutes(v)}" for k, v in places if v >= 30)
        keys = Counter(life["keys"])
        pressed = sum(keys.values()) or 1
        top = ", ".join(f"{k} {n * 100 // pressed}%" for k, n in keys.most_common(5))
        did = [f"{k} ×{life[k]}" for k in DOINGS if life.get(k)]
        doors = ", ".join(f"{k} ×{n}" for k, n in life["doors"].items())
        windows = ", ".join(f"{k} ×{n}" for k, n in life["windows"].items())
        never = [k for k in DOINGS if not life.get(k)]
        best = " (the best life yet)" if life["reward"] > self.record else ""
        self.record = max(self.record, life["reward"])
        self._say(
            f"  life {self.lives} ({self.num_timesteps:,} decisions in): level {life['level']}, {life['xp']} xp, {life['money']} copper ({life['earned']} earned, {life['spent']} spent), "
            f"{q['done']}/{q['taken']} quests, {life['kills']} slain, {life['falls']} falls, {life['hurt']:.1f} bars of health lost; paid {life['reward']:.2f}{best}\n"
            f"      went: {went or 'nowhere long'}; through doors: {doors or 'none'}; windows: {windows or 'none'}\n"
            f"      did: {', '.join(did) or 'nothing of note'}; E for nothing ×{life['wasted']}; keys: {top}\n"
            f"      paid by: {', '.join(f'{k} {v:+.2f}' for k, v in life['pay'].items() if v)  or 'nothing'}\n"
            f"      never: {', '.join(never) or 'nothing left untried'}"
        )

    # The score: the last lives' mean pay (none till there are enough to mean anything).
    def score(self) -> float | None:
        return sum(float(l["reward"]) for l in self.recent) / len(self.recent) if len(self.recent) >= self.SCORED_OVER else None

    # Where the training stands: one line, rewritten in place each second.
    def _standing(self, now: float) -> None:
        since, steps = self.lately
        if now - since >= 5:
            self.lately = (now, self.num_timesteps)
        rate = (self.num_timesteps - steps) / max(1e-9, now - since) if now - since >= 1 else self.num_timesteps / max(1e-9, now - self.started)
        left = max(0, self.total - self.num_timesteps) / max(rate, 1e-9)
        n = len(self.recent)
        mean = lambda k: sum(float(l[k]) for l in self.recent) / max(1, n)
        text = (
            f"— {self.num_timesteps:,}/{self.total:,} decisions ({rate:.0f}/s, about {left / 60:.0f} min left), {self.lives} lives, {self.passes} passes, {(now - self.started) / 60:.0f} min in"
            + (f"; the last {n} lives: paid {mean('reward'):.2f}, level {mean('level'):.1f}, {mean('kills'):.1f} slain, {mean('falls'):.1f} falls, {mean('earned'):.0f} copper" if n else "")
            + (f" (game {sum(float(l['pay'][k]) for l in self.recent for k in ('xp', 'coin', 'quest', 'fall')) / n:+.2f}, new ground {sum(float(l['pay']['explore']) for l in self.recent) / n:.2f}, blows {sum(float(l['pay']['blows']) for l in self.recent) / n:.2f})" if n else "")
            + (f"; best saved {self.best:.2f}" if self.best > -math.inf else "")
        )
        print(f"\r{text:<160}", end="", flush=True)
        self.pending = True

    # A pass of decisions gathered: what the policy did over it, and what the learning before it said.
    def _on_rollout_end(self) -> None:
        self.passes += 1
        buffer = self.model.rollout_buffer
        rewards = np.asarray(buffer.rewards).ravel()
        actions = np.asarray(buffer.actions).reshape(-1, 2)
        paid = rewards[rewards != 0]
        moves = np.mean(actions[:, 0] != 0) * 100
        keys = Counter(int(k) for k in actions[:, 1])
        mix = ", ".join(f"{self.keys[k]} {n * 100 / len(actions):.0f}%" for k, n in keys.most_common(6))
        windows = sum(n for k, n in keys.items() if self.keys[k].startswith("row") or self.keys[k] in ("button", "page", "down", "up")) * 100 / len(actions)
        learnt = self.model.logger.name_to_value
        said = ""
        if "train/entropy_loss" in learnt:
            entropy = -learnt["train/entropy_loss"]
            said = (f"\n      the learning: entropy {entropy:.2f} (random would be {math.log(buffer.action_space.nvec[0]) + math.log(buffer.action_space.nvec[1]):.2f}), "
                    f"policy loss {learnt.get('train/policy_gradient_loss', 0):+.4f}, value loss {learnt.get('train/value_loss', 0):.4f}, "
                    f"foresight {learnt.get('train/explained_variance', 0):+.2f}, step {learnt.get('train/approx_kl', 0):.4f} kl")
        self._say(
            f"pass {self.passes} ({len(rewards):,} decisions): paid on {len(paid)} of them ({len(paid) * 100 / len(rewards):.2f}%), "
            f"{paid[paid > 0].sum():+.2f} earned, {paid[paid < 0].sum():+.2f} lost, {rewards.mean() * 1000:+.3f} per thousand; "
            f"moving {moves:.0f}% of the time, {windows:.0f}% in windows; keys: {mix}{said}"
        )
        self._save()

    # The latest saved every few passes; the best whenever the score tops the best saved.
    def _save(self) -> None:
        score = self.score()
        if self.passes % self.SAVE_EVERY == 0:
            save(self.model, LATEST, score)
            self._say(f"      saved the latest ({self.num_timesteps:,} decisions{f', scored {score:.2f}' if score is not None else ''})")
        if score is not None and score > self.best:
            self.best = score
            save(self.model, BEST, score)
            self._say(f"      saved as the best so far: scored {score:.2f} over the last {len(self.recent)} lives")
