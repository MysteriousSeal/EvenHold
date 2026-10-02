# Changelog

What's new in each version of EvenHold. The version you're playing is shown
in the bottom-left corner of the screen.

## [0.5.0] - 2026-10-03

Caves in the hills, something waiting at the bottom of each, and a pause
menu to match the title.

### The caves

- Out in the wilds, a cave in every stretch of the land: a craggy outcrop of
  rock at the foot of a rise, a dark mouth in its face. Walk up and press
  **E** to go in. Like the crypts, each has a name, a level (by how far it
  lies from where you started) and how much of it you've cleared.
- No two alike: a straight way in, then burrows winding down through lumpy
  chambers, dens off to the side, and a great nest at the far end. Not a
  straight wall in them.
- Dark down there. The light is the glowcaps' teal and the crystals'
  lavender, and the daylight spilling down the worn steps you came in by.
  Stalagmites, still pools, roots, old bones, cobwebs in the nooks.
- What lives there:
  - **Bats** near the mouth, in flocks, flitting about as they come. They
    bite and dart off again.
  - **Cave spiders** further in and in every den. From a little way off
    they spit webs at you: caught, you're **Webbed** and walk far slower
    for a moment. Close up they crouch and leap.
  - **Cave worms** deep down, under the ground where you can't see or strike
    them. Watch for the earth heaving under you and get off it. Then the
    worm bursts up, and it stays up a while to be fought before it digs
    down again.
- **The brood mother.** Her nest is webbed shut until you've cleared four
  fifths of the cave. Walk up to the webs to see how far you've got. Then
  the silk tears, and she waits on her silk until you step in. She spits
  webs three at a time and charges, and as she's hurt her brood hatches
  from the egg sacs round her nest.
- Slay her for a point to spend (once a cave), her hoard (gold and a fine
  piece of gear, wrapped in a silk cocoon), and a crack in the nest's wall
  opening onto the daylight, a quick way out.
- The cave's beasts drop their own spoils: spider silk, venom glands,
  chitin shards, bat wings and worm teeth, for selling.
- What you've slain stays slain, between visits and in your save.

### The pause menu

- Reworked in the gold-edged style of the main menu: your hero's portrait,
  name, level, day and world; Resume; zoom and inner walls changed right
  there; the controls; back to the main menu. It opens at once.

### Faster

- Foes finding their way round things, and you bumping into them, take far
  less work: the same game, smoother where it's crowded.

## [0.4.0] - 2026-10-02

A main menu worth arriving at, your heroes side by side, and a hero made the
way you want them.

### The main menu

- It opens on a flight over a voxel valley at dusk: clouds drifting, birds
  wheeling, forests, a lake and snowy peaks, gliding down into a heroes' camp
  as its fire flares up and the title lands. A key or a click skips it.
- Your heroes, up to eight, stand before the fire, each in their own look
  and gear. Pick one from the roster on the right (or click them in the
  world): they step forward into the light. **Enter World** takes you in.
- The roster shows each hero's portrait, level, day and world, with a slot
  for each place left. Eight heroes at most: delete one to make room (it asks
  twice).
- A village saying on a signboard under the title, a different one each
  time.
- The controls, grouped, their keys drawn as keycaps.
- No more seed in the address bar: a reload takes you back into the world
  you were playing, and **Main menu** in the pause menu takes you out.

### Making a hero

- A character creation screen: your hero stands close up before the fire;
  drag to turn them.
- On the left, their appearance: body, skin, face, hair style, hair colour,
  beard and clothes, each changing them as you choose. **Surprise me** for a
  whole new look; a helm to try on, to see how their hair sits under it.
- On the right, their name (the dice for another) and the world: a seed
  (any word or number makes the same world for anyone), or leave it blank
  for one left to chance. Type a seed of one of your worlds and its hero
  carries on there.
- More to choose from: eight skin tones, eight hair colours, eight dyes,
  two new hair styles for men (shaggy, a warrior's tail), and five faces:
  calm, cheerful, stern, wistful and sly. Villagers wear them all too.

### People

- Everyone is shaded as a rounded form, with a warm light catching their
  edges, while staying every bit as blocky.
- Close up (the menu, your hero sheet, portraits), faces and hands are drawn
  finer: eyes that catch the light, thin brows and smiles, a nose, strands
  of hair, fingers.
- Every hair style redrawn to fit its name: long hair falls to the
  shoulders, a bob frames the face, ponytails and pigtails hang against the
  head.
- Hair that hangs (long hair, braids, tails) now shows under open helms:
  caps, hats, circlets, crowns, the horned and winged helms.

### Fixes

- Rolling into something indoors could lose your hero and black out the
  screen, and the save with them. They're now never lost, and an old save
  that was caught by it brings them back whole.
- A seed of very long digits (or written like 1e30) opened some other
  world; it now makes a world of its own.

## [0.3.0] - 2026-10-02

Fighting with your feet and your shield, a herbalist in every village, and
a bag that's easier to live out of.

### Fighting

- **Roll (Shift):** dive a few steps the way you're going, untouchable for
  most of it. Roll out of a foe's marked ground.
- **Guard (hold Q):** cuts the blows you take: a shield more, a tower shield
  all of them. Raise it just as a blow lands to parry: the foe reels, and
  your next blow on it lands twice as hard.
- **Breath:** a thin green bar under your health. Blows, rolls and blocked
  blows spend it; it comes back a moment later. Tired, you have less of it.

### Gear

- Every helm and hood reworked in relief: raised rims, ridges, rivets,
  nose guards, brims, folds.
- Ten new helms: a kettle hat, a bascinet and a barbute at the smithy; a
  sallet on the road guards; a horned helm on bandits; and a winged helm, an
  elven circlet, a bone helm, a dragonscale helm and an old king's crown in
  the crypt lords' hoards.
- Shields reworked in relief: rims, iron bands, bosses, a raised sun; the
  buckler round.
- Hover gear to see what wearing it instead would change, WoW-style: the
  overall gain or loss in percent, then each change in green or red.
- Item tooltips laid out in parts: what it is, what it gives, the
  comparison, a word about it, its price, then how to use it.

### Food, drink and potions

- Food and drink now restore a share of your most (an apple a tenth, a roast
  leg half) over 15 seconds. You sit down to eat, your weapons put away,
  bringing it to your mouth now and then; moving, fighting or a blow stops
  the meal. A buff shows what you're eating and the time left.
- Health and energy potions, minor, lesser and greater: drunk at once, even
  mid-fight, then 30 seconds before another.
- An action bar along the bottom: drag food, drink and potions onto it from
  your bag and use them with **1** to **8**.
- Wolves now leave raw wolf meat, a cooking ingredient.

### The herbalist

- A herbalist in every village, in a thatched hermit's hut of fieldstone and
  daub near the middle, a sign, herbs drying and a cauldron outside.
- Inside, an earthen-floored workroom: a cauldron bubbling green before the
  hearth, a worktable, a drying rack, a shelf of potions, their bed, and the
  counter where they sell potions and buy your ingredients.
- The herbalist and the smith now put down their work as soon as you come
  to their counter.

## [0.2.0] - 2026-10-02

The roads, the life along them, and a bag that holds more.

### The world

- Roads between the villages, every village joined to at least two others.
- Travellers on the roads: pedlars with a pack of wares to trade, pilgrims
  who know where the nearest crypt lies, and guards walking in pairs. Talk to
  one with **E**. They keep to their side of the road and give way to each
  other. The wild foes leave them be, and the guards go after any foes they
  meet.
- Rocks and landmarks out in the wilds: mossy boulders, layered outcrops,
  fallen logs, cairns, old dry-stone walls, and now and then a ring of
  standing stones.
- Meadows of wildflowers: poppies, bluebells, daisies, buttercups, foxgloves,
  lavender and clover.
- Butterflies over the meadows by day, songbirds that take off as you come
  near, and fireflies at dusk and through the night.
- A foe's health bar now shows above the trees, like its name and level.

### Your hero

- You now slow down below 25 energy, whatever your Endurance. Endurance
  still gives you more energy before that.

### Your bag

- The bag holds 24 slots. Four bag sockets along its top each take a bag
  for 6 more slots, up to 48. When it's full, nothing new goes in, but more
  of something you already carry still does.
- Four bags to find: a rough sack, a leather satchel, a traveller's pack and
  a tooled bag. Pedlars sell them, and bandits and draugr sometimes drop
  them. Drag one onto a socket or right-click it to fit it. Take it off the
  same way, as long as everything still fits without it.
- Junk stacks 20 to a slot; more starts another stack. Drag a stack onto the
  ground and the item comes off that stack.
- The bag is laid out in groups, each under its own heading: Gear, Food &
  drink, Ingredients, Quest items, Bags and Junk. Free slots sit at the
  bottom. Drag items to rearrange them within their group, or press **Sort**
  to tidy everything.
- Hover an item to see it turning in a small window above its tooltip.
- What you pick up floats up over your hero, in its quality's colour and
  with its kind: "+ Wolf fang (Junk)".

## [0.1.0] - 2026-10-02

The first version: the whole of the realm so far.

### The world

- A countryside made anew for every game: villages, roads, fields, forests,
  meadows and lakes, in hand-built voxels.
- Deer grazing by the woods, ducks on the ponds, cats about the villages.
- A day that passes as you play (an hour for every real minute), from
  morning through to night.
- Old ruins of keeps and chapels, lost in a mist that lies thick at night
  and at dawn, thinner by day.

### Villages

- Villagers with homes and days of their own, going between their houses,
  the square and the inn, and working the fields.
- The inn: a barmaid behind the bar who serves the regulars as well as you,
  a waitress at the tables, and a bouncer by the door. Sit at the bar for an
  ale (**F**) or a hot meat pie (**G**), or trade with her for food and drink.
- Rooms upstairs at the inn, let by the barmaid from four in the afternoon,
  for 50 copper: sleep in its bed at night and wake at eight, rested and
  whole. The other rooms stay locked.
- Weapons stay sheathed in the inn: no fighting there.
- The smithy: a blacksmith at his forge with weapons and armour to sell, and
  an eye for what you'd sell him.
- Notice boards with work to take on: foes to slay and things to bring back.
- Wells to toss a silver coin into, for a blessing.
- Benches on the village squares, to sit and watch the day go by.

### The wilds

- Wolf packs in the forests and on the meadows.
- Boars rooting in the woods, which won't start a fight but will finish one.
- Bandits in their palisaded camps.
- Ghosts drifting through the old ruins, their touch cold enough to slow
  you. They never leave their ruin.
- Foes grow tougher the further you go from where you started.

### The crypts

- A crypt beneath every ruin, each with a name of its own and a level.
- Their dead stand guard: skeleton swordsmen, skeleton bowmen, and draugr in
  rusted mail, whose frost breath and axe are worth watching for.
- A bar showing how much of a crypt you've cleared. Clear most of it and its
  lord wakes in the great hall.
- The crypt's lord: a boss with attacks of his own to learn. His fall is
  worth a point to spend (once for each crypt), a chest of his hoard, and a
  quicker way out.
- What you clear stays cleared.

### Your hero

- A new face and name every game, in a range of builds, hair and colours.
- Gear for every slot: helmets, armour, gloves, boots, rings, weapons and
  shields, all shown on you as you wear them.
- Levels, and points to spend on Strength, Agility, Stamina and Endurance.
- Health that doesn't come back on its own: food gives it back, drink gives
  back your energy, and a good night's sleep gives back both.
- Energy that runs down through the day. Run low and you'll slow down.
- Falling in battle costs you some coin, and you wake at the last inn you
  visited, weary for a while.

### Interface

- Focus a foe by clicking it, or cycle through those in sight with **Tab**.
- Your bag (**B**), hero sheet (**C**), points to spend (**P**) and quest
  journal (**L**).
- Tracked quests on screen, floating numbers for blows and coins, and the
  time of day.
- The game saves itself as you play.
