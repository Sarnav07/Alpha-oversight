"use client";

/**
 * ThreatLeaderboardArt — the A&O analog of AlphaLedger's "Leaderboard for Top
 * Strategies" big-metrics feature card. It is STATIC presentation art: no props,
 * no data fetching, no interactivity. It fills its parent (`w-full h-full`) so a
 * feature card can scale it freely, and it must remain legible when shrunk.
 *
 * The piece visualises A&O's "codify engine" business value: a confirmed evasion
 * becomes a deterministic rule in seconds, and a regression gate proves nothing
 * breaks. Four big mono metrics flank a centred logomark emblem tile.
 *
 * Design rules honoured:
 *  - all DATA (the metric figures) is mono; labels are uppercase tracked sans
 *  - colour is semantic-only (only the "rules codified" figure takes chroma:
 *    --verdict-pass); everything else is monochrome ink/gray
 *  - tokens come from globals.css, never hardcoded hex
 *  - ◢ logomark uses the shared rotated rounded-top-left box mark
 *
 * Self-contained, prop-less, default export.
 */

/* ── tiny building blocks ────────────────────────────────────────────────── */

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-sans text-[9px] font-medium uppercase tracking-[0.18em] text-[var(--text-muted)]">
      {children}
    </p>
  );
}

/** A big mono metric figure with a small uppercase label below. */
function Metric({
  value,
  label,
  color = "var(--text-primary)",
  align = "left",
}: {
  value: React.ReactNode;
  label: string;
  color?: string;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div
        className="font-mono font-light leading-none tracking-tight tabular-nums [font-size:clamp(20px,3.4vw,38px)]"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-2 font-sans text-[9px] font-medium uppercase leading-tight tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

/** The ◢ A&O logomark: a small rounded-top-left box rotated 45deg. */
function Logomark({ className = "" }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-block rotate-45 rounded-tl-[3px] border-[1.5px] border-current border-b-0 border-r-0 ${className}`}
    />
  );
}

/* ── main artwork ────────────────────────────────────────────────────────── */

export default function ThreatLeaderboardArt() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-card-2)] p-[clamp(16px,3vw,32px)] text-[var(--text-primary)]">
      {/* ── title ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-sans font-light leading-tight tracking-[-0.01em] [font-size:clamp(15px,2.4vw,26px)]">
          The codify engine
        </h3>
        <Eyebrow>Codify · v5</Eyebrow>
      </div>

      {/* ── metrics flanking the emblem ──────────────────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-[clamp(12px,3vw,40px)] py-[clamp(16px,3vh,36px)]">
        {/* left column */}
        <div className="flex flex-col gap-[clamp(18px,4vh,44px)]">
          <Metric value="197" label="Tests passing" align="left" />
          <Metric
            value={
              <span>
                4&nbsp;<span className="text-[0.7em] text-[var(--text-faint)]">→</span>&nbsp;5
              </span>
            }
            label="Rules codified live"
            color="var(--verdict-pass)"
            align="left"
          />
        </div>

        {/* centre emblem tile */}
        <div className="relative flex aspect-square w-[clamp(56px,9vw,104px)] items-center justify-center overflow-hidden rounded-[var(--r-chip)] border border-[var(--border-default)] bg-[var(--bg-inset)]">
          {/* faint repeating-diagonal hatch texture */}
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent 7px)",
            }}
          />
          <Logomark className="relative h-[clamp(20px,3.2vw,36px)] w-[clamp(20px,3.2vw,36px)] text-[var(--text-body)]" />
        </div>

        {/* right column */}
        <div className="flex flex-col items-end gap-[clamp(18px,4vh,44px)]">
          <Metric value="0" label="Regressions" align="right" />
          <Metric value="< 3s" label="Codify time" align="right" />
        </div>
      </div>

      {/* ── body line ────────────────────────────────────────────────────── */}
      <p className="border-t border-[var(--hairline)] pt-[clamp(12px,2vh,20px)] font-sans text-[clamp(11px,1.4vw,14px)] leading-snug text-[var(--text-body)]">
        A confirmed evasion becomes a deterministic rule in under three seconds —
        and the regression gate proves it breaks nothing.
      </p>
    </div>
  );
}
