# The player bot

A player of its own mind that plays an hour of a fresh game and writes up what the hour says about the game. It plays by the game's own keys and windows, no cheats: it sees what a player would see, and can only do what a player could.

```
npm run player                      # a new world, a new player, 60 game minutes (15–30 s of real time)
PLAY_SEED=2052870920 npm run player # the same world and player again (every run prints its seed)
PLAY_MINUTES=120 npm run player     # longer
PLAYERS=4 npm run player            # up to four at once, one a core: each its own world and report
PLAY_SEEDS=11,22,33 npm run player  # those games again, together
PLAY_QA=1 npm run player            # a QA sweep: everything untried pulls hard, so the hour tries all the world offers
```

With several at once, every line is tagged `[player · seed]`, and the run ends with the list of reports.

The report lands in `tests/bots/reports/play-<date>.md` (the folder is git-ignored). The run prints as it goes, and ends with the report's opening: who the player was, how they ended, and the signals.

## How it plays

Every game is a different player in a different world.

1. **A persona** is drawn from the seed (`persona.ts`): six traits, each 0–1 — bold, greedy, curious, industrious, social, cautious — with one standing out, and a *temperature* (how wayward the choices are). The run opens with it: "a new player: industrious and social, reckless, and changeable".
2. **Drives** are worked out from how the hero is each time it chooses (`player.ts` `drives()`): safety (hurt), rest (tired), coin (poor), growth, curiosity (while there's new country), company, craft, glory — each shaped by the traits.
3. **Every activity open to it is scored** (`persona.ts` `score`): how much it answers the drives, how much it suits the traits, how far off it is, how often it's been done in the last 10 minutes, and what it brought before. **One is drawn by its score** (softmax at the persona's temperature): the best is likeliest, never certain. The log says why: `→ Hovel of Wicked Deeds (level 1) (124 tiles off): growth, coin`.
4. **It only knows what it has seen.** Villages, inns, smithies, crypts, caves and camps count once the hero has come within 45 tiles of them (`player.ts` `notice()`), and each is announced: `found the village of Tamfield`.
5. **It learns.** When an activity ends, its outcome becomes a reward — xp and coin for, health and time (and a fall) against — and a running mean per activity feeds the next scores: what paid off is chosen more. A fall in the first seconds of an activity is blamed on the one before (the fight they came hurt from).
6. **The bot's feet do the walking** (`../bot.ts`, `../botSteps.ts`, `../ventures.ts`, `../errands.ts`, `../nav.ts`): how to get somewhere, fight, trade, work a shift, raid a camp. The player decides; the bot does. The game's own checks (`../checks.ts`) run alongside and report faults.

## Reading the run

- `→ what (how far): why` — a choice, and the drives (or learning) behind it. `(a whim)` marks one well below the best option.
- `done / fail / fell / cut short: what in N s (+xp, +copper, −health)` — how it ended and what it brought.
- `found …` — a place come into view. `level N!`, `lumberjacking 23` — risen.
- `  kills +1, orders +18` — the tally changing that second.
- `— level · health · energy · copper · quests · where` — every game minute.
- `thought of X, but nothing came of it` — chosen, but its steps found no way (then not tried again for a minute).
- The bed is taken when tired *or* hurt (a bed mends); the player stays till rested and mended.
- `⚠ kind: detail` — a fault the game's checks caught, or `player stuck in an activity` (its time budget run over).

## Reading the report

In order: **the signals** (what the hour says about the game, the part to read first), **where the hour went** and **coverage** (every activity: open in how many plans, tried, done; what was never possible, what was possible but never done) (each activity: how often, how long, done/failed/fell, xp and copper), **minute by minute** (level, xp, coin, kills, deaths, quests, foes near), coin and xp by source, falls, **what they found** and when, **what they learnt** (each activity's reward by their own reckoning), **the diary** (every choice, its why and its outcome), and **problems the game had**.

## The files

| file | what |
|---|---|
| `activities.ts` | **Everything the player can do.** One entry per activity. The place to add things. |
| `persona.ts` | Traits, drives, scoring, drawing, and what's learnt. The brain's rules. |
| `player.ts` | The player: knowledge of the world, the diary, choosing and finishing activities, the toolkit lent to activities. |
| `report.ts` | The report, and the design signals. |
| `playthrough.ts` | The runner: one game, printed as it goes. |

## Adding an activity

One entry in `ACTIVITIES` in `activities.ts`. The brain never names activities, so nothing else changes.

```ts
{
  id: 'fish',
  serves: { craft: 0.8, rest: 0.4, coin: 0.3 },      // what it answers, of the drives (0..1 each)
  traits: { industrious: 0.5, social: -0.2 },        // whom it suits: + draws them, − puts them off
  indoors: false,                                     // true only if it handles being inside a building itself
  budget: 10 * 60,                                    // game seconds it may take at most (default 8 minutes)
  options: (p) => {                                   // what it could be about just now; [] when it can't be done
    if (!p.model.hero.equipment.mainHand?.startsWith('rod')) return [];
    const shore = nearestShore(p);                    // only what the player has seen: p.known
    return shore ? [{ label: 'the lakeshore, to fish', at: shore, data: shore }] : [];
  },
  steps: (p, target) => [                             // how it's done, a step at a time (each returns 'run' | 'ok' | 'fail')
    p.walk(() => target.at!, 1),
    () => (p.model.fishing.cast() ? 'ok' : 'fail'),
    p.until(() => !p.model.fishing.casting, 60, 'the line never came back'),
  ],
}
```

Rules worth knowing:

- **`options` must be honest.** Return `[]` whenever the steps would find nothing to do (no axe, no coin, nothing in range). An activity whose steps come back empty is cooled for 60 s; one that fails within 5 s is cooled for 30 s and the player pauses a moment. Several targets means several choices, each scored on its own distance.
- **Outdoors by default.** Unless `indoors: true`, the player leaves whatever building it's in first, and the steps are worked out once it's outside. Set `indoors` only for activities that cope with being inside (heal does; craft doesn't care).
- **Keep to `p`, the toolkit** (`Toolkit` in `player.ts`): `p.model`, `p.persona`, `p.rng`, `p.known` (villages, doors, camps seen), `p.stats`, `p.skipped`; `p.go('goal')` for anything the bot already knows how to do (its goal names are in `../bot.ts` `stepsFor`); `p.walk`, `p.until`, `p.pickUp`, `p.nearestFoe`, `p.dungeonTrip`, `p.campRaid`, `p.workShift`, `p.meet`, `p.herbalistVisit`; `p.report(kind, detail)` for a game fault, `p.log` for the diary. If a new activity needs a bot step that isn't lent out yet, add it to `Toolkit` and to `kit` in the `Player` constructor.
- **Use the seed's dice** (`p.rng`), never `Math.random`, so a seed replays the same.
- **Count what's new** in the tally if the report should show it: add a field to `BotStats` in `../botSteps.ts` (and its zero), as `logs` and `crafted` are.

## Tuning the brain

- **How much something matters:** its `serves` weights. Doubling `coin` on `work` makes poor players work more.
- **A trait's pull:** `traits` on the activity. Traits are drawn in `drawPersona` (`persona.ts`); add a trait to `TRAITS` and its weak-side word to `describe`.
- **A new drive:** add it to `DRIVES` and to `drives()` in `player.ts`, then use it in activities' `serves`.
- **The scoring itself:** `score` in `persona.ts`. Distance falls off as `1 / (1 + tiles / 120)`; novelty as `0.6 ^ (times in the last 10 minutes)`; learning adds the activity's mean reward (clamped to ±0.5, trusted after about 3 tries).
- **The reward:** `finish()` in `player.ts`: `xp / 60 + coin / 40 − hurt × 1.5 − 3 if fell − seconds / 240 − 0.3 if failed`. Change these to change what the player comes to value.
- **How wayward:** `temperature` in `drawPersona` (0.2–0.55). Lower is more predictable.
- **What counts as seen:** `SEEN` in `player.ts` (45 tiles); `UNEXPLORED_WINDOW` (15 minutes with nothing new found: the country's explored, curiosity drops).
- **Time budgets:** `BUDGET` in `player.ts` (8 minutes), or `budget` on an activity (work 15, camp 15, dungeon 20). Past it the activity is given up and reported.

## Adding a design signal

`signals()` in `report.ts` is a list of plain checks over the hour (the camps-at-the-start one counts only what's in sight before a step is taken: the one near camp is by design): the diary (`player.diary`: every activity, its outcome, xp, coin, hurt, seconds), the minute-by-minute (`player.balance.data`), what was found (`player.found`), what was learnt (`player.memory.learnt`), `player.idle` (seconds with nothing to do) and `player.lowHealth` (seconds under 40% health). Push a sentence when a threshold is crossed; say what it suggests about the game, not just the number. Keep the list short: it's the part that gets read.

## Determinism

A seed fixes the world, the persona, every choice and every roll (`Math.random` and `Date.now` are taken over in `playthrough.ts`), so `PLAY_SEED` replays a game exactly — until the game's own code changes. A report that surprises you can always be watched again.
