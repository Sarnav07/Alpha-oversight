/**
 * Desk filter predicates + hooks - the shared matching logic behind the
 * click-to-filter node selection and the free-text search (lib/desk/uiStore.ts).
 *
 * One source of truth so VerdictTimeline, DossierCards, RuleRegistryPanel and the
 * filtered NodeTrace log all agree on what "matches". Pure functions + thin hooks;
 * no data-seam coupling (they read raw events / model outputs, never the adapter).
 */
"use client";

import { useMemo } from "react";
import { useTraceStore } from "../store/useTraceStore";
import { useDeskUIStore } from "./uiStore";
import { nodeIdForAgent } from "./nodes";
import type { NodeId } from "./contract";
import type { ActivityEvent, Rule } from "../types";

/** Lowercased free-text test against arbitrary fields (null-safe, trimmed). */
function textMatches(query: string, ...fields: (string | null | undefined)[]): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return fields.some((f) => (f ?? "").toLowerCase().includes(q));
}

/** Does an event belong to the selected node? (null filter ⇒ everything passes.) */
export function eventMatchesNode(e: ActivityEvent, nodeFilter: NodeId | null): boolean {
  if (!nodeFilter) return true;
  return nodeIdForAgent(e.agent_name) === nodeFilter;
}

/** Free-text test for an event (agent_name + content). */
export function eventMatchesQuery(e: ActivityEvent, query: string): boolean {
  return textMatches(query, e.agent_name, e.content);
}

/** Free-text test for a rule (id + family). */
export function ruleMatchesQuery(r: Rule, query: string): boolean {
  return textMatches(query, r.id, r.family);
}

/** Is any filter active right now? Drives the "clear" chip + filtered-log surface. */
export function useFilterActive(): { node: NodeId | null; query: string; any: boolean } {
  const node = useDeskUIStore((s) => s.nodeFilter);
  const query = useDeskUIStore((s) => s.query);
  return { node, query, any: node !== null || query.trim().length > 0 };
}

/** The raw events passing BOTH the node filter and the free-text query. */
export function useFilteredEvents(): ActivityEvent[] {
  const events = useTraceStore((s) => s.events);
  const node = useDeskUIStore((s) => s.nodeFilter);
  const query = useDeskUIStore((s) => s.query);
  return useMemo(
    () =>
      events.filter(
        (e) => eventMatchesNode(e, node) && eventMatchesQuery(e, query),
      ),
    [events, node, query],
  );
}
