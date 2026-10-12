// What a pleasure worker's clients say (roomShift.ts), and what the hero may say to them. A client is one of a
// temper, and everything they say comes of it: at the door (`knocks`), as it shuts behind them (`inside`), and after,
// pleased (`after`: paying, and something over). What only a man of that temper says, or only a woman, is with it
// (`male`, `female`: the client's own sex; the hero's the other). Let in, the hero's own word sets the hour's tone
// (`LET_IN`: warm, plain, teasing): the one a temper likes (`likes`) pleases them (`after`, and a tip); another
// leaves them paying the price and no more (`FLAT`). Those who are trouble have their own, whatever's said to them
// (roomTrouble.ts). Crude, in so many words; nothing shown: the time itself is passed in the dark.
import type { Build } from '../human/humanoid';

export type Temper = 'shy' | 'lonely' | 'blunt' | 'weary' | 'bold' | 'merry';
export type Tone = 'warm' | 'plain' | 'tease';
export type Trouble = 'skinflint' | 'rough' | 'soldier';
export interface Said {
  knocks: readonly string[];
  inside: readonly string[];
  after: readonly string[];
}

// What the hero says letting someone in, and taking their money after, by the tone taken; and turning one away.
export const LET_IN: Record<Tone, string> = { warm: "Come in. There's no hurry.", plain: 'Coin on the table, and come in.', tease: "Come in, then. Show me what you've got." };
export const THANKS: Record<Tone, string> = { warm: 'Thank you. Come back soon.', plain: 'Take the money.', tease: 'Same time next week?' };
export const TURN_AWAY = 'Not tonight. Go back downstairs.';

export const TEMPERS: Record<Temper, Said & { likes: Tone } & Record<Build, Said>> = {
  // Shy: new to it, nervous, or sure they'll be laughed at.
  shy: {
    likes: 'warm',
    knocks: [
      "I've never done this before. I brought the money. Do I pay you now, or after?",
      "I've had four ales and I've finally found the courage to climb those stairs. Please don't send me back down.",
      "I'm getting married on Saturday. I'd like to know what I'm doing before then. Will you teach me?",
      "Don't laugh, but I've brought you flowers. I know I don't have to. I wanted to.",
      "I've a wooden leg. Some people mind that. If you mind, say so now and I'll go quietly.",
      "I'm no beauty and I know it. That's why I pay. Be nice to me for an hour, that's all I ask.",
      "My mother thinks I'm at evening prayers. So we have until the bell rings. Let me in.",
      "I was told to ask for you by name. I've forgotten the name. Is it you? Good. Let me in.",
    ],
    inside: [
      "I'm nervous. Is that normal? Tell me it's normal, and then show me what to do.",
      'Go slowly, will you? I want this to last longer than my last three ales did.',
      "Pour us both a drink first. My hands are shaking. ...That's better. Now, where were we?",
      "Tell me what you like. Nobody ever tells me. Then I'll tell you what I like.",
      'Keep your voice down. The walls here are thin, and I know half the people downstairs.',
      "Lock it. I don't want anyone walking in. Especially not anyone I know.",
      'Close the shutters. The whole square can see in, and I have a reputation.',
    ],
    after: [
      "Nobody has ever done that to me before. I didn't know people did that. Here, take all of this.",
      "You were patient with me. Most people aren't. Here is the price, and something for the patience.",
      "Now I understand what all the songs are about. Here is your money. I'm going home to write one.",
      "That thing you did at the end. Is it legal? Don't tell me. Here is your money, and extra.",
      "I've never come twice in an hour before. I didn't know I could. Here, take all of this.",
    ],
    male: {
      knocks: ["I've never seen a naked woman in daylight. I've brought a candle and a full purse."],
      inside: ['Lie back and open your legs. I want to look at that pussy before I do anything else.'],
      after: ["I came in under a minute and you didn't laugh. That's worth the tip alone. Here.", "My wife will get a shock tonight. You've taught me where everything is. Here, take extra."],
    },
    female: {
      knocks: ["I've been wet since I saw you on the stairs. Let me in before I lose my nerve."],
      inside: ['Take my dress off, and take your time over it. Then fuck me like you mean it.'],
      after: ["So that's what a tongue is for. Nobody ever told me. Here is your money, and bless you."],
    },
  },
  // Lonely: starved of touch: widowed, ignored, or long alone.
  lonely: {
    likes: 'warm',
    knocks: [
      'I buried my spouse a year ago today. I just want to be held by somebody warm. I will pay the full price for it.',
      "It's my birthday, and nobody remembered. So I'm buying myself a present, and the present is you.",
      "I'm a tax collector. Nobody is ever pleased to see me. Pretend you are, just for an hour.",
      "I've been married thirty years, and we haven't touched each other in ten. I've forgotten how it goes. Remind me.",
      "I can't sleep. I haven't slept properly in a month. Tire me out, and I'll pay you well for it.",
      "I'm a scribe. I spend all day copying other people's love letters. I'd like something of my own, for once.",
      'I leave with the caravan at dawn, and I may never come back this way. Give me something to remember.',
      'My betrothed has run off with a soldier. I intend to spend the wedding money in this room. Open up.',
    ],
    inside: [
      'Is that a real bed? With a mattress? I may cry. Come and lie on it with me.',
      'You smell of roses. Everything in my life smells of pigs. Come here.',
      "Don't rush me. I've waited a long time for this and I mean to remember it.",
      "I've been imagining this all week. Don't say anything. Just come here.",
      "You're prettier up close than they said downstairs. Come here and let me look.",
      "Come here and put your hand between my legs. Feel that? That's been waiting for you all day.",
    ],
    after: [
      "That was kind of you, at the end. You didn't have to be kind. Here is your money, and more.",
      "Thank you. I mean it. I haven't laughed like that in bed for years. Here's your money, and extra.",
      "I came up here to forget something, and for an hour I did. Thank you. Here's the money, and more.",
      "I haven't slept in a month, and now I can barely keep my eyes open. You've cured me. Here, and extra.",
      "I'd marry you, if either of us were the marrying kind. Here. Buy yourself something nice.",
      "I cum like that once every ten years, if I'm lucky. Here is your money, and something on top.",
    ],
    male: {
      knocks: [
        'My cock has been no use to anyone but me for a year. Help me put that right.',
        "I haven't cum inside a woman in two years. I've saved up, in every sense. Open the door.",
        "Nobody has touched my cock but me in years. Years. I'll pay whatever you ask.",
      ],
      inside: ['Sit that wet pussy down on my cock, and go slowly. I want to feel every bit of it.'],
      after: ["You swallowed my cum and then smiled at me. I think I'm in love. Here is all the money I have."],
    },
    female: {
      knocks: [
        "I've had six children and not one good fuck. Tonight I'm putting that right. Open up.",
        "My husband hasn't found my cunt in ten years of looking. I'm told you know where it is.",
        "Nobody has licked me in years. Years. I'll pay whatever you ask.",
      ],
      inside: ["I want to feel you cum inside me. I've not had that in years. Now get on the bed."],
      after: ["I came three times. My husband hasn't managed once in ten years. Here, take double the tip.", "I can still feel you inside me. I'll feel it all the way home. Here, take all of this."],
    },
  },
  // Blunt: here for one thing, and saying so.
  blunt: {
    likes: 'plain',
    knocks: [
      'I want to fuck, and I have the coin for it. Is that plain enough? Let me in.',
      "I talk to people all day long. I don't want to talk. Let me in and shut the door.",
      "I want your mouth, your hands and an hour of your time. I'll pay for all three.",
      "I'll be honest: I'm here to come, as hard and as often as an hour allows. Open up.",
      "I don't want anything strange. I want exactly what everyone else gets, done well. Can you manage that?",
      "I've only got an hour before my watch starts. Let's not waste any of it talking on the landing.",
      "I haven't cum in a month. I'm so wound up I can't think straight. Let me in.",
    ],
    inside: [
      'Stop talking and get on the bed.',
      "Get your clothes off. All of them. I want to see what I'm paying for.",
      'Put the bolt across. I paid for the hour and I want all of it.',
      "Hard and fast, then slow. That's how I like it. Now strip.",
      "Make me cum with your mouth first. Then we'll use the bed.",
      "I want to cum twice before the hour's up. So you'd better start now.",
      'Shut the door behind me, and come here.',
    ],
    after: [
      'That was worth every copper. Here is your money, and a little extra for doing it right.',
      "You fuck like you mean it. Most people don't. Here is your money, and more.",
      "Same time next week? I'll bring the money, and I'll bring more of it. Here's tonight's, with a tip.",
      "That's the best fuck I've had in ten years. Here is the price, and extra for what you did with your mouth.",
      "Worth the stairs. Worth the price. Worth the lie I'll have to tell at home. Here you are, and extra.",
      'I came so hard I saw stars. Here, take your money. Take the tip as well.',
    ],
    male: {
      knocks: [
        "I've been hard since I saw you on the stairs. Let me in before it goes to waste.",
        'The one I married lies there like a dead fish. I want somebody who moves. Let me in.',
        "I'm not here for poetry. I'm here to fuck until neither of us can walk. Can you do that?",
      ],
      inside: ["Bend over the bed. I've been hard since the stairs and I can't wait any longer.", 'Take my cock in your mouth first. Slowly. I want to watch.', "Get on all fours. I don't want talk tonight. I just want to fuck."],
      after: ["I've never come that hard in my life. My balls are empty and so is my head. Here is your money, and extra.", "I'll be feeling your mouth on my cock for a week. Worth every copper, and a tip. Here."],
    },
    female: {
      knocks: [
        "I want to be bent over that bed and fucked properly. I'll pay well for it.",
        'Nobody has put his tongue in my pussy since my wedding night, and he did it wrong. Let me in.',
        "My pussy has been aching for a week, and my husband thinks it's a headache. Open the door.",
        "I'm not here for poetry. I'm here to be fucked until I can't walk. Can you do that?",
      ],
      inside: [
        "Fuck me hard, and don't you dare cum before I do.",
        "Bend me over that bed and don't be gentle. I get gentle at home.",
        "Get your face in my pussy and don't come up until I say so.",
        "Take me from behind. I don't want to look at anyone tonight. I just want to be fucked.",
      ],
      after: ['My pussy is still throbbing. I may have to sit on the stairs for a while. Here is your money, and extra.', "I'll be walking like a sailor tomorrow, and smiling. Here. You earned every copper, and the tip."],
    },
  },
  // Weary: worn out by the day, wanting the hour to be easy.
  weary: {
    likes: 'plain',
    knocks: [
      'I walked twelve miles today behind a cart of turnips. I want a bed and some company, and I can pay for both.',
      "Evening. The innkeeper says you're the new one. I have an hour to spare and a full purse.",
      'I sold three cows at the market this morning, and the money is burning a hole in my purse. Let me in.',
      "I've been thinking about this door all day at the mill. I nearly lost a finger. Let me in.",
      "I've just been paid for a whole season's work, and I've promised myself I won't spend it all here. Help me break that promise.",
      "I'm too old for this, the stairs nearly finished me. But I'm here now, and I'm not going back down unsatisfied.",
      "I've washed. I want you to know that. Properly, with soap, for the first time since Easter. Let me in.",
      "I'm the baker from across the square. You've seen me every morning. Tonight I'd like you to see a bit more of me.",
      "I haven't had a decent fuck since harvest. Tell me you're as good as they say downstairs.",
      "I've been as horny as a goat all week, and my own hand is worn out. Open the door.",
    ],
    inside: [
      'Help me with these boots first. ...Thank you. Now help me with the rest.',
      "I want you on top. I've done enough work for one day.",
      'Nice room. Better than mine. Now come over here and take that off.',
      "Use your mouth first. I've been dreaming about that mouth all week.",
      "Start with your tongue. I'll tell you when you can stop.",
    ],
    after: [
      "I can't feel my legs. Here, take your money. Take the tip as well.",
      "I'll be back next market day. Here is what I owe you, and something on top.",
      "That's the best hour I've had all year. Here. You earned it, and the extra.",
      "I'm going to walk home very slowly. Here is what I owe, and a tip for the trouble I gave you.",
      "I'll be thinking about that for a month at the mill. Here is your money, and extra. I'll try to keep my fingers.",
      "I feel ten years younger and I can't stand up. Here, and a tip. Help me find my other boot.",
      "My knees will never forgive me, and I don't care. Here's what I owe you, and extra.",
      'My legs are still shaking. Whatever that was with your tongue, I want it again next week. Here, and extra.',
    ],
    male: {
      knocks: [
        "I've been dreaming about your tits since market day. I've brought the money. Let me in.",
        "I've had my hand down my breeches all afternoon thinking about this door. Let me in and finish the job.",
        "I've been six months at sea. I'll warn you now: this won't take long.",
      ],
      inside: ["Get those tits out. I've walked a long way for them."],
      after: ["I've never cum so much in my life. I think I pulled something. Here, take the tip.", "I'll be walking bow-legged at the plough tomorrow. Worth it, and worth the tip. Here."],
    },
    female: {
      knocks: ["My husband's snoring downstairs with his face in his ale. I've an hour, and I'm aching for it."],
      inside: ["Put your tongue to work on my cunt first. I'll tell you when to stop."],
      after: ["I won't be able to sit down for a week. Worth every copper, and a few more. Here.", "I'm going to be sore tomorrow, and I'm going to smile every time it hurts. Here's your money, and a tip."],
    },
  },
  // Bold: full of themselves, and filthy with it.
  bold: {
    likes: 'tease',
    knocks: [
      "They say downstairs that you're worth the climb. Let me in, and we'll see.",
      "They say you fuck like the devil himself. I've brought silver to find out if it's true.",
      "I was here last week, with the other one. Everyone says you're better. I've come to find out.",
      "I heard you through the floor last night. I've thought of nothing else since. Open the door.",
      "I've been thinking filthy things about you since I saw you on the stairs. Let me in, and I'll tell you every one.",
      "I want to cum so hard my ears ring. They say you're the one to see about that.",
      "I do want something strange. I'll explain inside. I'll pay extra if you don't laugh.",
      "I brought my own wine. It's better than what they sell downstairs. Share it with me, and then share the bed.",
    ],
    inside: [
      "Good. Now, let's see what all the talk is about.",
      'Blow out the candle. No, leave it. I want to look at you.',
      "Take that off. Slowly. I've paid for an hour and I'd like to enjoy all of it.",
      "On the bed, on the floor, against the wall, I don't mind. You choose.",
      "On your knees first. Then we'll see about the bed.",
      'Bolt the door and get on the bed. I want to fuck until the candle burns out.',
      "Don't be quiet about it. I want the whole inn to know I'm getting my money's worth.",
    ],
    after: [
      "You're wasted in this village. You should be in the city, charging ten times this. Here, and extra.",
      'I think the people downstairs heard that. Good. Let them wonder. Here is your money, and a tip.',
      "I think I came loud enough to wake the stable boy. I don't care. Here, take extra.",
      "I'm going to tell everyone at the mill about you. Well, no. I'm going to tell nobody, and keep you to myself. Here, and a tip.",
    ],
    male: {
      knocks: [
        "I've a cock like a cart horse and nobody to appreciate it. Open the door and have a look.",
        'I want to fuck you so hard the people downstairs spill their ale. Open up.',
        "I want to bury my face between your thighs for an hour. I'll pay extra for the privilege.",
        "My wife says I'm too big and too often. I'm told you won't complain about either.",
        "I've been thinking about your pussy since I saw you carry a tray past my table. Let me in.",
        "I want to lick your pussy until you beg me to stop. I'll pay for the hour and tip for the begging.",
        "I want to fuck someone who knows how, for once in my life. They say that's you.",
      ],
      inside: [
        'Spread your legs. I want to taste your cunt before I fuck it.',
        "Sit on my face. I've wanted that all week, and my wife won't hear of it.",
        "Get on your back and wrap your legs round me. I'm going to fuck you until the bed breaks.",
        "I want to cum on your tits. I'll pay extra. Now get on your knees.",
      ],
      after: [
        'That cunt of yours should have a shrine built over it. Here is your money, and an offering on top.',
        "That's the tightest pussy between here and the coast. Here is your money and a tip, and I'll be back on Friday.",
        "Fuck. That's all I can say. Fuck. Here is your money, and more.",
      ],
    },
    female: {
      knocks: [
        'I want a cock that stays hard for longer than a prayer. Have you got one?',
        "They say your cock is the best thing in this village. I've come to judge for myself.",
        "I want your tongue between my legs until I can't remember my own name. Let me in.",
        "I want you to make me cum until I cry. I hear you can. I've brought the money.",
        "I want to be fucked by someone who knows how, for once in my life. They say that's you.",
      ],
      inside: ["Get that cock out. Let's see if it was worth the stairs.", "Lie back. I'm riding tonight, and I don't want to hear a word out of you.", 'Hands on my tits. Harder. Now get inside me before I scream.'],
      after: [
        "That cock of yours is wasted on this village. Here is your money, and extra. I'll be back for more.",
        "You made me cum so hard I bit the pillow in half. I'll pay for the pillow too. Here.",
        'Your cum is running down my leg and I have to walk past the whole bar. Worth it, and worth the tip. Here.',
        'Fuck me. Well, you just did. But fuck me, that was good. Here is your money, and more.',
      ],
    },
  },
  // Merry: making a joke of it, and of themselves.
  merry: {
    likes: 'tease',
    knocks: [
      "The one I'm married to is away until Sunday. Don't ask my name, and I won't ask yours.",
      "The priest says what you do is a sin. I've decided I can afford one sin a month. Open the door.",
      "My friends paid for this, as a joke. I'm not laughing. I'm quite keen, in fact.",
      "The fortune-teller at the fair said I'd meet someone beautiful upstairs at an inn. I've decided not to wait for fate.",
      "I came second in the archery contest today. First prize was a pig. I'm giving myself a better one.",
      "They hang poachers in this country, and I'm a poacher. I'd like one good night before they catch me.",
      "Everyone in this village knows everyone's business. Nobody knows I'm here. Let's keep it that way.",
    ],
    inside: [
      "Right. I've paid, I've climbed the stairs, and I've said a prayer. What happens now?",
      "If the bed breaks, I'm not paying for it. Let's find out if it breaks.",
      "Take your time. The longer I'm up here, the bigger the story I can tell downstairs.",
      "I've been told I snore, I kick, and I talk through it. You've been warned. Come here.",
      "I should warn you: I laugh when I'm nervous. And when I'm not. Come here.",
      'Is there a prize if I last the whole hour? There should be a prize.',
      "Mind my back. It went out last harvest and it's never forgiven me. Now, come here.",
      "I've only one rule: nobody tells the priest. Not you, not me. Take that off.",
      'Tell me if I do anything wrong. Everybody else does. Now, where do you want me?',
      "I had a speech ready for this moment. I've forgotten all of it. Just come here.",
    ],
    after: [
      "I think I saw God for a moment there. Don't tell the priest. Here is your money, and a little for the collection plate.",
      "I was going to ask for some of my money back, as a joke. I can't even joke. Here, take extra.",
      "I've changed my mind about the priest. If that's a sin, I'll take hell. Here is your money, and more.",
      "I walked in here a miserable bastard and I'm leaving a happy one. Here. Take the tip. Take two.",
    ],
    male: {
      knocks: ['I told my wife I was going out to count the sheep. Help me count something better.'],
      inside: ["My cock and I have had a long talk on the stairs. We're both agreed. Come here."],
      after: ["I've cum, I've laughed, and I haven't thought about my wife once. Here is your money, and extra."],
    },
    female: {
      knocks: ['I told my husband I was going to confession. This will give me something to confess.'],
      inside: ["If you can find my cunt without a map, you're already ahead of my husband. Come here."],
      after: ['I cum like a church bell, apparently. Somebody should have told me years ago. Here, and extra.'],
    },
  },
};
export const TEMPER_IDS = Object.keys(TEMPERS) as Temper[];

// Paid, and no more: what any of them says after an hour that wasn't to their taste.
export const FLAT: readonly string[] = [
  'That did what it was meant to. Here is what I owe you.',
  'Right. Here is your money. Good night.',
  "Not quite what I'd hoped for, but fair is fair. Here is the price.",
  "Here is your money. Count it if you like: it's the price, and no more.",
  "Well, that's that. Here is what's owed.",
  "You're good at this, but you didn't seem to like me much. Here is your money.",
  "I thought we'd get along better than that. Never mind. Here is the price.",
  'That was an hour, and it was paid for. Here is the money.',
  "I've no complaints. I've no compliments either. Here is the price.",
  "You did what I paid for. I'd hoped for a bit more than that. Here.",
  'It was all right. Here is what I owe, to the copper.',
  'Well. You know your trade. Here is your money.',
  'I expected to enjoy that more than I did. Here is the price.',
  "We didn't quite suit each other, did we? No matter. Here is what's owed.",
  'Quick, clean and correct. Like a tooth being pulled. Here is your money.',
  "That will do. Here is the price. I'll see myself out.",
  "I'm not sure what I wanted, but it wasn't quite that. Here is your money.",
  'You seemed to be somewhere else the whole time. Here is the price.',
  "I've paid for worse, and I've paid for better. Here.",
  "There's your money. I counted it on the stairs, so it's all there.",
];
