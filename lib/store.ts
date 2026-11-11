import { create } from "zustand";
import {
  bonk,
  chew,
  creak,
  ensureAudio,
  isMuted,
  setMuted,
  grunt,
  kaching,
  kissJingle,
  knock,
  moo,
  rustle,
  snort,
  shutter,
  slurp,
  smack,
} from "./audio";
import { currentDance, startDance } from "./mocap";
import { infoFor } from "./danceInfo";
import { gags, KISS_CONTACT, LIP_MARK_DURATION, pick, pickLine, SLAP_IMPACT, type LinePool } from "./reactions";
import { loadGoals, saveGoals, type GoalId } from "./goals";
import { noteInput } from "./input";
import { kissImpulse, slapImpulse } from "./physics";
import { addShake, cam } from "./camera";
import { cowState } from "./cowState";
import { GRASS, REGROW_MS, SLAPS_BEFORE_POLICE, SPEED_LIMIT, MPH, SPEED_TRAP_COOLDOWN } from "./world";
import type { Speaker } from "./cutscene";

export type GagId = "eat" | "shy" | "slap" | "bellow" | "sip" | "dance" | "bonk" | "knock";

/** One photograph from the speed camera, and what it cost. */
export interface Ticket {
  /** 1-based, for the notice. */
  n: number;
  /** Recorded speed, in mph, as printed. */
  mph: number;
  /** The posted limit, in mph. */
  limit: number;
  /** The photo itself, as a data URL, once the camera has taken it. */
  photo: string | null;
}

/** The limit painted on the sign, in mph. */
export const POSTED_LIMIT = Math.floor(SPEED_LIMIT * MPH);

/**
 * The one contextual action, and what it is currently pointed at.
 *
 * There used to be exactly one thing in the world worth walking up to, so
 * this was a single `nearGrass: number | null`. Now that the gate opens there
 * are several and they are not all grass, so whatever the cow is standing
 * next to carries its own label and icon and `interact()` switches on the
 * kind. Adding an interactable is one case here and one entry in
 * `nearestPrompt()` in components/Cow.tsx.
 */
export type PromptKind = "grass" | "gate" | "scarecrow" | "pond" | "officer" | "bull" | "loo" | "apple";

export interface Prompt {
  kind: PromptKind;
  /** Which one, where there is more than one. Grass uses the tuft id. */
  id: number;
  label: string;
  icon: string;
}

export interface CowStore {
  /**
   * False until the player taps through the title card. While it's false the
   * cow is up on its hind legs dancing and no control is wired up — which is
   * also what buys us the user gesture we need to ask for fullscreen, a
   * landscape lock and the AudioContext, none of which a browser will hand
   * over without one.
   */
  started: boolean;
  /** null = free roaming. A gag freezes the cow; a cutscene takes it over. */
  activeGag: GagId | null;
  gagStartedAt: number;
  inCutscene: boolean;
  dialogue: string | null;
  /** Who the current line belongs to, so the bubble can be labelled. */
  speaker: Speaker;
  showLipMark: boolean;
  /** Bumped on every kiss so the overlay replays its animation from the top. */
  lipMarkSeq: number;
  slapCount: number;
  /**
   * Whether the player has thrown the gate open. `cowState.gateOpen` is the
   * animated 0..1 that the panel and the fence collision read; this is the
   * discrete intent behind it, and it lives in the store because the HUD has
   * to re-render when it changes.
   */
  gateOpen: boolean;
  /** Bumped every time the cow bellows at the scarecrow, so it can react. */
  scareSeq: number;
  /** Bumped when the speed camera fires, so the screen can flash. */
  flashSeq: number;
  /** Bumped every time the cow moos at the bull. He notices. He does not care. */
  bullSeq: number;
  /** How many times the portaloo door has been headbutted. The third one works. */
  looSeq: number;
  /** Bumped when the apple tree is shaken, so an apple can come down. */
  shakeSeq: number;
  /**
   * When the slapping hand started its swing, as `performance.now()`. A
   * timestamp rather than a flag, so a second slap restarts the swing from the
   * top instead of being swallowed while the first one is still in the air.
   */
  slapAt: number;
  /** Timestamp each grass tuft was eaten, or null if it's standing. */
  grassEatenAt: (number | null)[];
  /** Id of the grass tuft the cow is close enough to eat, if any. */
  nearGrass: number | null;
  /** Whatever the cow is standing next to, ready for `interact()`. */
  prompt: Prompt | null;

  /** Every speeding ticket issued this visit, oldest first. */
  tickets: Ticket[];
  /** The ticket currently on screen, by index, or null. */
  ticketShown: number | null;
  /** What has been ticked off the to-do list, and when. Survives a reload. */
  done: Partial<Record<GoalId, number>>;
  /** Mid-conversation with the officer, so E does not start another one. */
  chatting: boolean;
  /** Sound off. Mirrors lib/audio.ts, which is what actually silences it. */
  muted: boolean;
  /** The controls card is open. */
  helpOpen: boolean;
  /** Running totals for the ending card. */
  stats: { slaps: number; bonks: number; sheep: number; kisses: number; startedAt: number; endedAt: number };

  start: () => void;
  say: (line: string | null, speaker?: Speaker) => void;
  setNearGrass: (id: number | null) => void;
  setPrompt: (p: Prompt | null) => void;
  regrow: (id: number) => void;
  interact: () => void;
  /** The speed camera has seen the cow doing `speed` m/s. Rate-limited here. */
  flash: (speed: number) => void;
  /** The camera has developed its photo of the latest ticket. */
  fileTicket: (photo: string) => void;
  dismissTicket: () => void;
  complete: (id: GoalId) => void;
  toggleMute: () => void;
  toggleHelp: (open?: boolean) => void;
  chat: () => void;
  /** Say something about being stared at, if nothing else is being said. */
  stare: (line: string) => void;
  /** A passing remark from a pool, if the cow is not busy saying something else. */
  quip: (pool: LinePool) => void;
  bumpStat: (key: "bonks" | "sheep") => void;
  triggerGag: (id: GagId) => void;
  toggleDance: () => void;
  startCutscene: () => void;
  endCutscene: () => void;
}

let timeouts: ReturnType<typeof setTimeout>[] = [];

function clearScheduled() {
  timeouts.forEach(clearTimeout);
  timeouts = [];
}

/**
 * Timers for the HUD — the ticket card, toasts, the list peeking open — kept
 * apart from the gag timers above. `clearScheduled` wipes every gag timer the
 * moment a new gag starts, which is right for a reaction and wrong for a
 * speeding ticket that should stay up however many times you slap the cow.
 */
const uiTimers = new Map<string, ReturnType<typeof setTimeout>>();
function later(key: string, ms: number, fn: () => void) {
  const old = uiTimers.get(key);
  if (old) clearTimeout(old);
  uiTimers.set(key, setTimeout(() => {
    uiTimers.delete(key);
    fn();
  }, ms));
}

/** Small talk at the station: what the cow says, and what it gets back. */
const OFFICER_CHAT: [string, string][] = [
  ["Excuse me. I'd like to report a slap.", "Take a number."],
  ["Is this where I report a crime?", "Is it a crime against doughnuts?"],
  ["You look busy.", "I'm on my break. I'm always on my break."],
  ["Nice hat.", "...Thank you. Moving on."],
  ["Any news on my case?", "We're looking into it. Very slowly."],
  ["Can I have a bit of that doughnut?", "Absolutely not."],
  ["Do you take statements from cows?", "I take statements from anybody. I just don't read them."],
  ["Have you seen a big hand round here?", "Sir, this is a police station."],
  ["Moo.", "...Moo yourself."],
  ["What would you do if I ran?", "Write it down. Slowly."],
  ["Is the camera on the lane yours?", "It's the Council's. I just cash the hay."],
  ["Nice day for it.", "For what?"],
];

/** When the speed camera last fired, so it is one ticket per pass, not per frame. */
let lastFlash = -Infinity;


const sounds = { smack, moo, chew, kiss: kissJingle, grunt, creak, slurp, bonk, knock };

/**
 * What the cow is currently mooing at or knocking on. A bellow and a headbutt
 * are each one gag used on several things, so the gag's script says WHEN it
 * lands and this says on WHAT.
 */
let target: PromptKind = "scarecrow";

/** Which gag ticks which box. */
const GAG_GOALS: Partial<Record<GagId, GoalId>> = {
  eat: "graze",
  dance: "dance",
  sip: "drink",
  bellow: "scare",
  bonk: "bonk",
};

export const useCowStore = create<CowStore>((set, get) => {
  if (typeof window !== "undefined" && process.env.NODE_ENV !== "production") {
    (window as unknown as { __cowStore?: unknown; __cow?: unknown }).__cowStore = () => get();
    (window as unknown as { __cow?: unknown; __cam?: unknown }).__cow = cowState;
    (window as unknown as { __cam?: unknown }).__cam = cam;
  }
  return {
    started: false,
    activeGag: null,
    gagStartedAt: 0,
    inCutscene: false,
    dialogue: null,
    speaker: "cow",
    showLipMark: false,
    lipMarkSeq: 0,
    slapCount: 0,
    slapAt: 0,
    gateOpen: false,
    scareSeq: 0,
    flashSeq: 0,
    bullSeq: 0,
    looSeq: 0,
    shakeSeq: 0,
    grassEatenAt: GRASS.map(() => null),
    nearGrass: null,
    prompt: null,
    tickets: [],
    ticketShown: null,
    done: loadGoals(),
    muted: false,
    helpOpen: false,
    chatting: false,
    stats: { slaps: 0, bonks: 0, sheep: 0, kisses: 0, startedAt: 0, endedAt: 0 },

    // The tap on the title card. Audio is unlocked here and nowhere else that
    // matters: this is the one moment we are guaranteed to be inside a gesture.
    start: () => {
      if (get().started) return;
      ensureAudio();
      noteInput();
      set({ muted: isMuted(), started: true, stats: { ...get().stats, startedAt: performance.now() } });
    },

    say: (line, speaker = "cow") => set({ dialogue: line, speaker }),

    setNearGrass: (id) => {
      if (get().nearGrass !== id) set({ nearGrass: id });
    },

    // Called every frame from `drive()`, so it has to be a no-op unless the
    // prompt actually changed — otherwise the whole HUD re-renders at 60fps.
    setPrompt: (p) => {
      const cur = get().prompt;
      if (cur === p) return;
      if (cur && p && cur.kind === p.kind && cur.id === p.id) return;
      set({ prompt: p });
    },

    regrow: (id) => {
      const next = [...get().grassEatenAt];
      if (next[id] === null) return;
      next[id] = null;
      set({ grassEatenAt: next });
    },

    // The single contextual action, bound to E. Whatever the cow is standing
    // next to decides what it does.
    interact: () => {
      const s = get();
      if (!s.started || s.activeGag || s.inCutscene) return;
      const p = s.prompt;
      if (!p) return;

      switch (p.kind) {
        case "grass": {
          if (s.grassEatenAt[p.id] !== null) return;
          const eaten = [...s.grassEatenAt];
          eaten[p.id] = Date.now();
          set({ grassEatenAt: eaten, nearGrass: null, prompt: null });
          timeouts.push(setTimeout(() => get().regrow(p.id), REGROW_MS));
          get().triggerGag("eat");
          return;
        }
        case "gate":
          ensureAudio();
          creak();
          set({ gateOpen: !s.gateOpen, prompt: null });
          return;
        case "scarecrow":
          target = "scarecrow";
          get().triggerGag("bellow");
          return;
        case "bull": {
          target = "bull";
          get().triggerGag("bellow");
          // He answers once the cow has finished shouting — if you can call it
          // an answer.
          const reply = pickLine("bullSays");
          later("reply", gags.bellow.duration + 250, () => {
            const cur = get();
            if (cur.activeGag || cur.inCutscene) return;
            snort();
            set({ dialogue: reply, speaker: "bull" });
            later("reply-clear", 2400, () => {
              if (get().dialogue === reply) set({ dialogue: null });
            });
          });
          return;
        }
        case "loo": {
          // Once the occupant has left there is nothing to knock for.
          if (s.looSeq >= 3) {
            get().quip("looFree");
            return;
          }
          target = "loo";
          const n = s.looSeq + 1;
          get().triggerGag("knock");
          const reply = n >= 3 ? "FINE! I'M COMING OUT!" : pickLine("looSays");
          later("reply", gags.knock.duration + 60, () => {
            if (get().activeGag || get().inCutscene) return;
            set({ dialogue: reply, speaker: "loo" });
            later("reply-clear", 2300, () => {
              if (get().dialogue === reply) set({ dialogue: null });
            });
          });
          return;
        }
        case "apple": {
          target = "apple";
          get().triggerGag("knock");
          // The apple is in the air for about half a second after the second
          // headbutt; the stars start when it arrives.
          later("apple-lands", gags.knock.duration + 30, () => {
            if (get().activeGag || get().inCutscene) return;
            get().triggerGag("bonk");
            const line = pickLine("apple");
            later("apple-line", 760, () => {
              if (get().activeGag === "bonk") set({ dialogue: line, speaker: "cow" });
            });
          });
          return;
        }
        case "pond":
          get().triggerGag("sip");
          return;
        case "officer":
          get().chat();
          return;
      }
    },

    /**
     * A word with the officer, outside the police trip. He has the patience
     * of a man nine minutes from the end of his shift.
     */
    chat: () => {
      const s = get();
      if (s.chatting) return;
      const [cowLine, copLine] = pick("chat", OFFICER_CHAT);
      set({ chatting: true, dialogue: cowLine, speaker: "cow" });
      moo();
      later("chat-1", 1900, () => set({ dialogue: copLine, speaker: "officer" }));
      later("chat-2", 1900 + 2600, () => {
        if (get().dialogue === copLine) set({ dialogue: null });
        set({ chatting: false });
      });
    },

    quip: (pool) => {
      const s = get();
      if (!s.started || s.activeGag || s.inCutscene || s.chatting) return;
      const line = pickLine(pool);
      set({ dialogue: line, speaker: "cow" });
      later("quip", 2600, () => {
        if (get().dialogue === line) set({ dialogue: null });
      });
    },

    stare: (line) => {
      const s = get();
      if (s.activeGag || s.inCutscene || s.dialogue) return;
      set({ dialogue: line, speaker: "cow" });
      later("stare", 3000, () => {
        if (get().dialogue === line) set({ dialogue: null });
      });
    },

    /**
     * The speed camera going off. Called every frame the cow is inside the
     * camera's range going over the limit, so the rate limit lives here: one
     * flash per pass, however long the pass takes.
     */
    flash: (speed) => {
      const s = get();
      if (!s.started || s.inCutscene) return;
      const t = performance.now();
      if (t - lastFlash < SPEED_TRAP_COOLDOWN * 1000) return;
      lastFlash = t;
      ensureAudio();
      shutter();
      addShake(0.18);
      const ticket: Ticket = {
        n: s.tickets.length + 1,
        mph: Math.round(speed * MPH * 10) / 10,
        limit: POSTED_LIMIT,
        photo: null,
      };
      const line = pickLine("ticket");
      set({
        flashSeq: s.flashSeq + 1,
        tickets: [...s.tickets, ticket],
        dialogue: line,
        speaker: "cow",
      });
      later("ticket-line", 3200, () => {
        if (get().dialogue === line) set({ dialogue: null });
      });
      // The photo is developed by the camera itself (components/Outside.tsx)
      // on the next frame; the notice comes up a beat after the flash so the
      // flash gets to land on its own first.
      later("ticket-show", 650, () => {
        kaching();
        set({ ticketShown: get().tickets.length - 1 });
      });
      later("ticket-hide", 7600, () => set({ ticketShown: null }));
      get().complete("ticket");
      if (s.tickets.length + 1 >= 3) later("wanted", 1800, () => get().complete("wanted"));
    },

    fileTicket: (photo) => {
      const list = get().tickets;
      if (!list.length) return;
      const last = { ...list[list.length - 1], photo };
      set({ tickets: [...list.slice(0, -1), last] });
    },

    dismissTicket: () => set({ ticketShown: null }),

    complete: (id) => {
      const s = get();
      if (s.done[id]) return;
      const done = { ...s.done, [id]: Date.now() };
      saveGoals(done);
      set({ done });
    },

    toggleMute: () => {
      const m = !get().muted;
      setMuted(m);
      set({ muted: m });
    },

    toggleHelp: (open) => set({ helpOpen: open ?? !get().helpOpen }),

    bumpStat: (key) => set({ stats: { ...get().stats, [key]: get().stats[key] + 1 } }),

    triggerGag: (id) => {
      if (!get().started || get().inCutscene) return;
      ensureAudio();
      clearScheduled();

      const gag = gags[id];
      // A dance runs as long as the clip that was picked for it.
      const duration = id === "dance" ? startDance() || gag.duration : gag.duration;
      const slapCount = id === "slap" ? get().slapCount + 1 : get().slapCount;
      if (id === "slap") set({ stats: { ...get().stats, slaps: get().stats.slaps + 1 } });

      // Fifth slap: the cow stops arguing and goes over your head. It still gets
      // hit first — the hand is already in the air — so the impact is scheduled
      // the same way and the cutscene starts on the back of it.
      const lastStraw = id === "slap" && slapCount >= SLAPS_BEFORE_POLICE;

      if (id === "slap") {
        // The swing starts now; everything the blow does happens when the hand
        // gets there. The hit itself is physics, not animation: the head is
        // thrown by a spring and the camera takes a knock with it.
        set({ slapAt: performance.now() });
        const impact = setTimeout(() => {
          slapImpulse();
          addShake(0.55);
          if (lastStraw) {
            smack();
            grunt();
            // Let the head-whip actually play before the cutscene takes the body
            // over — `startCutscene` relaxes every spring, so starting it on the
            // same frame as the impulse would wipe the hit off the cow.
            timeouts.push(setTimeout(() => get().startCutscene(), 430));
          }
        }, SLAP_IMPACT);
        timeouts.push(impact);
      }

      if (lastStraw) {
        set({ activeGag: null, dialogue: null, showLipMark: false, slapCount });
        return;
      }

      set({
        activeGag: id,
        gagStartedAt: performance.now(),
        dialogue: null,
        speaker: "cow",
        slapCount,
      });

      // Boxes on the list. A gag ticks its box when its payoff lands rather
      // than when the button goes down, so the chime arrives with the joke.
      const goal = GAG_GOALS[id];
      if (goal) timeouts.push(setTimeout(() => get().complete(goal), Math.min(1500, duration * 0.4)));
      if (id === "slap") timeouts.push(setTimeout(() => get().complete("finger"), 1300));
      if (id === "shy") {
        timeouts.push(
          setTimeout(() => {
            set({ stats: { ...get().stats, kisses: get().stats.kisses + 1 } });
            get().complete("kiss");
          }, KISS_CONTACT + 400)
        );
      }

      for (const step of gag.script) {
        const timeout = setTimeout(() => {
          if (step.sound) sounds[step.sound]();
          if (step.scare) {
            if (target === "bull") set({ bullSeq: get().bullSeq + 1 });
            else set({ scareSeq: get().scareSeq + 1 });
          }
          if (step.hit) {
            if (target === "apple") {
              rustle();
              set({ shakeSeq: get().shakeSeq + 1 });
            } else set({ looSeq: get().looSeq + 1 });
          }
          if (step.say || step.pool) {
            // the slap's comeback gets nastier with every slap
            const pool: LinePool | undefined =
              step.pool === "slap1"
                ? (`slap${Math.min(3, Math.max(1, get().slapCount))}` as LinePool)
                : step.pool === "bellow" && target === "bull"
                  ? "bull"
                  : step.pool;
            // and a dance gets its own lines, if the dance it is has any
            const dance = pool === "dance" ? currentDance()?.name : undefined;
            set({
              dialogue: dance
                ? pick(`dance:${dance}`, infoFor(dance).lines)
                : pool
                  ? pickLine(pool)
                  : step.say ?? null,
              speaker: "cow",
            });
          }
          if (step.lips) {
            // The kiss lands: stamp the screen, knock the camera, squash the head.
            addShake(0.3);
            kissImpulse();
            set({ showLipMark: true, lipMarkSeq: get().lipMarkSeq + 1 });
            const hide = setTimeout(() => set({ showLipMark: false }), LIP_MARK_DURATION);
            timeouts.push(hide);
          }
        }, step.t);
        timeouts.push(timeout);
      }

      const end = setTimeout(() => set({ activeGag: null, dialogue: null }), duration);
      timeouts.push(end);
    },

    /**
     * The dance button. A toggle rather than a fire-and-forget gag, because
     * nine seconds of cow is a long time to be locked out of your own controls
     * — and because the obvious thing to do with a dance button is press it
     * again.
     */
    toggleDance: () => {
      const s = get();
      if (!s.started || s.inCutscene) return;
      if (s.activeGag === "dance") {
        clearScheduled();
        set({ activeGag: null, dialogue: null });
        return;
      }
      if (s.activeGag) return; // busy being petted or slapped
      get().triggerGag("dance");
    },

    startCutscene: () => {
      clearScheduled();
      set({ inCutscene: true, activeGag: null, dialogue: null, showLipMark: false });
    },

    endCutscene: () => {
      // The cow shut the gate behind itself on the way back in, so the
      // player's switch has to agree with the panel or the next press of E
      // looks like it did nothing.
      set({ inCutscene: false, slapCount: 0, gateOpen: cowState.gateOpen > 0.5 });
      get().complete("police");
      // let the parting line hang for a beat before clearing it
      const timeout = setTimeout(() => set({ dialogue: null }), 2200);
      timeouts.push(timeout);
    },
  };
});
