"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";

/**
 * StatsBar - the horizontal tile row at the head of the /desk Command Center.
 *
 * Stays DARK to match the command-center backbone (no data-section="light"
 * wrapper). Every tile is folded from real `model.stats` (GET /stats - case
 * counts by state + active-rule count); nothing is scripted.
 *
 * Numbers are font-mono; uppercase tracked eyebrow labels in `--text-muted`. The
 * Active Rules tile rolls 4→5 the instant `model.codified` flips. Respects
 * prefers-reduced-motion (final values, no roll).
 */

/** Active Rules tile - rolls 4→5 when codified flips. */
function ActiveRulesNumber({
  count,
  codified,
  reduce,
}: {
  count: number;
  codified: boolean;
  reduce: boolean;
}) {
  const [rolling, setRolling] = useState(false);
  const prev = useRef(count);

  useEffect(() => {
    if (reduce) {
      prev.current = count;
      return;
    }
    if (count > prev.current) {
      setRolling(true);
      const id = window.setTimeout(() => setRolling(false), 600);
      prev.current = count;
      return () => window.clearTimeout(id);
    }
    prev.current = count;
  }, [count, reduce]);

  return (
    <span
      style={{
        display: "inline-block",
        transition: reduce ? undefined : "transform 0.45s var(--ease-spring)",
        transform: rolling ? "translateY(-2px)" : "translateY(0)",
        color: codified ? "var(--verdict-escalate)" : "var(--text-primary)",
      }}
    >
      {count}
    </span>
  );
}

type Tile = {
  label: string;
  /** when true, this tile is sourced from a failed REST query - show "-". */
  errored: boolean;
  render: (reduce: boolean) => React.ReactNode;
};

/** A dimmed em-dash placeholder for a tile whose REST source is unavailable. */
function Unavailable() {
  return (
    <span style={{ color: "var(--verdict-flag)" }} title="Unavailable - backend unreachable">
      -
    </span>
  );
}

export default function StatsBar() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;

  // Active Rules is folded from the rules list (GET /rules); the count + by-state
  // tiles come from GET /stats. Surface each query's failure on its own tiles so
  // a dead backend reads as "-"/unavailable instead of silent seed/zero numbers.
  const { statsError, rulesError } = model;

  const tiles: Tile[] = [
    {
      label: "Active Rules",
      errored: rulesError,
      render: (r) => (
        <ActiveRulesNumber
          count={model.stats.active_rules}
          codified={model.codified}
          reduce={r}
        />
      ),
    },
    {
      label: "Flagged",
      errored: statsError,
      render: () => <span>{model.stats.flagged}</span>,
    },
    {
      label: "Escalated",
      errored: statsError,
      render: () => <span>{model.stats.escalated}</span>,
    },
    {
      label: "Total cases",
      errored: statsError,
      render: () => <span>{model.stats.total_cases}</span>,
    },
    {
      label: "Under review",
      errored: statsError,
      render: () => <span>{model.stats.by_state["UNDER_REVIEW"] ?? 0}</span>,
    },
    {
      label: "Closed",
      errored: statsError,
      render: () => <span>{model.stats.by_state["CLOSED"] ?? 0}</span>,
    },
  ];

  return (
    <div
      role="group"
      aria-label="Surveillance desk statistics"
      className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
        overflow: "hidden",
      }}
    >
      {tiles.map((tile, i) => (
        <div
          key={tile.label}
          className="flex flex-col gap-2 px-5 py-5"
          style={{
            borderLeft:
              i % 6 === 0 ? "none" : "1px solid var(--hairline)",
            borderTop: "none",
          }}
        >
          <span
            className="font-mono"
            style={{
              fontSize: "clamp(24px, 2.4vw, 34px)",
              fontWeight: 400,
              lineHeight: 1,
              letterSpacing: "-0.02em",
              fontVariantNumeric: "tabular-nums",
              color: "var(--text-primary)",
            }}
          >
            {tile.errored ? <Unavailable /> : tile.render(reduce)}
          </span>
          <span
            className="font-sans"
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.15em",
              color: tile.errored ? "var(--verdict-flag)" : "var(--text-muted)",
            }}
          >
            {tile.errored ? "unavailable" : tile.label}
          </span>
        </div>
      ))}
    </div>
  );
}
