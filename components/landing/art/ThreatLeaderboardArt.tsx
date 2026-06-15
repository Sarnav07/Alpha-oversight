"use client";

/**
 * ThreatLeaderboardArt — the A&O analog of AlphaLedger's "Leaderboard for Top
 * Strategies" big-metrics feature card. It is STATIC presentation art: no props,
 * no data fetching, no interactivity. It fills its parent (`w-full h-full`) so a
 * feature card can scale it freely, and it must remain legible when shrunk.
 *
 * Layout faithful to the reference (10.png):
 *  - title top-CENTRE (font-sans light, no eyebrow above it)
 *  - a 3-column grid: LEFT = two stacked metrics, CENTRE = emblem tile,
 *    RIGHT = two stacked metrics. The four metrics read as the 4 CORNERS
 *    around the emblem. NO absolute positioning — pure CSS grid, no overlaps.
 *  - the emblem is a rounded-square tile with a faint diagonal HATCH texture,
 *    a small "ALPHA & OVERSIGHT" label near its top, and the shared Logomark.
 *  - a centred one-line body sits BELOW the row.
 *
 * Design rules honoured:
 *  - all DATA (the metric figures) is mono; labels are uppercase tracked sans
 *  - colour is semantic-only (only the "rules codified" figure takes chroma:
 *    --verdict-pass); everything else is monochrome ink/gray
 *  - tokens come from globals.css, never hardcoded hex
 *  - the brand glyph is the shared <Logomark/>
 *
 * Self-contained, prop-less, default export.
 */

import Logomark from "@/components/landing/Logomark";

/* ── tiny building block ─────────────────────────────────────────────────── */

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
        className="font-mono font-light leading-none tracking-tight tabular-nums [font-size:clamp(18px,3.2vw,34px)]"
        style={{ color }}
      >
        {value}
      </div>
      <div className="mt-1.5 font-sans text-[9px] font-medium uppercase leading-tight tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </div>
    </div>
  );
}

/* ── main artwork ────────────────────────────────────────────────────────── */

export default function ThreatLeaderboardArt() {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden rounded-[var(--r-card)] border border-[var(--border-subtle)] bg-[var(--bg-card-2)] p-[clamp(16px,3vw,34px)] text-[var(--text-primary)]">
      {/* ── title (top-centre) ───────────────────────────────────────────── */}
      <h3 className="text-center font-sans font-light leading-tight tracking-[-0.01em] [font-size:clamp(16px,2.6vw,28px)]">
        The codify engine
      </h3>

      {/* ── metrics flanking the emblem (4 corners) ──────────────────────── */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_auto_1fr] items-center gap-[clamp(10px,3vw,44px)] py-[clamp(14px,3vh,32px)]">
        {/* left column — TL + BL */}
        <div className="flex flex-col justify-between gap-[clamp(22px,5vh,52px)]">
          <Metric value="197" label="Tests passing" align="left" />
          <Metric
            value={
              <span>
                4&nbsp;
                <span className="text-[0.7em] text-[var(--text-faint)]">→</span>
                &nbsp;5
              </span>
            }
            label="Rules codified"
            color="var(--verdict-pass)"
            align="left"
          />
        </div>

        {/* centre emblem tile */}
        <div
          className="relative flex aspect-square w-[clamp(72px,11vw,128px)] flex-col items-center justify-center overflow-hidden border border-[var(--border-default)] bg-[var(--bg-inset)]"
          style={{
            borderRadius: "var(--r-chip)",
            // notch the bottom-left corner to echo the reference emblem
            clipPath:
              "polygon(0 0, 100% 0, 100% 100%, 22% 100%, 0 78%)",
          }}
        >
          {/* faint repeating-diagonal hatch texture */}
          <span
            aria-hidden="true"
            className="absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, var(--border-subtle) 0, var(--border-subtle) 1px, transparent 1px, transparent 7px)",
            }}
          />
          {/* small brand label near the top */}
          <span className="relative mt-[clamp(8px,1.6vh,16px)] font-sans text-[clamp(7px,0.9vw,10px)] font-medium uppercase tracking-[0.16em] text-[var(--text-muted)]">
            Alpha &amp; Oversight
          </span>
          {/* the shared logomark */}
          <Logomark
            size={36}
            className="relative mt-[clamp(8px,2vh,18px)] text-[var(--text-body)]"
          />
        </div>

        {/* right column — TR + BR */}
        <div className="flex flex-col justify-between gap-[clamp(22px,5vh,52px)]">
          <Metric value="0" label="Regressions" align="right" />
          <Metric value="< 3s" label="Codify time" align="right" />
        </div>
      </div>

      {/* ── body line (centred, below) ───────────────────────────────────── */}
      <p className="mx-auto max-w-[42ch] text-center font-sans text-[clamp(11px,1.4vw,14px)] leading-snug text-[var(--text-body)]">
        A confirmed evasion becomes a deterministic rule in under three seconds —
        and the regression gate proves it breaks nothing.
      </p>
    </div>
  );
}
