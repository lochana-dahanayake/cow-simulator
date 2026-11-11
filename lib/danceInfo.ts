// What goes with each dance: the music it is danced to, what the cow says on
// the way into it, and any props. Keyed by file name in public/dances/. A dance
// that is not listed here still works — it gets the funk and a generic line.

import type { MusicStyle } from "./music";

export interface DanceInfo {
  music: MusicStyle;
  lines: string[];
  /** A rose between the teeth. For the slow ones. */
  rose?: boolean;
}

export const DANCES: Record<string, DanceInfo> = {
  moonwalk: { music: "funk", lines: ["Hee-hee!", "Moo-nwalk.", "Shamoo!", "Smooth. Criminally smooth."] },
  thriller: { music: "funk", lines: ["Zombie cow. Very scary.", "Braaains. Or grass. Grass is fine.", "This is my scary dance."] },
  headspin: { music: "break", lines: ["Hold my hay.", "Don't try this at home.", "Everything is spinning. Good."] },
  flair: { music: "break", lines: ["Watch the hooves!", "Cow on the floor!", "Breakdancing. Mostly breaking."] },
  freezes: { music: "break", lines: ["And... freeze.", "Nobody move.", "Freeze! Like the milk."] },
  rumba: { music: "latin", rose: true, lines: ["Dim the lights.", "Let's take it slow.", "Feel the rhythm. Feel the grass."] },
  chicken: { music: "party", lines: ["Wrong animal. Don't care.", "Bawk. Moo. Bawk.", "Flap those elbows!"] },
  gangnam: { music: "party", lines: ["Invisible horse! Ironic.", "Giddy-up.", "Ride it, cowboy."] },
  ymca: { music: "party", lines: ["Spell it with me!", "Y! M! C! A! ...cow.", "Arms up, everyone."] },
};

export const GENERIC: DanceInfo = {
  music: "funk",
  lines: ["Oh, you want the dance? Fine.", "Watch the hooves.", "This is a limited engagement."],
};

export function infoFor(name: string | undefined): DanceInfo {
  return (name && DANCES[name]) || GENERIC;
}

/** Good dances for the title card: upright, face to the camera. */
export const TITLE_DANCES = ["ymca", "chicken", "gangnam", "moonwalk", "rumba"];
