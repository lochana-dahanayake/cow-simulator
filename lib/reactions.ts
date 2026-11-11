import { Pose } from "./poses";

export interface Keyframe {
  t: number; // ms from gag start
  pose: Pose;
}

export interface ScriptStep {
  t: number; // ms from gag start
  say?: string;
  /** Store fills `say` from the named pool, so the line differs each time. */
  pool?: LinePool;
  sound?: "smack" | "moo" | "chew" | "kiss" | "grunt" | "creak" | "slurp" | "bonk" | "knock";
  lips?: boolean; // stamp the lip mark on the screen
  /** Bumped counter the scarecrow watches, so a bellow knocks its hat off. */
  scare?: boolean;
  /** The moment a headbutt lands on whatever the cow is knocking on. */
  hit?: boolean;
}

export interface GagDef {
  id: string;
  duration: number; // ms; gag returns to idle after this
  keyframes: Keyframe[];
  script: ScriptStep[];
}

/** ms the lip mark stays stuck to the screen once the cow plants it. */
export const LIP_MARK_DURATION = 4500;

/**
 * How long the slapping hand takes to reach the cheek, in ms.
 *
 * Everything about a slap — the head-spring kick, the camera shake, the crack —
 * used to happen on the frame you pressed the button, which left the hand in
 * `components/Hands.tsx` no time to travel and made the impact read as a hiccup
 * rather than a hit. Now the swing starts on the button and the impact lands
 * here, and every one of those four things is scheduled off this one number.
 */
export const SLAP_IMPACT = 190;

/**
 * Head snapped aside and the whole body rocked back off the blow.
 *
 * The body drop is small on purpose: the legs are rigid here, so every
 * centimetre it sinks is a centimetre of hoof buried in the field.
 */
const RECOIL: Pose = {
  body: { pos: [0, -0.008, -0.07], rot: [0.035, -0.06, 0] },
  // braced: it plants the near foreleg and takes the weight on it
  legFL: { rot: [0.18, 0, 0] },
  kneeFL: { rot: [-0.14, 0, 0] },
  legBL: { rot: [-0.1, 0, 0] },
  legBR: { rot: [-0.1, 0, 0] },
  earL: { rot: [-0.5, 0, 0.3] },
  earR: { rot: [-0.5, 0, -0.3] },
};

/**
 * The reply. The head is NOT keyframed here — it is thrown by a spring in
 * lib/physics.ts, so the whip and the wobble that follows are real motion rather
 * than a canned curve. What *is* keyframed is everything else: the cow squares
 * its shoulders, brings its front-right leg up in front of its chest, and the
 * hoof on the end of it turns out to be a hand.
 *
 * The arm is raised the way an arm is raised — the shoulder lifts, the elbow
 * folds under it and the forearm comes up vertical — rather than by swinging the
 * whole leg out straight, which reads as a cow falling over.
 *
 * `fist` is scaled to nothing everywhere else in the game; this is the only pose
 * that grows it. `Cow.tsx` hides the hoof for exactly as long as it is out.
 */
const FLIP_OFF: Pose = {
  // No lift: three hooves are still carrying this cow, and raising the body here
  // would take all three of them off the ground together.
  body: { rot: [0, 0.1, 0], pos: [0, -0.006, -0.05] },
  legFR: { rot: [-1.46, 0, 0.5] },
  kneeFR: { rot: [-1.05, 0, 0] },
  shinFR: { rot: [1.22, 0, 0] },
  fist: { scale: [1, 1, 1] },
  // the far foreleg takes the weight the raised one is no longer carrying
  legFL: { rot: [0.1, 0, 0] },
  // chin up, ears pinned back: this is not an apology
  head: { rot: [-0.12, 0, 0] },
  earL: { rot: [-0.62, 0, 0.18] },
  earR: { rot: [-0.62, 0, -0.18] },
  tail: { rot: [-0.2, 0, 0] },
};

/**
 * Halfway through raising the arm, and still holding a hoof.
 *
 * This keyframe exists purely so the hoof-for-hand swap happens somewhere it
 * cannot be seen. The swap is a hard cut — `aimFist` shows one or the other,
 * never both — so it has to land while the leg is at the top of its swing and
 * moving fast, not while the foot is still on the ground. Leaving `fist` out of
 * this pose keeps it scaled to nothing until the last 140 ms of the lift.
 */
const ARM_UP: Pose = {
  body: { rot: [0, 0.06, 0], pos: [0, -0.004, -0.04] },
  legFR: { rot: [-1.0, 0, 0.34] },
  kneeFR: { rot: [-0.86, 0, 0] },
  shinFR: { rot: [0.92, 0, 0] },
  legFL: { rot: [0.08, 0, 0] },
  head: { rot: [-0.08, 0, 0] },
  earL: { rot: [-0.5, 0, 0.14] },
  earR: { rot: [-0.5, 0, -0.14] },
};

// Grazing keeps all four hooves down — the cow only ever rears up when it's
// storming off to the police station.
/**
 * Head right down in the grass. The numbers are measured rather than eyeballed:
 * pitched 1.15 rad and dropped 0.40, the muzzle sits a few centimetres off the
 * ground at the bottom of each dip — in the grass, not through it. The neck is
 * not keyframed at all — it is drawn
 * between the chest and wherever the head ended up (see `stretchNeck`), so it
 * reaches down of its own accord.
 */
const headDown = (dip: number): Pose => ({
  head: { rot: [1.15, 0, 0], pos: [0, -0.46 - dip, 0.03] },
  // ears go out sideways and down, the way they do when a cow has its head in
  // something it likes
  earL: { rot: [-0.15, 0, 0.45] },
  earR: { rot: [-0.15, 0, -0.45] },
  jaw: { rot: [0.12, 0, 0] },
  // weight forward onto the front legs
  body: { pos: [0, -0.035, 0.05], rot: [0.045, 0, 0] },
  legFL: { rot: [0.12, 0, 0] },
  legFR: { rot: [0.12, 0, 0] },
});

const BLUSH: Pose = { blush: { scale: [1, 1, 1] } };

/** Looking away, hooves shuffling. */
const COY: Pose = {
  head: { rot: [0.34, 0.42, -0.12], pos: [0, -0.07, -0.03] },
  earL: { rot: [-0.42, 0, 0.25] },
  earR: { rot: [-0.42, 0, -0.25] },
  body: { pos: [0, 0, -0.2], rot: [0, 0.06, 0] },
  tail: { rot: [0, 0.5, 0] },
  tailTip: { rot: [0, 0.6, 0] },
  blush: { scale: [1, 1, 1] },
};

/** The wind-up: weight back on the hind legs, chin coming up. */
const WIND_UP: Pose = {
  head: { rot: [-0.3, 0, 0], pos: [0, 0.08, -0.04] },
  earL: { rot: [-0.1, 0, 0] },
  earR: { rot: [-0.1, 0, 0] },
  body: { pos: [0, 0.02, -0.38], rot: [-0.09, 0, 0] },
  // coiled: the hind legs load up before the launch
  legBL: { rot: [0.3, 0, 0] },
  legBR: { rot: [0.3, 0, 0] },
  kneeBL: { rot: [-0.3, 0, 0] },
  kneeBR: { rot: [-0.3, 0, 0] },
  blush: { scale: [1, 1, 1] },
};

/**
 * Pressed flat against the lens. The head squashes sideways the way a face does
 * against glass, and the front hooves come up either side of it.
 */
const PUCKER: Pose = {
  head: { rot: [-0.14, 0, 0], pos: [0, 0, 0], scale: [0.18, -0.08, -0.12] },
  jaw: { rot: [-0.1, 0, 0] },
  earL: { rot: [-0.55, 0, -0.3] },
  earR: { rot: [-0.55, 0, 0.3] },
  body: { pos: [0, 0, 0] },
  // front hooves come up either side of the lens
  legFL: { rot: [-1.5, 0, -0.5] },
  legFR: { rot: [-1.5, 0, 0.5] },
  kneeFL: { rot: [-0.7, 0, 0] },
  kneeFR: { rot: [-0.7, 0, 0] },
  blush: { scale: [1, 1, 1] },
};

/** Milestones of the kiss, in ms from the start of the pet gag. */
export const KISS_LUNGE = 1000; // leaves the ground toward the camera
export const KISS_CONTACT = 1520; // lips hit the glass
export const KISS_HOLD = 1980; // ...and peel off again
export const KISS_BACK = 2620; // back on all fours

/**
 * How far along the lunge the cow is, 0 (in the pen) to 1 (nose on the lens).
 * This is a scalar rather than a keyframe because the distance the cow has to
 * travel depends on where the camera is — see `cameraLunge` in Cow.tsx.
 */
export function kissAmount(elapsed: number): number {
  if (elapsed <= KISS_LUNGE) return 0;
  if (elapsed < KISS_CONTACT) {
    // accelerating: it launches at you rather than gliding over
    const k = (elapsed - KISS_LUNGE) / (KISS_CONTACT - KISS_LUNGE);
    return k * k * (3 - 2 * k) * 0.55 + k * k * 0.45;
  }
  if (elapsed < KISS_HOLD) return 1;
  if (elapsed < KISS_BACK) {
    const k = (elapsed - KISS_HOLD) / (KISS_BACK - KISS_HOLD);
    return 1 - k * k * (3 - 2 * k);
  }
  return 0;
}

/**
 * A full-chested bellow: weight back, chin up, mouth open. Used on anything
 * outside the pen that deserves to be shouted at, which so far is a scarecrow.
 */
const BELLOW: Pose = {
  head: { rot: [-0.52, 0, 0], pos: [0, 0.07, 0.03] },
  jaw: { rot: [0.34, 0, 0] },
  earL: { rot: [-0.3, 0, 0.2] },
  earR: { rot: [-0.3, 0, -0.2] },
  body: { pos: [0, 0, -0.06], rot: [-0.06, 0, 0] },
  legFL: { rot: [0.1, 0, 0] },
  legFR: { rot: [0.1, 0, 0] },
  tail: { rot: [-0.3, 0, 0] },
};

/**
 * Head right down to the water. Deeper than grazing, not shallower: the pond
 * surface sits at y=0.05 and the grass it would otherwise be eating is half a
 * metre tall, so a graze-depth dip leaves the muzzle drinking fresh air.
 */
const DRINK: Pose = {
  head: { rot: [1.16, 0, 0], pos: [0, -0.55, 0.05] },
  jaw: { rot: [0.06, 0, 0] },
  earL: { rot: [-0.1, 0, 0.4] },
  earR: { rot: [-0.1, 0, -0.4] },
  body: { pos: [0, -0.03, 0.04], rot: [0.04, 0, 0] },
  legFL: { rot: [0.14, 0, 0] },
  legFR: { rot: [0.1, 0, 0] },
};

/**
 * Seeing stars, after running flat out into something solid. Sways one way,
 * then the other, then shakes it off — the stars are drawn by Cow.tsx for as
 * long as this gag is running.
 */
const dazed = (side: number): Pose => ({
  head: { rot: [0.22, side * 0.32, side * 0.34], pos: [0, -0.04, 0] },
  body: { rot: [0, 0, side * 0.07], pos: [side * 0.03, -0.015, -0.04] },
  earL: { rot: [-0.5, 0, 0.4] },
  earR: { rot: [-0.5, 0, -0.4] },
  // legs splayed, the stance of something that is not sure where the ground is
  legFL: { rot: [0.06, 0, -0.1] },
  legFR: { rot: [0.06, 0, 0.1] },
  jaw: { rot: [0.14, 0, 0] },
  tail: { rot: [0.25, 0, 0] },
});

/** Head down and driven forward: a cow's way of knocking on a door. */
const BUTT: Pose = {
  head: { rot: [0.5, 0, 0], pos: [0, -0.1, 0.2] },
  body: { pos: [0, -0.01, 0.12], rot: [0.05, 0, 0] },
  earL: { rot: [-0.5, 0, 0.3] },
  earR: { rot: [-0.5, 0, -0.3] },
  legBL: { rot: [0.12, 0, 0] },
  legBR: { rot: [0.12, 0, 0] },
  tail: { rot: [-0.4, 0, 0] },
};
/** Drawn back for it. */
const WINDUP: Pose = {
  head: { rot: [0.2, 0, 0], pos: [0, 0, -0.08] },
  body: { pos: [0, 0, -0.1], rot: [-0.03, 0, 0] },
};

export const gags: Record<string, GagDef> = {
  // Knocking, cow-style: two headbutts. Used on the portaloo door and on the
  // apple tree; what happens next is the store's business.
  knock: {
    id: "knock",
    duration: 1050,
    keyframes: [
      { t: 0, pose: {} },
      { t: 150, pose: WINDUP },
      { t: 260, pose: BUTT },
      { t: 430, pose: WINDUP },
      { t: 560, pose: BUTT },
      { t: 760, pose: { head: { rot: [-0.1, 0, 0] } } },
      { t: 1000, pose: {} },
    ],
    script: [
      { t: 250, sound: "knock" },
      { t: 550, sound: "knock", hit: true },
    ],
  },

  bonk: {
    id: "bonk",
    duration: 2500,
    keyframes: [
      { t: 0, pose: {} },
      // the head snaps back off whatever it hit
      { t: 90, pose: { head: { rot: [-0.45, 0, 0] }, body: { pos: [0, 0, -0.14], rot: [-0.05, 0, 0] } } },
      { t: 380, pose: dazed(1) },
      { t: 800, pose: dazed(-1) },
      { t: 1220, pose: dazed(0.8) },
      { t: 1640, pose: dazed(-0.6) },
      { t: 2050, pose: { head: { rot: [0.1, 0.2, 0] } } },
      // and a quick shake to clear it
      { t: 2200, pose: { head: { rot: [0.05, -0.3, 0] } } },
      { t: 2450, pose: {} },
    ],
    script: [
      { t: 0, sound: "bonk" },
      { t: 700, pool: "bonk" },
    ],
  },

  // Triggered by walking onto a grass tuft and pressing E.
  eat: {
    id: "eat",
    duration: 4200,
    keyframes: [
      { t: 0, pose: {} },
      { t: 350, pose: headDown(0) },
      { t: 650, pose: headDown(0.06) },
      { t: 950, pose: headDown(0) },
      { t: 1250, pose: headDown(0.06) },
      { t: 1550, pose: headDown(0) },
      { t: 1850, pose: headDown(0.06) },
      { t: 2150, pose: headDown(0) },
      { t: 2450, pose: headDown(0.06) },
      { t: 2750, pose: headDown(0) },
      { t: 3100, pose: {} },
      { t: 3500, pose: { head: { rot: [-0.14, 0, 0] }, ...BLUSH } },
      { t: 4100, pose: {} },
    ],
    script: [
      { t: 350, sound: "chew" },
      { t: 950, sound: "chew" },
      { t: 1550, sound: "chew" },
      { t: 2150, sound: "chew" },
      { t: 2750, sound: "chew" },
      { t: 3100, pool: "eat", sound: "moo" },
    ],
  },

  // Pet. Goes coy, then comes clean out of the screen and kisses the glass.
  shy: {
    id: "shy",
    duration: 3400,
    keyframes: [
      { t: 0, pose: {} },
      { t: 220, pose: COY },
      { t: 700, pose: COY },
      { t: 900, pose: WIND_UP },
      { t: 1000, pose: WIND_UP },
      { t: KISS_CONTACT, pose: PUCKER },
      { t: KISS_HOLD, pose: PUCKER },
      { t: KISS_BACK, pose: COY },
      { t: 3150, pose: COY },
      { t: 3400, pose: {} },
    ],
    script: [
      { t: 0, pool: "petted", sound: "moo" },
      // the jingle's smooch pop lands exactly on contact
      { t: 910, sound: "kiss" },
      { t: KISS_CONTACT, lips: true },
      { t: KISS_CONTACT + 60, pool: "kiss" },
      { t: KISS_BACK, pool: "kissAfter" },
    ],
  },

  slap: {
    id: "slap",
    duration: 2600,
    keyframes: [
      // Nothing happens until the hand actually arrives. The cow is standing
      // there, unaware, for the whole of the wind-up.
      { t: 0, pose: {} },
      { t: SLAP_IMPACT, pose: {} },
      { t: SLAP_IMPACT + 90, pose: RECOIL },
      { t: SLAP_IMPACT + 320, pose: RECOIL },
      { t: 780, pose: ARM_UP },
      { t: 900, pose: FLIP_OFF },
      { t: 2200, pose: FLIP_OFF },
      { t: 2550, pose: {} },
    ],
    script: [
      { t: SLAP_IMPACT, sound: "smack" },
      { t: SLAP_IMPACT + 90, sound: "grunt" },
      { t: 980, pool: "slap1" }, // the store swaps in slap2/slap3 as the count rises
    ],
  },
  // Shouted at the scarecrow. The gag itself is two seconds of noise; what it
  // is shouting AT is the store's problem.
  bellow: {
    id: "bellow",
    duration: 2200,
    keyframes: [
      { t: 0, pose: {} },
      { t: 260, pose: BELLOW },
      { t: 1150, pose: BELLOW },
      { t: 1500, pose: { head: { rot: [-0.12, 0, 0] } } },
      { t: 2100, pose: {} },
    ],
    script: [
      { t: 200, sound: "moo" },
      { t: 320, scare: true },
      { t: 1300, pool: "bellow" },
    ],
  },

  /**
   * On request. Unlike every other gag this one has NO keyframes worth
   * sampling: `Cow.tsx` recognises it by id and hands the body to
   * `dancePose()` in lib/dance.ts, which is the same routine the title card
   * runs — springs, follow-through and all. Keyframing a second, worse dance
   * next to that one would have been the wrong move.
   *
   * The single empty keyframe is there because `samplePose` needs a track to
   * read and `triggerGag` needs a `duration`.
   */
  dance: {
    id: "dance",
    duration: 9200, // the sway loop is 3.0s, so three times round and out
    keyframes: [{ t: 0, pose: {} }],
    script: [
      { t: 500, sound: "moo" },
      { t: 900, pool: "dance" },
      { t: 4400, sound: "moo" },
    ],
  },

  // A drink at the pond.
  sip: {
    id: "sip",
    duration: 3600,
    keyframes: [
      { t: 0, pose: {} },
      { t: 420, pose: DRINK },
      { t: 900, pose: DRINK },
      { t: 1400, pose: DRINK },
      { t: 1900, pose: DRINK },
      { t: 2400, pose: DRINK },
      { t: 2800, pose: {} },
      { t: 3100, pose: { head: { rot: [-0.16, 0, 0] }, jaw: { rot: [0.1, 0, 0] } } },
      { t: 3550, pose: {} },
    ],
    script: [
      { t: 500, sound: "slurp" },
      { t: 1200, sound: "slurp" },
      { t: 1900, sound: "slurp" },
      { t: 2900, pool: "sip" },
    ],
  },
};

// ---------------------------------------------------------------------------
// what the cow says
//
// Every activity draws from a list rather than saying one fixed line, because
// the fifth "Mmm. Okay, you're alright." is not a joke any more. Lines are
// dealt like a shuffled deck (see `pick`): every line in a list comes up once
// before any of them comes up again.
// ---------------------------------------------------------------------------

export const LINES = {
  /** Finishing a mouthful of grass. */
  eat: [
    "Mmm. Okay, you're alright.",
    "Bit dry. Needs ketchup.",
    "Tastes green.",
    "I'll be chewing that for the next nine hours.",
    "Stomach one says yes. Stomach three has questions.",
    "Grass again. What a surprise. Love it.",
    "Five stars. Would trample again.",
    "That's breakfast. Next: second breakfast.",
    "Don't watch me eat. It's rude.",
    "Organic, locally sourced, stepped on.",
  ],
  /** The moment the pet lands, before the kiss. */
  petted: ["Moooo~", "Oh! Hello.", "Oh, you.", "Stop it. Don't stop it.", "Hehe. Again.", "Mooo? Moo."],
  /** Lips on the glass. */
  kiss: ["Mwah.", "Smooch.", "MWAH.", "Mmmwah!", "*schlorp*"],
  /** Backing off from the screen again. */
  kissAfter: [
    "You've got a little something. Right there.",
    "Don't wipe it off. It's a souvenir.",
    "That's what you get for petting a cow.",
    "Sorry about the screen. Not sorry.",
    "You'll be finding cow spit on that for weeks.",
    "That's the most action this field has seen all year.",
    "Wipe that. Actually, leave it.",
  ],
  /** Coming up from the pond. */
  sip: [
    "Tastes like frog. Ten out of ten.",
    "There was definitely a tadpole in that.",
    "Refreshing. Slightly crunchy.",
    "Ahh. Pond water. The good stuff.",
    "Hydrated. Mostly with duck.",
    "That's my eight glasses for the day.",
    "Ahh. Notes of mud.",
  ],
  /**
   * Slapped, with the middle hoof up. One list per slap so the cow gets
   * angrier as it goes — and the third one warns you what the fourth will do.
   */
  slap1: [
    "Did you just— wow.",
    "Wow. Okay.",
    "Real mature.",
    "Rude.",
    "Excuse me??",
    "Guess what this is.",
  ],
  slap2: [
    "Try doing that again.",
    "Do that again, I dare you.",
    "That's assault.",
    "Yeah. Read it and weep.",
    "Bet you thought I didn't have one of these.",
    "You piece of shit.",
  ],
  slap3: [
    "One more. ONE more and I'm calling someone.",
    "I know people. Uniformed people.",
    "Keep going. See what happens.",
    "I have a lawyer. He's a goat, but he's good.",
    "That's three. I'm counting.",
  ],
  /** On the way up into the dance. It did not need asking twice. */
  dance: [
    "Oh, you want the dance? Fine.",
    "Watch the hooves.",
    "This is a limited engagement.",
    "You have no idea how hard this is on four legs.",
    "Nobody asked, but here we are.",
    "Hit it.",
    "I've been practising.",
    "Don't film this. Okay, film this.",
  ],
  /** Some time after running into something at full gallop. */
  bonk: [
    "Who put that there.",
    "I meant to do that.",
    "Ow. My entire face.",
    "Nobody saw that. Nobody saw that.",
    "Cows should come with brakes.",
    "I can hear colours.",
    "Which one of you moved.",
    "Seven out of ten. Would bonk again.",
    "That was a load-bearing face.",
  ],
  /** To a camera that has just photographed it. */
  ticket: [
    "Was that a camera? Did it get my good side?",
    "I demand a retake.",
    "That wasn't me. Different cow.",
    "Speed limit? I'm a COW.",
    "Put it on my tab.",
    "Worth it.",
    "I was blinking. Do it again.",
    "Can I get that framed?",
    "Pay it in what, MILK?",
  ],
  /** At a scarecrow. It is not a conversation. */
  bellow: [
    "MOOOO! …Nothing. Coward.",
    "It flinched. You saw that.",
    "That's right. Keep still.",
    "Straw man. Literally.",
    "And STAY scared.",
    "Nice hat. Shame if something happened to it.",
    "Who's scary now, eh?",
  ],
  /** At the bull, who could not care less. */
  bull: [
    "MOO! …He's not even looking.",
    "Oi. OI. Big lad.",
    "I know you can hear me.",
    "Rude. And I know rude.",
    "Nice ring. Very 2009.",
    "We're practically cousins!",
    "Fine. Be like that.",
  ],
  /** What the bull says back, when he says anything. */
  bullSays: [
    "…",
    "No.",
    "I'm on my lunch.",
    "Do I know you?",
    "Talk to my agent.",
    "I don't speak to dairy.",
    "Moo quieter.",
    "This is a private field.",
  ],
  /** From inside the portaloo. */
  looSays: ["OCCUPIED!", "STILL occupied!", "Do you MIND?", "Read a book or something!"],
  /** The cow, looking into a now-empty portaloo. */
  looFree: [
    "It's free. I don't fit.",
    "He did not flush.",
    "There's wool everywhere.",
    "No paper. Typical.",
    "I'll hold it.",
  ],
  /** An apple, on the head, from a height. */
  apple: [
    "Ow. Gravity. Noted.",
    "Newton had this coming too.",
    "An apple a day. Straight to the skull.",
    "I asked for ONE apple. Gently.",
    "That tree's got an arm on it.",
    "Worth it. Probably.",
  ],
  /** Just after a sheep goes flying. */
  bowl: [
    "STRIKE!",
    "Sorry! Not sorry.",
    "Fore!",
    "He'll be fine. Probably.",
    "Sheep can fly. Who knew.",
    "Ten points.",
    "Wool you look at that.",
  ],
  /** A sheep walks into the pen. */
  herd: [
    "Welcome to the pen. The food's terrible.",
    "Inmate number two.",
    "Get in there.",
    "Who's a good sheep. You are. Now stay.",
  ],
  /** Rearing up, after the fourth slap. */
  lastStraw: ["Right. RIGHT. That's it.", "That's IT.", "Okay. OKAY. You asked for this."],
  /** Marching off to the station. */
  march: ["I'm reporting this.", "You'll be hearing from the authorities.", "I'm getting a restraining order."],
  /** Back down on four legs at the end of the trip. */
  settle: ["Don't. Just don't.", "Not one word.", "I'm watching you."],
} satisfies Record<string, string[]>;

export type LinePool = keyof typeof LINES;

const decks = new Map<string, number[]>();
const lastDealt = new Map<string, number>();

/**
 * The next line from a list, dealt like a shuffled deck: everything comes up
 * once before anything comes up twice, and the last card of one deck is never
 * the first of the next, so no line is ever said twice in a row.
 */
export function pick<T>(key: string, list: readonly T[]): T {
  if (list.length <= 1) return list[0];
  let deck = decks.get(key);
  if (!deck || deck.length === 0 || deck.some((i) => i >= list.length)) {
    deck = list.map((_, i) => i);
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // dealt from the end
    if (deck[deck.length - 1] === lastDealt.get(key)) [deck[0], deck[deck.length - 1]] = [deck[deck.length - 1], deck[0]];
    decks.set(key, deck);
  }
  const i = deck.pop()!;
  lastDealt.set(key, i);
  return list[i];
}

export function pickLine(pool: LinePool): string {
  return pick(pool, LINES[pool]);
}
