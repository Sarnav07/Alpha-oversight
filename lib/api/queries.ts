"use client";

/**
 * TanStack Query layer over the REST client (lib/api/client).
 * DeskLive consumes these hooks; the public API is FROZEN in
 * tasks/BACKEND_INTEGRATION.md — do not rename/resign without updating both.
 */
import { useEffect } from "react";
import {
  useQuery,
  useQueryClient,
  type UseQueryResult,
} from "@tanstack/react-query";

import { api } from "./client";
import { parseMarker } from "../eventsource/parseMarker";
import { useTraceStore } from "../store/useTraceStore";
import type { AuditResponse, Case, Rule, Stats } from "../types";

/** Query keys — single source of truth for invalidation. */
export const qk = {
  stats: ["stats"] as const,
  rules: ["rules"] as const,
  cases: ["cases"] as const,
  audit: (id: string) => ["audit", id] as const,
};

export function useStats(): UseQueryResult<Stats> {
  return useQuery({
    queryKey: qk.stats,
    queryFn: () => api.stats(),
    refetchOnWindowFocus: false,
  });
}

export function useRules(): UseQueryResult<Rule[]> {
  return useQuery({
    queryKey: qk.rules,
    queryFn: () => api.rules(),
    refetchOnWindowFocus: false,
  });
}

export function useCases(): UseQueryResult<Case[]> {
  return useQuery({
    queryKey: qk.cases,
    queryFn: () => api.cases(),
    refetchOnWindowFocus: false,
  });
}

export function useAudit(caseId: string | null): UseQueryResult<AuditResponse> {
  return useQuery({
    queryKey: qk.audit(caseId ?? ""),
    queryFn: () => api.audit(caseId as string),
    enabled: !!caseId,
    refetchOnWindowFocus: false,
  });
}

/**
 * Mount once in /desk. Watches the trace store's latest event and, on a
 * state-changing marker, invalidates the REST caches so tiles/rules/cases/audit
 * re-fetch the new server truth. State-changing = marker.stage in
 * {verdict, escalate, codify} OR raw content shows a terminal transition
 * ("-> FLAGGED|ESCALATED|CLOSED").
 */
export function useInvalidateOnMarkers(): void {
  const queryClient = useQueryClient();
  const latest = useTraceStore(
    (s) => s.events[s.events.length - 1] as
      | (typeof s.events)[number]
      | undefined,
  );

  useEffect(() => {
    if (!latest) return;

    const marker = parseMarker(latest);
    const stageChanges =
      marker.stage === "verdict" ||
      marker.stage === "escalate" ||
      marker.stage === "codify";
    const terminalTransition = /-> (FLAGGED|ESCALATED|CLOSED)/.test(
      latest.content ?? "",
    );

    if (!stageChanges && !terminalTransition) return;

    queryClient.invalidateQueries({ queryKey: qk.stats });
    queryClient.invalidateQueries({ queryKey: qk.rules });
    queryClient.invalidateQueries({ queryKey: qk.cases });
    queryClient.invalidateQueries({ queryKey: ["audit"] });
  }, [latest, queryClient]);
}
