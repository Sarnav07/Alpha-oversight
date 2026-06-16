"use client";

/**
 * ComputeBoardArt — the abstract, on-brand "compute fabric" visual that slides in
 * from the right in <PoweredBySection/>. It is the A&O analog of AlphaLedger's
 * photoreal Nvidia HPC board (which we can't use): a stylized silicon board — a
 * dark panel, a central die with a fine module grid, flanked memory stacks, and
 * faint traces — evoking "industry-grade compute" in our monochrome identity.
 *
 * Design rules honoured:
 *  - monochrome backbone; the only colour is the MODEL-TIER tones (--tier-frontier
 *    gold, --tier-open graphite) + desk tones, used purely as faint "lit module"
 *    accents. NEVER --band-blue (sacred = waiting-on-Band only).
 *  - token colours are applied via inline `style` (CSS context where var()
 *    resolves) — NOT as SVG presentation attributes (where var() would be ignored),
 *    matching the AuditChainArt pattern. Literal hex/rgba stay as attributes.
 *  - everything deterministic (no Math.random) so SSR == client (no hydration drift).
 *  - pure presentation: no props, no data. Fills its parent (w-full h-full).
 *
 * Self-contained, prop-less, default export.
 */

const COLS = 12;
const ROWS = 8;

/** die inner geometry (within the viewBox below). */
const DIE = { x: 188, y: 104, w: 372, h: 244, pad: 18 };

/** deterministically "lit" cells: index -> tone (tier/desk). Hand-placed clusters
 *  so the die reads as active silicon without a loud, evenly-lit grid. */
const LIT: Record<number, string> = {
  14: "var(--tier-frontier)",
  15: "var(--tier-frontier)",
  26: "var(--tier-frontier)",
  27: "var(--tier-open)",
  39: "var(--desk-surv)",
  51: "var(--tier-open)",
  52: "var(--desk-surv)",
  53: "var(--desk-surv)",
  64: "var(--tier-open)",
  68: "var(--tier-frontier)",
  69: "var(--tier-frontier)",
  80: "var(--desk-surv)",
  81: "var(--tier-open)",
  82: "var(--tier-open)",
  90: "var(--desk-surv)",
};

function dieCells() {
  const gapX = 5;
  const gapY = 6;
  const innerW = DIE.w - DIE.pad * 2;
  const innerH = DIE.h - DIE.pad * 2;
  const cw = (innerW - gapX * (COLS - 1)) / COLS;
  const ch = (innerH - gapY * (ROWS - 1)) / ROWS;
  const cells: { x: number; y: number; w: number; h: number; fill: string; op: number }[] = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const i = r * COLS + c;
      const lit = LIT[i];
      cells.push({
        x: DIE.x + DIE.pad + c * (cw + gapX),
        y: DIE.y + DIE.pad + r * (ch + gapY),
        w: cw,
        h: ch,
        fill: lit ?? "var(--frost)",
        op: lit ? 0.85 : 0.05,
      });
    }
  }
  return cells;
}

/** a flanked memory stack (vertical bars) at x. */
function MemStack({ x }: { x: number }) {
  const bars = Array.from({ length: 7 });
  return (
    <g style={{ fill: "var(--frost)" }}>
      {bars.map((_, i) => (
        <rect
          key={i}
          x={x}
          y={120 + i * 30}
          width={26}
          height={20}
          rx={3}
          opacity={i % 3 === 0 ? 0.14 : 0.07}
        />
      ))}
    </g>
  );
}

const MONO = "var(--font-mono)";

export default function ComputeBoardArt() {
  const cells = dieCells();
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 700 452"
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="cb-dots" width="22" height="22" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="rgba(255,255,255,0.04)" />
        </pattern>
        <radialGradient id="cb-glow" cx="50%" cy="46%" r="42%">
          <stop offset="0%" stopColor="rgba(201,162,39,0.10)" />
          <stop offset="100%" stopColor="rgba(201,162,39,0)" />
        </radialGradient>
      </defs>

      {/* board panel */}
      <rect
        x="3"
        y="3"
        width="694"
        height="446"
        rx="20"
        style={{ fill: "var(--bg-inset)", stroke: "var(--hairline)" }}
      />
      {/* faint dotted substrate + warm glow under the die */}
      <rect x="3" y="3" width="694" height="446" rx="20" fill="url(#cb-dots)" />
      <rect x="3" y="3" width="694" height="446" rx="20" fill="url(#cb-glow)" />

      {/* eyebrow + readouts */}
      <text x="28" y="40" fontSize="11" letterSpacing="2" style={{ fill: "var(--text-faint)", fontFamily: MONO }}>
        ● COMPUTE FABRIC
      </text>
      <text x="672" y="40" textAnchor="end" fontSize="11" letterSpacing="1" style={{ fill: "var(--text-faint)", fontFamily: MONO }}>
        14 agents · 2 tiers
      </text>

      {/* traces from die to the memory stacks */}
      <g fill="none" stroke="rgba(255,255,255,0.10)" strokeWidth="1.2">
        <path d="M188 150 H120 V132" />
        <path d="M188 226 H110" />
        <path d="M188 300 H120 V322" />
        <path d="M560 150 H600 V132" />
        <path d="M560 226 H610" />
        <path d="M560 300 H600 V322" />
      </g>

      {/* memory stacks */}
      <MemStack x={74} />
      <MemStack x={600} />

      {/* central die */}
      <rect
        x={DIE.x}
        y={DIE.y}
        width={DIE.w}
        height={DIE.h}
        rx="12"
        fill="#0c0d10"
        stroke="rgba(255,255,255,0.10)"
      />
      {/* die label */}
      <text
        x={DIE.x + DIE.w / 2}
        y={DIE.y - 10}
        textAnchor="middle"
        fontSize="10"
        letterSpacing="2.5"
        style={{ fill: "var(--text-muted)", fontFamily: MONO }}
      >
        ADVERSARIAL · SURVEILLANCE
      </text>
      {/* die module grid */}
      <g>
        {cells.map((c, i) => (
          <rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} rx={2} style={{ fill: c.fill, opacity: c.op }} />
        ))}
      </g>

      {/* corner mounting screws */}
      {[
        [24, 24],
        [676, 24],
        [24, 428],
        [676, 428],
      ].map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="4" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.4" />
      ))}
    </svg>
  );
}
