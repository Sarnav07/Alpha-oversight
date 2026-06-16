/**
 * The "Run 90s Demo" auto-pilot — a cancelable, hands-free beat-sheet over the
 * ReplayClock + mock controller. It narrates the full arc the desk is built to
 * show:
 *   1. Beat A  — a textbook layering pattern the seed rules already catch (FLAGGED)
 *   2. Beat B  — a NOVEL 400ms evasion that slips the seed rule (ESCALATED)
 *   3. Confirm — the human codifies a new rule (Active Rules 4 → 5)
 *   4. R&D loop — the adversary searches for the next evasion (ESCALATED again)
 *
 * Each step loads + plays a fixture and awaits the clock reaching "ended" before
 * holding on a caption and moving on. A run token invalidates everything on stop
 * (the Reset / Stop buttons call stopDemo), so timers and the clock subscription
 * never leak across runs. MOCK ONLY — the page gates the trigger behind IS_MOCK.
 */
"use client";

import { create } from "zustand";
import { useClockStore } from "./clock";
import { useRulesStore, mockConfirm } from "./controller";

interface DemoState {
  active: boolean;
  /** the current narration line (drives the header AUTO-PILOT chip). */
  caption: string | null;
}

export const useDemoStore = create<DemoState>(() => ({
  active: false,
  caption: null,
}));

/** Bumped on every start/stop; any pending await belonging to an old token bails. */
let runToken = 0;
let timers: ReturnType<typeof setTimeout>[] = [];
let unsub: (() => void) | null = null;
const CANCEL = Symbol("autopilot-cancel");

function clearAll() {
  timers.forEach(clearTimeout);
  timers = [];
  unsub?.();
  unsub = null;
}

function caption(line: string | null) {
  if (useDemoStore.getState().active) useDemoStore.setState({ caption: line });
}

/** A cancelable wait; rejects with CANCEL if the run was superseded. */
function sleep(ms: number, token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    timers.push(
      setTimeout(() => (runToken === token ? resolve() : reject(CANCEL)), ms),
    );
  });
}

/** Resolve when the clock reaches "ended"; reject on reset/idle or supersede. */
function waitEnded(token: number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (runToken !== token) return reject(CANCEL);
    if (useClockStore.getState().status === "ended") return resolve();
    unsub = useClockStore.subscribe((s) => {
      if (runToken !== token || s.status === "idle") {
        unsub?.();
        unsub = null;
        return reject(CANCEL);
      }
      if (s.status === "ended") {
        unsub?.();
        unsub = null;
        resolve();
      }
    });
  });
}

function runFixture(caseId: string) {
  useClockStore.getState().load(caseId);
  useClockStore.getState().play();
}

export async function startDemo() {
  stopDemo(); // cancel any prior run
  const token = ++runToken;
  useDemoStore.setState({ active: true, caption: "Booting auto-pilot…" });

  try {
    // 1 — Beat A: rules already catch it.
    caption("Beat A — a textbook layering pattern the seed rules already catch");
    useRulesStore.getState().resetRules();
    runFixture("C-0191");
    await waitEnded(token);
    caption("Beat A → FLAGGED. The deterministic rules did their job.");
    await sleep(2800, token);

    // 2 — Beat B: a novel evasion slips through.
    caption("Beat B — a NOVEL 400ms evasion slips the 100ms seed rule");
    useRulesStore.getState().resetRules();
    runFixture("C-0187");
    await waitEnded(token);
    caption("Beat B → ESCALATED. The rules missed it — over to the human.");
    await sleep(2800, token);

    // 3 — Human confirm → codify the 5th rule (keep it live through the R&D beat).
    caption("Human confirms → the system writes a new rule (Active Rules 4 → 5)");
    mockConfirm();
    await sleep(3400, token);

    // 4 — R&D loop: the adversary hunts the next evasion (5 rules now active).
    caption("R&D lane — the adversary searches for the next evasion");
    runFixture("C-0188");
    await waitEnded(token);
    caption("R&D → ESCALATED. Adversary vs oversight — the loop continues.");
    await sleep(3000, token);

    useDemoStore.setState({ active: false, caption: null });
  } catch (err) {
    if (err !== CANCEL) {
      console.error("[desk] auto-pilot error:", err);
      useDemoStore.setState({ active: false, caption: null });
    }
    // CANCEL: stopDemo already cleared state — nothing to do.
  }
}

export function stopDemo() {
  runToken++;
  clearAll();
  useDemoStore.setState({ active: false, caption: null });
}
