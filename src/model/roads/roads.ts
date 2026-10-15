// The roads between the villages, by day and by night (the model's `roads`): the witch-finders' patrols
// (patrols.ts: their questions, questioning.ts; the stocks, arrest.ts), and the dead that walk at night
// (nightDead.ts). What's heard of the hero is the model's own (`heat`: heat.ts), for the story to raise too.
// What's to be said to the hero as it happens (`arrived`: a party come up for a word, an arrest), the controller
// shows as a talk; an arrest it was never shown (the talk shut some other way) served all the same.
import type { Talk } from '../story/storyTypes';
import type { Equipment } from '../human/equipment';
import type { BodyLook } from '../human/humanoid';
import type { Enemy } from '../types';
import type { GameModel } from '../GameModel';
import type { Traveller } from '../travellers/travellers';
import { Patrols } from './patrols';
import { NightDead } from './nightDead';
import { questioning } from './questioning';
import { FOUGHT, RAN, arrestFor, arrestTalk, serve, type Arrest } from './arrest';

export type Speaker = { name: string; look: BodyLook; equipment: Equipment };

export class Roads {
  readonly patrols: Patrols;
  readonly night: NightDead;
  private told: { who: Speaker; talk: Talk } | null = null; // to be shown (an arrest)
  private asking: object | null = null; // the party whose word's been shown
  arrest: Arrest | null = null; // under way: served in the stocks' black, or the next frame after

  constructor(private readonly model: GameModel) {
    this.patrols = new Patrols(model);
    this.night = new NightDead(model);
  }

  // Each frame out in the world: an arrest still owed served first.
  update(dt: number): void {
    if (this.arrest) {
      if (!this.arrest.served) serve(this.model, this.arrest);
      this.arrest = null;
      this.told = null;
    }
    this.model.heat.update();
    this.patrols.update(dt);
    this.night.update(dt);
  }

  // What's to be said to the hero now, if anything: an arrest to tell, or a party come up for a word.
  arrived(): { who: Speaker; talk: Talk } | null {
    const told = this.told;
    if (told) {
      this.told = null;
      return told;
    }
    const party = this.patrols.stopped;
    if (party !== this.asking && this.asking) this.asking = null; // (that word had: the next asked afresh)
    if (!party || party === this.asking) return null;
    this.asking = party;
    const talk = questioning(this.model, party.members[0]);
    return talk ? { who: party.members[0], talk } : null;
  }

  // A word asked of a witch-finder (E): their questions, or a nod in passing (null).
  talkTo(t: Traveller): Talk | null {
    const talk = questioning(this.model, t);
    const party = this.patrols.stopped;
    if (talk && party) this.asking = party;
    return talk;
  }

  // An arrest begun (`times`: the fine's, for how they were taken), told by `who`.
  private take(who: Speaker, times: number, how: 'caught' | 'felled'): void {
    if (this.arrest) return;
    this.arrest = arrestFor(this.model, times);
    this.told = { who, talk: arrestTalk(this.model, this.arrest, who.name, how) };
  }

  // A witch-finder's blow landing on a hero they're out to seize: taken hold of (whether it was).
  seized(foe: Enemy): boolean {
    if (!this.patrols.seizing(foe)) return false;
    const hunt = this.patrols.hunts.find((h) => h.foes.includes(foe))!;
    this.take(hunt.party.members[0], RAN, 'caught');
    return true;
  }

  // Fallen while the witch-finders were after them: taken to the stocks, not an inn (whether they were).
  takenFallen(): boolean {
    const hunt = this.patrols.hunts[0];
    if (!hunt) return false;
    this.take(hunt.party.members[0], FOUGHT, 'felled');
    return true;
  }

  save(): { night: ReturnType<NightDead['save']> } {
    return { night: this.night.save() };
  }

  load(saved: unknown): void {
    this.night.load((saved as { night?: unknown } | null)?.night);
  }
}
