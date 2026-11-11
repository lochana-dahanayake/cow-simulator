"use client";

import { useEffect } from "react";
import { useCowStore } from "@/lib/store";
import { enterImmersive, exitImmersive, useIsFullscreen } from "@/lib/viewport";
import { SLAPS_BEFORE_POLICE } from "@/lib/world";

const DESKTOP_CONTROLS: [string, string][] = [
  ["W A S D", "Walk"],
  ["Shift", "Gallop"],
  ["Mouse", "Look around"],
  ["Scroll", "Zoom"],
  ["E", "Do the thing it says"],
  ["Q", "Pet"],
  ["F", "Slap"],
  ["R", "Dance"],
  ["Tab", "The to-do list"],
  ["M", "Sound on / off"],
  ["H", "This card"],
];

const TOUCH_CONTROLS: [string, string][] = [
  ["Left thumb", "Walk — push all the way to gallop"],
  ["Swipe the field", "Look around"],
  ["Pinch", "Zoom"],
  ["💃 🖐️ 👋", "Dance, pet, slap"],
];

/**
 * The corner of the screen that belongs to the player rather than the cow:
 * sound, the controls, fullscreen. Every game has one, and this one used to
 * have none — sound could not be turned off, and the controls were a hint that
 * faded after fourteen seconds and could never be summoned again.
 */
export function MenuCluster({ touch }: { touch: boolean }) {
  const muted = useCowStore((s) => s.muted);
  const toggleMute = useCowStore((s) => s.toggleMute);
  const helpOpen = useCowStore((s) => s.helpOpen);
  const toggleHelp = useCowStore((s) => s.toggleHelp);
  const slapCount = useCowStore((s) => s.slapCount);
  const fullscreen = useIsFullscreen();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === "KeyM") useCowStore.getState().toggleMute();
      else if (e.code === "KeyH") useCowStore.getState().toggleHelp();
      else if (e.code === "Escape") useCowStore.getState().toggleHelp(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const rows = touch ? TOUCH_CONTROLS : DESKTOP_CONTROLS;

  return (
    <div className="pointer-events-auto absolute top-3 right-3 flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {/* Up here rather than by the buttons: on a phone that keeps it out of the thumb zone. */}
        <PatienceMeter count={slapCount} compact={touch} />
        <RoundButton
          label={muted ? "Sound on" : "Sound off"}
          pressed={muted}
          onClick={toggleMute}
          hint={touch ? undefined : "M"}
        >
          {muted ? "🔇" : "🔊"}
        </RoundButton>
        <RoundButton
          label="Controls"
          pressed={helpOpen}
          onClick={() => toggleHelp()}
          hint={touch ? undefined : "H"}
        >
          ?
        </RoundButton>
        {touch && (
          <RoundButton
            label={fullscreen ? "Leave fullscreen" : "Go fullscreen"}
            onClick={() => void (fullscreen ? exitImmersive() : enterImmersive())}
          >
            {fullscreen ? "⤫" : "⛶"}
          </RoundButton>
        )}
      </div>

      {helpOpen && (
        <div className="panel-in w-[16.5rem] max-w-[80vw] rounded-2xl bg-[#fbf8ef]/95 p-3.5 text-neutral-800 shadow-2xl">
          <h2 className="mb-2 text-base font-black tracking-tight">Controls</h2>
          <dl className="grid grid-cols-[auto_1fr] items-baseline gap-x-3 gap-y-1 text-[0.82rem] leading-tight">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt>
                  <kbd className="whitespace-nowrap rounded bg-neutral-900/10 px-1.5 py-0.5 font-mono text-[0.7rem] font-bold">
                    {k}
                  </kbd>
                </dt>
                <dd className="text-neutral-600">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

function RoundButton({
  children,
  label,
  onClick,
  pressed,
  hint,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  hint?: string;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      aria-pressed={pressed}
      title={hint ? `${label} (${hint})` : label}
      className={`grid h-9 w-9 place-items-center rounded-full text-base font-bold text-white shadow-lg backdrop-blur-sm transition-transform active:scale-95 ${
        pressed ? "bg-white/30" : "bg-black/45"
      }`}
    >
      {children}
    </button>
  );
}

/**
 * How close the cow is to walking off to file a report. It used to be a row of
 * unlabelled dashes, which is a meter nobody could tell the purpose of until
 * the cutscene had already happened. Now it says what it is, and starts to
 * tremble when one more slap is all it takes.
 */
export function PatienceMeter({ count, compact }: { count: number; compact?: boolean }) {
  const last = count >= SLAPS_BEFORE_POLICE - 1 && count < SLAPS_BEFORE_POLICE;
  return (
    <div
      className={`flex items-center gap-2.5 rounded-full border-2 bg-black/75 shadow-xl backdrop-blur-sm transition-colors ${
        compact ? "h-10 px-3" : "px-4 py-2"
      } ${last ? "patience-shake border-red-500" : count > 0 ? "border-red-400/70" : "border-white/40"}`}
      role="meter"
      aria-label="Cow's patience"
      aria-valuemin={0}
      aria-valuemax={SLAPS_BEFORE_POLICE}
      aria-valuenow={count}
      title="Slap it enough and it calls the police"
    >
      <span className={compact ? "text-lg" : "text-2xl"}>{count === 0 ? "🐄" : last ? "😡" : "😠"}</span>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: SLAPS_BEFORE_POLICE }).map((_, i) => (
          <span
            key={i}
            className={`rounded-full transition-all ${compact ? "h-3 w-6" : "h-4 w-10"} ${
              i < count
                ? "bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.9)]"
                : "bg-white/30 ring-1 ring-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
