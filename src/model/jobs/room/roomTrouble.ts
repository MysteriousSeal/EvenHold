// What a pleasure worker's clients say when they're trouble (roomShift.ts; the rest of them: roomLines.ts): one who
// pays half, one who won't pay and is rough about it, a crown's soldier who thinks the crown needn't. Each has their
// own at the door (`knocks`), as it shuts (`inside`) and after (`after`: not paying), whatever tone the hero took;
// pressed to pay, they give in (`GIVES_IN`) or hold out (`holds`); the bouncer called, they pay (`BOUNCER`). Said by
// a man or a woman alike.
import type { Said, Trouble } from './roomLines';

export const TROUBLE: Record<Trouble, Said & { holds: readonly string[] }> = {
  skinflint: {
    knocks: [
      'How much? For an hour? I could buy a goat for that. ...Fine. Let me in, but it had better be good.',
      "The price on the door is robbery. Still, I'm here now. Let me in.",
      'Is there a cheaper rate for half an hour? No? A quarter of an hour? ...All right, the hour. Let me in.',
      "I've counted my coins twice on the stairs. I have exactly enough, so don't expect a tip. Open up.",
      'At the last inn they charged half this, and gave me supper. Never mind. Let me in.',
      "I'll pay the price, but I want it written down what I get for it. No? Then I'll trust you. Reluctantly.",
      'Do you take turnips instead of coin? No? Eggs? ...Coin, then. You people have no sense of trade.',
      "My cousin said he paid less. My cousin is a liar, but still. Let me in, and we'll discuss it after.",
    ],
    inside: [
      'Before we start: does the hour begin now, or when my boots are off?',
      "I'm not paying extra for the candle. Blow it out.",
      "I want everything that's included, and I want to know what's included.",
      "Don't dawdle. I'm paying by the hour and I mean to use every minute of it.",
      "If I finish early, do I get some of my money back? No? Then I'll take my time.",
      'Is that candle on my bill? Is the bed? Tell me now, before I sit on it.',
      "I'll keep my purse where I can see it, if it's all the same to you.",
      "I've paid for an hour. If you've a sand-glass, turn it over now.",
      "Don't bother with the wine. I'm not paying for wine.",
    ],
    after: [
      "It was fine. But it wasn't worth the full price. Here's half, and that's generous.",
      "I didn't even come. Half a job gets half the price.",
      "I've had better fucks for free behind the stable. Here's half, and be glad of it.",
      "I've had better for less. I'm paying half, and you can count yourself lucky to get it.",
      "You stopped for a drink of water in the middle. I'm taking that off the price. Here's half.",
      "Half now. I'll bring the rest next week. ...I won't, but it sounds better than saying no.",
      'I timed it. That was nowhere near an hour. I pay for what I get, and I got half.',
      "The bed creaked the whole time. I'm not paying full price for a creaking bed. Here's half.",
      "I've left half on the table. The other half I'm keeping for the stairs I had to climb.",
    ],
    holds: [
      "Half is what you're getting. Shout as much as you like.",
      "I've said half, and half it is. I didn't get rich by paying what people ask.",
      'Scream the house down if you want to. My purse stays shut.',
      'Take the half or take nothing. I can walk out of here either way.',
      "I haggle for a living. You won't out-shout me. Half.",
    ],
  },
  rough: {
    knocks: [
      "Out of my way, I'm coming in. I've had a bad day, and you're going to make it better.",
      "Open up. I've been drinking since noon and I don't like to be kept waiting.",
      'I lost at dice tonight and somebody is going to make it up to me. It might as well be you. Open the door.',
      "Don't just stand there looking at me. I know what I want, and I don't want a conversation.",
      'The last one who kept me waiting at a door was sorry for it. Open up.',
      "I've just been thrown out of the bar downstairs. I'm not going to be thrown out of here as well. Open up.",
      'Stop looking at me through the gap and open the fucking door.',
      "I pay, so I say how it goes. Remember that, and we'll get along fine.",
    ],
    inside: [
      'Shut your mouth and get your clothes off.',
      "I said I don't like waiting. On the bed. Now.",
      "You'll do what I say, when I say it. Start by getting on your knees.",
      "Don't look at me like that. Just lie down and keep quiet.",
      "Bolt that door. I don't want to be interrupted, and you don't want to be heard.",
      "Quit smiling. I'm not paying you to smile.",
      "Clothes off. I haven't got all night, and neither have you.",
      "I don't want your name and I don't want your talk. Get on the bed.",
      "You'll want to be nice to me. People who aren't nice to me regret it.",
    ],
    after: [
      'Pay you? You should be paying me. Now get out of my way.',
      "I've had better fucks from my own hand. I'm not paying for that.",
      'You had your fun and you want paying as well? Greedy. Get out of my way.',
      "I'm not paying for that. I've had more fun falling off a horse. Move.",
      "The money's gone. I lost it at dice before I came up. What are you going to do about it?",
      "You want coin? Ask whoever comes next. I'm leaving, and you're not going to stop me.",
      "Pay? I've given you the best hour of your night. We're even. Get away from the door.",
      "I don't pay for things. I take them. You'd know that if you knew who I was.",
      "Touch my purse and I'll break your fingers. I'm going.",
    ],
    holds: [
      "You want paying? Here. That's your payment.",
      'Nobody talks to me like that. Take this instead, and remember it.',
      'I warned you to get out of my way.',
      'Ask me again. Go on. ...I thought you might. There.',
      "That's for the cheek. Next time, keep your mouth shut.",
    ],
  },
  soldier: {
    knocks: [
      "Crown's soldier. Open the door. I have leave until dawn and I mean to use it.",
      "Open up, in the king's name. That's a joke. Mostly. Let me in.",
      "Three months I've been on the border, sleeping in mud. Tonight I sleep in a bed, and not alone. Open up.",
      'My captain says this house is off limits to the garrison. My captain is asleep. Let me in.',
      "I burned a village for the crown last week. I'd like one night of not thinking about it. Open the door.",
      "Sergeant of the garrison. I'm inspecting this house for the crown. The inspection starts with you. Open up.",
      "We march north tomorrow, and half of us won't come back. Give a soldier a decent last night.",
      "I've a king's warrant to search any room I please. I please to search this one. Let me in.",
    ],
    inside: [
      "Stand to attention. No, not you. ...That's a soldier's joke. Get on the bed.",
      "Take off my boots. That's an order. Then take off everything else.",
      "I've had my orders shouted at me for three months. Tonight I give them. Strip.",
      'Lay my sword where I can reach it. Old habit. Now come here.',
      "At ease. That's the last order you'll hear from me that lets you rest.",
      "Help me off with this mail. It's been on for three weeks. Then the rest.",
      "In the king's army we take what we're given and we're grateful. Tonight I do the taking.",
      "I've stood guard in the rain for a month thinking about a room like this. Come here.",
      'Lock the door. If my sergeant comes looking for me, I was never here.',
    ],
    after: [
      "The crown doesn't pay for what it can take. Put it on the king's bill.",
      'The crown fucks everyone and pays no one. Why should its soldiers be any different?',
      "You've had the king's own army in your bed. Most people get that for nothing.",
      "I serve the king, and tonight you served me. That makes you a loyal subject. Loyal subjects don't send bills.",
      'Pay? I keep the bandits from burning this inn down. Call it your share of the taxes.',
      "My pay is three months late. When the crown pays me, I'll pay you. Don't wait up.",
      'Send the bill to the garrison. The captain uses them to light his pipe.',
      'I risk my neck for people like you. An hour of your time is the least you owe me.',
      "Soldiers on the king's business are quartered free. This was the king's business. Good night.",
    ],
    holds: [
      "Raise your voice to a crown's soldier again and you'll hang. Take that, to remember it by.",
      "You're threatening a soldier of the king? Here is the king's answer.",
      "I've killed people for less than that. Tonight you only get my fist.",
      'Insolence to a soldier of the crown. That is what it costs.',
      'You forget who carries the sword in this room. Let that remind you.',
    ],
  },
};

export const GIVES_IN: readonly string[] = [
  "All right, all right! Don't make a scene. Here is your money, all of it.",
  'Keep your voice down, the whole inn will hear! Here. Take it. Take it all.',
  "Fine. Fine! I was only seeing if you'd let it go. Here's every copper.",
  "You've got a look in your eye I don't like. Here is your money. I'm going.",
  "Don't shout, don't shout! I've a family downstairs. Here, here's all of it.",
  "You'd really make trouble over this? ...You would. All right. Here is your money.",
  "I was testing you. You passed. Here's what I owe, every copper of it.",
];

export const BOUNCER: readonly string[] = [
  'No, no, not the bouncer! Here, take it, all of it. I was only joking.',
  "Wait, wait, don't call him! I've seen what he did to the last one. Here's your money.",
  "The big one from the door? There's no need for that. Look, here it is, every copper.",
  "All right! I'll pay! Just tell him to let go of my arm.",
  "Is that him on the stairs already? God. Here, take it, take the lot. I never said I wouldn't pay.",
  'He threw a man through that window last month. I heard about it. Here is your money.',
  "There's no need to bring him into this. We're all friends here. Look: paid in full.",
];
