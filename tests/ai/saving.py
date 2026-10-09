"""The player saved (train.py, report.py): the model (<name>.zip, to train on from) and its policy's weights as JSON
(<name>.json, to play with in TypeScript: policy.ts, play.ts, watch.ts), with how far it's trained and the score it
had (the mean of its last lives' pay). Two are kept: `player`, the latest, saved every few passes and at the end;
`best`, the one that scored highest, saved whenever the score tops the best saved so far."""

import json
from pathlib import Path

import torch
from stable_baselines3 import PPO

MODELS = Path(__file__).resolve().parent / "models"
LATEST = "player"
BEST = "best"


def save(model: PPO, name: str, score: float | None = None) -> None:
    MODELS.mkdir(exist_ok=True)
    model.save(MODELS / f"{name}.zip")
    layers = [m for m in model.policy.mlp_extractor.policy_net if isinstance(m, torch.nn.Linear)]
    head = model.policy.action_net
    as_list = lambda t: t.detach().cpu().numpy().tolist()
    (MODELS / f"{name}.json").write_text(json.dumps({
        "activation": "tanh",
        "layers": [{"weight": as_list(l.weight), "bias": as_list(l.bias)} for l in layers],
        "head": {"weight": as_list(head.weight), "bias": as_list(head.bias)},
        "splits": [int(n) for n in model.action_space.nvec],
        "steps": int(model.num_timesteps),
        "score": score,
    }))


def score_of(name: str) -> float | None:
    """The score the saved player had, if one's saved (read from the JSON's tail, not the weights)."""
    path = MODELS / f"{name}.json"
    if not path.exists():
        return None
    text = path.read_text()
    tail = text[text.rfind('"score"'):]
    try:
        return json.loads("{" + tail)["score"]
    except (ValueError, KeyError):
        return None


def forget(name: str) -> None:
    for suffix in (".zip", ".json"):
        (MODELS / f"{name}{suffix}").unlink(missing_ok=True)
