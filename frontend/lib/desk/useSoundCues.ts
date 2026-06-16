/**
 * useSoundCues — watches the trace stream for newly-arrived terminal/verdict
 * markers and fires a synthesized cue (lib/desk/sound.ts) when sound is ON.
 *
 * Gating: cues only fire when `useDeskUIStore.soundOn` is true AND the audio
 * context has been primed by a prior user gesture (playCue no-ops otherwise).
 * We track the last-seen event count so a cue fires once per NEW frame, never on
 * re-render or backward scrub (seek rebuilds the trace → count drops, no cue).
 *
 * Marker → cue:  FLAG verdict → "flag" · escalate → "escalate" · codify → "codify".
 * A soft "tick" on hotkey beats is fired directly from useHotkeys, not here.
 */
"use client";

import { useEffect, useRef } from "react";
import { useTraceStore } from "../store/useTraceStore";
import { parseMarker } from "../eventsource/parseMarker";
import { useDeskUIStore } from "./uiStore";
import { playCue } from "./sound";
import type { ActivityEvent } from "../types";

/** The cue (if any) a single frame should trigger. */
function cueForEvent(e: ActivityEvent): "flag" | "escalate" | "codify" | null {
  const m = parseMarker(e);
  if (m.stage === "codify") return "codify";
  if (m.stage === "escalate") return "escalate";
  if (m.result === "FLAG") return "flag";
  return null;
}

export function useSoundCues() {
  const events = useTraceStore((s) => s.events);
  // how many events we've already evaluated — only the tail is "new".
  const seen = useRef(0);

  useEffect(() => {
    const len = events.length;
    // backward jump (seek/reset) — re-baseline silently, no cue replay.
    if (len < seen.current) {
      seen.current = len;
      return;
    }
    if (len === seen.current) return;

    const soundOn = useDeskUIStore.getState().soundOn;
    if (soundOn) {
      // fire a cue for the most relevant new frame (the newest wins if several
      // arrive in one batch — mock pushes one at a time, so this is usually one).
      for (let i = len - 1; i >= seen.current; i--) {
        const cue = cueForEvent(events[i]);
        if (cue) {
          playCue(cue);
          break;
        }
      }
    }
    seen.current = len;
  }, [events]);
}
