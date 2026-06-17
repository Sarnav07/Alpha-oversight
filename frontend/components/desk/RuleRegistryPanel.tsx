"use client";

import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import { useDeskUIStore } from "@/lib/desk/uiStore";
import { ruleMatchesQuery } from "@/lib/desk/filter";
import type { Rule, RuleFamily, RuleStatus } from "@/lib/types";

/**
 * RuleRegistryPanel - the deterministic rule registry, the codify 4→5 reveal.
 *
 * Lists `model.rules` (Rule[]) as cards: mono id, family badge, key params (mono),
 * provenance, status. Header shows the "4 → 5" count. When `model.codified` is
 * true the freshly codified card (the 5th, last in the list) RISES with the
 * `.anim-codify` amber-border decay and a "✓ regression gate PASS" line.
 *
 * Reduced motion: no flash class, final state rendered (header already shows 5).
 */

const FAMILY_LABEL: Record<RuleFamily, string> = {
  spoofing: "Spoofing",
  layering: "Layering",
  wash_trade: "Wash trade",
  marking: "Marking",
};

const STATUS_COLOR: Record<RuleStatus, string> = {
  ACTIVE: "var(--verdict-pass)",
  SHADOW: "var(--text-muted)",
  RETIRED: "var(--text-faint)",
};

/** Render a rule's params dict as compact `key=value` mono chips. */
function paramPairs(params: Record<string, unknown>): string[] {
  return Object.entries(params).map(([k, v]) => `${k}=${String(v)}`);
}

function RuleCard({
  rule,
  isCodified,
  reduce,
}: {
  rule: Rule;
  isCodified: boolean;
  reduce: boolean;
}) {
  return (
    <li
      className={isCodified && !reduce ? "anim-codify" : undefined}
      style={{
        backgroundColor: "var(--bg-inset)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-chip)",
        padding: "12px 14px",
        listStyle: "none",
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className="font-mono"
          style={{
            fontSize: 12.5,
            fontWeight: 500,
            color: "var(--text-primary)",
            letterSpacing: "0.01em",
          }}
        >
          {rule.id}
        </span>
        <span
          className="font-sans"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.12em",
            color: STATUS_COLOR[rule.status],
          }}
        >
          {rule.status}
        </span>
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span
          className="font-sans"
          style={{
            fontSize: 10,
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--text-body)",
            backgroundColor: "var(--bg-card-2)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--r-chip)",
            padding: "2px 7px",
          }}
        >
          {FAMILY_LABEL[rule.family]}
        </span>
        {paramPairs(rule.params).map((p) => (
          <span
            key={p}
            className="font-mono"
            style={{
              fontSize: 11,
              color: "var(--text-muted)",
              padding: "2px 4px",
            }}
          >
            {p}
          </span>
        ))}
      </div>

      <div
        className="mt-2 font-mono"
        style={{ fontSize: 10.5, color: "var(--text-faint)" }}
      >
        {rule.provenance}
      </div>

      {isCodified && (
        <div
          className="mt-2 font-mono"
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "var(--verdict-pass)",
            letterSpacing: "0.02em",
          }}
        >
          ✓ regression gate PASS
        </div>
      )}
    </li>
  );
}

export default function RuleRegistryPanel() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;
  const query = useDeskUIStore((s) => s.query);
  const allRules = model.rules;
  const codified = model.codified;

  // The codified card is the last rule once the 5th has landed - track it by
  // identity so the search filter (below) can't shift it via index drift.
  const codifiedRuleId =
    codified && allRules.length ? allRules[allRules.length - 1].id : null;

  // Free-text search narrows the visible rows by family/id (task: SearchBar).
  const rules = query.trim()
    ? allRules.filter((r) => ruleMatchesQuery(r, query))
    : allRules;

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
      }}
      className="px-5 py-5"
    >
      <div className="flex items-baseline justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 10.5,
            textTransform: "uppercase",
            letterSpacing: "0.15em",
            color: "var(--text-muted)",
          }}
        >
          Rule Registry
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: codified ? "var(--verdict-escalate)" : "var(--text-body)",
            transition: reduce ? undefined : "color 0.45s var(--ease-out)",
          }}
        >
          {allRules.length - 1} {"→"} {allRules.length}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5" style={{ padding: 0, margin: 0 }}>
        {rules.length === 0 ? (
          <li
            className="font-sans"
            style={{ listStyle: "none", fontSize: 13, color: "var(--text-faint)" }}
          >
            No rules match “{query.trim()}”.
          </li>
        ) : (
          rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              isCodified={rule.id === codifiedRuleId}
              reduce={reduce}
            />
          ))
        )}
      </ul>
    </div>
  );
}
