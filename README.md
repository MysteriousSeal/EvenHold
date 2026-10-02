# EvenHold

*The old kingdom fell long ago. Its villages hold on between the forests, its
ruins lie under the mist, and below them the dead keep their crypts. Somebody
has to go down there.*

EvenHold is a small isometric adventure in a hand-built voxel world: wander a
medieval countryside, take work from the village notice boards, fight what
lives in the wilds, and go down into the crypts beneath the old ruins.

<!-- A hero shot here makes the biggest difference: drop it in docs/screenshots/ and uncomment.
![EvenHold](docs/screenshots/hero.png)
-->

## What awaits you

- **A living countryside.** Villages with their inns, smithies and wells,
  roads and fields between them, forests and meadows beyond. Villagers go
  about their day, and the clock turns from morning to night.
- **The roads.** Roads join the villages, with pedlars, pilgrims and guards
  walking them. Stop a pedlar to trade, or ask a pilgrim the way to the
  nearest crypt.
- **The wilds.** Wolf packs in the woods, boars rooting in the undergrowth
  (leave them be and they'll leave you be), and bandits in their palisaded
  camps. Mossy boulders, fallen logs and old standing stones, meadows of
  wildflowers, butterflies by day and fireflies by night.
- **The ruins.** Crumbling keeps and chapels, lost in a mist that rolls in
  thick at night. Something still drifts between their stones.
- **The crypts.** Beneath each ruin, a crypt of its own: its passages
  guarded by the dead (swordsmen, bowmen, and worse), deeper and nastier the
  further you go. Clear enough of it and its lord wakes in the great hall.
- **The inn.** Sit at the bar for an ale or a hot pie, buy and sell with the
  barmaid, and in the evening ask her for a room for the night. Mind the
  bouncer: swords stay sheathed in here.
- **The smithy.** Arms and armour to buy, and the smith will take your old
  gear off your hands. The finest helms aren't for sale: a winged helm, a
  dragonscale helm or an old king's crown waits in a crypt lord's hoard.
- **Quests.** The notice board in every village square has work for those
  who'll take it.
- **The herbalist.** In every village, a green-hooded herbalist keeps shop
  in a thatched hut near the middle, a cauldron bubbling by the hearth:
  health and energy potions to buy, and they'll take your raw ingredients.
- **Wells.** Toss in a silver coin and you may walk away blessed.

<!-- More shots: the inn, a crypt, the ruins in the mist.
![The inn](docs/screenshots/inn.png)
![A crypt](docs/screenshots/crypt.png)
![The ruins](docs/screenshots/ruins.png)
-->

## Controls

| Action | Key |
| --- | --- |
| Move | **W A S D** or the arrow keys |
| Strike | **Space** |
| Roll (untouchable for a moment) | **Shift** |
| Guard (raise it as a blow lands to parry) | Hold **Q** |
| Eat or drink from the action bar (drag food and drink onto it from your bag) | **1** to **8** |
| Interact (pick up, talk, sit, open, enter) | **E** |
| Focus a foe | **Click** it, or **Tab** to the next (**Shift+Tab** back) |
| Clear the focus | **Escape** |
| Bag | **B** |
| Hero sheet | **C** |
| Spend points | **P** |
| Quest journal | **L** |
| At the bar: an ale, a pie | **F**, **G** |
| By the barmaid: rent a room · by its bed at night: sleep | **G** |
| Zoom | **Mouse wheel** |
| Pause | **Escape** |

## Staying alive

- **You don't heal on your own.** Food gives health back, drink gives energy
  back, slowly, sat down. Carry some. Potions work at once, mid-fight, but
  only one every 30 seconds.
- **Energy runs down through the day.** Below 25 you'll slow to a trudge.
  A night's sleep in a rented room puts it all right.
- **Falling has a price.** You'll come round at the last inn you visited,
  worse for wear for a while.
- **Mind your bag.** It holds 24 slots, and each bag you fit to its sockets
  adds 6 more, up to 48. Pedlars sell bags, and the odd bandit or draugr
  drops one. Junk stacks 20 to a slot. Right-click food to eat it, or a bag
  to fit it; drag anything out onto the ground to drop it. Drag food, drink
  and potions onto the action bar to have them on **1** to **8**.
- **Weigh your gear.** Hover a piece of gear in your bag or a shop and it
  tells you what wearing it instead would change: green for gains, red for
  losses, and how much better or worse it is all told.
- **Levels bring points.** Spend them (**P**) on Strength, Agility, Stamina
  or Endurance, and gear adds its own on top. Slaying a crypt's lord is
  worth a point of its own.
- **Read the colours.** A foe's level is coloured by how dangerous it is to
  you. A yellow health bar means it won't start a fight, but it'll finish one.
- **Some foes tell you what's coming.** Watch for marks on the ground, and
  roll out of them (**Shift**).
- **Mind your breath.** Blows, rolls and blocked blows spend it, the thin
  green bar under your health. Raise your guard (**Q**) just as a blow lands
  to parry it: the foe reels, and your next blow on it lands twice as hard.

The game saves itself as you play, in your browser.

## Run it yourself

You'll need [Node.js](https://nodejs.org) 18 or newer.

```bash
git clone https://github.com/MysteriousSeal/EvenHold.git
cd EvenHold
npm install
npm run dev
```

Then open the address it prints (usually <http://localhost:5173>) in your
browser.
