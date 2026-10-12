// What a pleasure worker's client says during the hour itself (the game of their pace: pace.ts, drawn by controller/
// story/paceGame.ts), by how it's going: as they're the more pleased, level by level (`rising`: four of them, from
// taking to it to past holding back); the pace lost (`badly`); and as it ends, well pleased (`good`) or not (`poor`).
// Each temper its own, and each kind of trouble; what only a man says, or only a woman (the client's own sex), with
// it (`male`, `female`: for a level of the rising, by its number, or the good end). A run of beats well kept: a
// word of any of them (`STREAK`). Crude, in so many words; said, never shown.
import type { Build } from '../../human/humanoid';
import type { Temper, Trouble } from './roomLines';

interface Only {
  rising?: Partial<Record<number, readonly string[]>>;
  good?: readonly string[];
}
export interface HourSaid {
  rising: readonly [readonly string[], readonly string[], readonly string[], readonly string[]];
  badly: readonly string[];
  good: readonly string[];
  poor: readonly string[];
  male: Only;
  female: Only;
}

export const STREAK: readonly string[] = ['Yes.', 'There.', 'Just like that.', "Don't stop.", "Oh, that's it.", 'Perfect.', 'Keep going.', 'Mm. Yes.'];

export const HOUR: Record<Temper | Trouble, HourSaid> = {
  shy: {
    rising: [
      ["Oh. That's... that's nice.", 'Is this right? It feels right.'],
      ["Don't stop. Please don't stop.", "I didn't know it could feel like this."],
      ['Oh God. Oh God, yes.', "I can't keep quiet. I'm sorry. I can't."],
      ["I'm going to cum. I'm going to... oh!", 'Yes, yes, there, right there!'],
    ],
    badly: ['Wait, not like that. Slower.', "I think we've lost it. Can we start again?", "That didn't feel right."],
    good: ['I never knew. All these years, and I never knew.', 'Oh. Oh, thank you. Thank you.'],
    poor: ["Is that it? I thought there'd be more to it.", 'Well. I suppose that was it.'],
    male: { rising: { 3: ["My cock's never been this hard. I'm going to cum!"] }, good: ['I came so hard my legs gave out.'] },
    female: { rising: { 3: ["My pussy's on fire. Don't stop, I'm cumming!"] }, good: ["I came. I actually came. So that's what it is."] },
  },
  lonely: {
    rising: [
      ["It's been so long. Just hold me like that.", "You're warm. God, you're warm."],
      ['Yes. Like that. Stay close.', "I'd forgotten what this was."],
      ["Don't let go of me. Don't you dare let go.", "Fuck, I've missed this. I've missed this so much."],
      ["I'm cumming. Hold me, I'm cumming!", "Oh God, don't stop, don't ever stop!"],
    ],
    badly: ["You've gone somewhere else. Come back to me.", 'Not so rough. I just want to feel you.', "Slower. Please. I'm not in a hurry."],
    good: ["I'm crying. Don't mind me. It's the good kind.", "For an hour, I wasn't alone. Thank you."],
    poor: ['I felt more alone with you than without. Never mind.', "It wasn't what I needed. It's not your fault."],
    male: { rising: { 2: ['Your cunt feels like coming home.'] } },
    female: { rising: { 2: ["Your cock fills me up. I'd forgotten that feeling."] } },
  },
  blunt: {
    rising: [
      ["That's it. Keep that up.", 'Good. Just like that.'],
      ["Harder. Don't hold back.", "Faster. Yes. That's the pace."],
      ["Fuck, yes. Don't you dare slow down.", "That's it, fuck me, just like that."],
      ["I'm going to cum. Don't stop, don't stop!", 'Fuck! Yes! Right there!'],
    ],
    badly: ['No. Wrong. Keep the pace I set.', "I said don't stop. Are you listening?", "I'm paying for this. Do it properly."],
    good: ["That's what I came for. Exactly that.", 'Fuck. Good. Very good.'],
    poor: ["I've had better from my own hand.", "You couldn't keep a simple pace. Disappointing."],
    male: { rising: { 2: ['Take my cock. All of it. Good.'] } },
    female: { rising: { 2: ['Deeper. I want to feel that cock hit the back.'] } },
  },
  weary: {
    rising: [
      ["Ahh. That's better than a hot bath.", 'Mm. I needed this.'],
      ["Oh, that's good. Don't hurry it.", 'Yes. Nice and easy. Just like that.'],
      ["Fuck, that's good. I can feel the whole week leaving me.", "Oh, you know what you're doing."],
      ["I'm cumming. Oh, sweet Christ, I'm cumming!", "Don't stop now, I'm nearly there!"],
    ],
    badly: ["Easy. I'm tired, not dead.", "Too fast. My back won't take it.", "You've lost the rhythm. Find it again."],
    good: ["I could sleep for a week. Best I've felt all year.", 'Every ache in my body is gone.'],
    poor: ["I'm more tired now than when I came up.", 'That was hard work, and not the good kind.'],
    male: { rising: { 2: ["My cock hasn't felt this alive since harvest."] } },
    female: { rising: { 2: ["My cunt's been waiting all week for this."] } },
  },
  bold: {
    rising: [
      ['Not bad. Show me more.', "Is that all you've got? Come on."],
      ["Now we're getting somewhere. Harder.", 'Yes. Make me feel it.'],
      ["Fuck, you're good. They weren't lying.", "That's it. Ruin me."],
      ["I'm cumming! Don't you fucking stop!", 'Yes! Fuck! Louder, let them all hear!'],
    ],
    badly: ["I've had better from the stable hand.", 'Come on. I thought you were the best in the house.', "You're losing me. Do something filthy."],
    good: ['Fuck me. You really are as good as they say.', "I'll be boasting about this for a month."],
    poor: ['All that talk downstairs, for that? I want my money back.', "I've been oversold."],
    male: { rising: { 2: ["Your pussy's milking my cock dry.", 'Look at those tits bounce.'] } },
    female: { rising: { 2: ['Fuck me with that big cock. Harder!', 'Grab my tits. Harder than that.'] } },
  },
  merry: {
    rising: [
      ["Oh! Hello. That's new.", 'Ha! That tickles. Do it again.'],
      ["Oh, that's very good. Why does nobody do that at home?", "I've stopped laughing. That's a good sign."],
      ["Oh fuck. I'm not joking now. Keep going.", "Sweet saints, don't stop."],
      ["I'm going to cum, and I'm going to shout. Sorry in advance!", 'Oh God, oh God, here it comes!'],
    ],
    badly: ["We've lost the tune. From the top?", 'Ow. Wrong way. Ha.', "That's a dance for one. Wait for me."],
    good: ['I saw God, and he was laughing too.', 'Best sin I ever paid for.'],
    poor: ['Well, we tried. Points for effort.', 'That was like a joke without the ending.'],
    male: {},
    female: {},
  },
  skinflint: {
    rising: [
      ['Hm. Acceptable, so far.', "Go on, then. I'm timing this."],
      ["That's better than I expected.", "Don't slow down. I'm paying by the hour."],
      ['Oh. Oh, that might be worth the money.', "Fuck. All right. That's good."],
      ["I'm cumming, damn you, I'm cumming!", 'Yes! Worth every... nearly every copper!'],
    ],
    badly: ["I'm not paying for that bit.", "That's coming off the price.", "Is this what I'm paying for?"],
    good: ['I hate to say it. That was worth the price.', "Don't tell anyone I said so, but that was excellent."],
    poor: ['As I thought. Overpriced.', "I've wasted my money, and I never waste money."],
    male: {},
    female: {},
  },
  rough: {
    rising: [
      ["That's it. Do as you're told.", "Keep going. Don't look at me."],
      ['Harder. I said harder.', 'Good. Now faster.'],
      ['Fuck. Yes. Take it.', "Don't you stop. Don't you fucking stop."],
      ["I'm cumming! Stay where you are!", 'Fuck! Fuck! Yes!'],
    ],
    badly: ['Useless. Do it right.', "Keep up, or I'll make you.", 'What am I paying for? Move.'],
    good: ["Hm. You're good for something after all.", 'That took the edge off my day.'],
    poor: ["Pathetic. I've had better from a fence post.", 'A waste of my evening.'],
    male: {},
    female: {},
  },
  soldier: {
    rising: [
      ['Steady. Hold that pace.', 'Good. In step. Keep marching.'],
      ["Quick time, now. That's an order.", "Yes. That's the drill."],
      ["Fuck. I've dreamed of this for three months in the mud.", "Hold the line. Don't break now."],
      ["Charge! Fuck, I'm cumming!", "I'm cumming! For king and country!"],
    ],
    badly: ["You're out of step. Fall in.", "Break rank again and you're on a charge.", 'Sloppy. A recruit could do better.'],
    good: ["Best night's leave I've ever had.", "I'll march north a happy soldier."],
    poor: ['Three months I waited, for that.', "I've had more joy from guard duty."],
    male: {},
    female: {},
  },
};

// What one of that kind, a man or a woman, may say there: the level's own lines (or the good end's), and their sex's.
export const risingOf = (who: Temper | Trouble, build: Build, level: number): readonly string[] => [...HOUR[who].rising[Math.min(3, Math.max(0, level))], ...(HOUR[who][build].rising?.[level] ?? [])];
export const goodOf = (who: Temper | Trouble, build: Build): readonly string[] => [...HOUR[who].good, ...(HOUR[who][build].good ?? [])];
