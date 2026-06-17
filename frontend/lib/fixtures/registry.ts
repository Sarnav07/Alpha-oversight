import type { ActivityEvent } from "../types";
import { fixtureBeatA } from "./beat-a";
import { fixtureBeatB } from "./beat-b";
import { fixtureRnD } from "./rnd";

/**
 * The single fixture registry - one source of truth shared by the ReplayClock
 * (mock player), the LiveSSEAdapter's `?replay=` parity, and the ReplayTransport
 * case picker. Keyed by case id (the `?replay=<case_id>` param). Beat B is the
 * headline default (novel 400ms evasion → ESCALATED).
 */
export interface CaseMeta {
  id: string;
  /** short transport-picker label. */
  label: string;
  /** one-line outcome blurb. */
  blurb: string;
}

/** Picker order: rules-catch-it → novel-evasion → full adversarial loop. */
export const CASES: CaseMeta[] = [
  { id: "C-0191", label: "Beat A", blurb: "rules catch it → FLAGGED" },
  { id: "C-0187", label: "Beat B", blurb: "novel evasion → ESCALATED" },
  { id: "C-0188", label: "R&D loop", blurb: "adversary evades → ESCALATED" },
];

export const FIXTURES: Record<string, ActivityEvent[]> = {
  "C-0191": fixtureBeatA,
  "C-0187": fixtureBeatB,
  "C-0188": fixtureRnD,
};

export const DEFAULT_CASE = "C-0187";

/** Resolve a case id to its frame sequence, falling back to the headline demo. */
export function framesFor(caseId?: string | null): ActivityEvent[] {
  return (caseId && FIXTURES[caseId]) || FIXTURES[DEFAULT_CASE];
}
