"use client";

import { useRef } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { Caption } from "./evasion/Caption";
import { Hud, HudStatic } from "./evasion/Hud";
import { PhaseRail } from "./evasion/PhaseRail";
import { useIsMobile } from "@/components/landing/useIsMobile";
import {
  VIEW_W,
  VIEW_H,
  LANE,
  TICKS,
  tx,
  twidth,
  laneY,
  BENIGN_FLOW,
  CANCEL_XS,
  CLUSTER,
  CLUSTER_CENTER_MS,
  windowBracket,
  WINDOW,
  GAUGE,
  ratioY,
  RATIO,
  WALL_X,
} from "./evasion/stage";

/**
 * EvasionStory — the centerpiece pinned scroll-story for /how-it-works.
 *
 * One morphing SVG stage (the order/time lane) driven by scroll progress through
 * SIX chapters. A tall runway creates the scroll distance; a sticky stage holds
 * the canvas + overlays for the duration. `useScroll` over the runway →
 * `useSpring` smooths the raw progress → every visual is a `useTransform` of the
 * smoothed value. Crossfading caption cards (Caption), a live mono HUD (Hud), a
 * phase indicator + progress rail (PhaseRail).
 *
 * The page is LIGHT; the stage panel + cards are DARK glass so the semantic
 * accents glow. `--band-blue` (chapter 3) means "waiting on Band" and nothing
 * else.
 *
 * Reduced motion → renders the FINAL chapter state statically (codified window
 * 450ms, cluster INSIDE → FLAG ✓, rules 5), no scroll animation.
 *
 * Six chapter centers on the 0..1 timeline (i+0.5)/6:
 *   1 Clean flow · 2 Adversary's move · 3 Across the Band · 4 The debate ·
 *   5 The verdict · 6 Codify.
 */

const N = 6;
const c = (i: number) => (i + 0.5) / N; // chapter center (0-indexed)
const HALF = 0.5 / N;

export function EvasionStory() {
  const reduce = useReducedMotion();
  const isMobile = useIsMobile();
  const runwayRef = useRef<HTMLDivElement | null>(null);

  const { scrollYProgress } = useScroll({
    target: runwayRef,
    offset: ["start start", "end end"],
  });
  const t = useSpring(scrollYProgress, {
    stiffness: 110,
    damping: 28,
    restDelta: 0.0001,
  });

  // Mobile: the 620vh pin scroll-jacks and the wide SVG stage overflows, so we
  // drop the pin and render a static stage + the chapters as stacked sections.
  if (isMobile === true) {
    return <MobileStory />;
  }

  if (reduce) {
    return (
      <section aria-label="The Evasion" className="relative">
        <div className="mx-auto w-full max-w-[var(--maxw-content)] px-6 py-16 sm:px-10">
          <StageFrame>
            <StaticFinalStage />
            <HudStatic />
            <PhaseRail t={t} staticActive={5} />
            <Caption
              t={t}
              range={[0, 0, 1, 1]}
              no={6}
              eyebrow="Codify"
              title={
                <>
                  The system learns.{" "}
                  <span className="text-[var(--text-muted)]">
                    That evasion can never evade again.
                  </span>
                </>
              }
              body="A human confirms the escalation; the regression gate replays the original 400ms layering through the new 450ms window — it FLAGs. Active rules roll 4 ▸ 5."
            />
          </StageFrame>
        </div>
      </section>
    );
  }

  return (
    <section aria-label="The Evasion" className="relative">
      {/* Runway — its height is the scroll distance the story plays over. */}
      <div ref={runwayRef} className="relative h-[620vh]">
        {/* Sticky stage — pinned below the 3.5rem header for the duration. */}
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] w-full">
          <div className="mx-auto flex h-full w-full max-w-[var(--maxw-content)] items-center px-4 sm:px-8">
            <StageFrame>
              <MorphStage t={t} />
              <DerivedHud t={t} />
              <PhaseRail t={t} />
              <Captions t={t} />
            </StageFrame>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ── shared dark-glass stage frame ──────────────────────────────────────── */
function StageFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="relative w-full overflow-hidden rounded-[var(--r-card)] border"
      style={{
        aspectRatio: `${VIEW_W} / ${VIEW_H}`,
        maxHeight: "84vh",
        margin: "0 auto",
        backgroundColor: "var(--bg-inset)",
        borderColor: "var(--hairline)",
        boxShadow: "0 40px 110px rgba(0,0,0,0.5)",
      }}
    >
      {children}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   THE MORPHING SVG STAGE
   ════════════════════════════════════════════════════════════════════════ */

function MorphStage({ t }: { t: MotionValue<number> }) {
  /* ── benign flow: visible chapter 1, fades as the cluster takes over ── */
  const flowOpacity = useTransform(t, [0, c(0) + HALF, c(1)], [1, 1, 0.16]);

  /* ── cancel cluster: forms over chapter 2, persists after ── */
  // reveal fraction of the 8 cancel marks 0→1 across the chapter-2 ramp
  const clusterReveal = useTransform(t, [c(1) - HALF, c(1)], [0, 1]);

  /* ── ratio needle: 0.08 → 0.94 over chapter 2 ── */
  const ratio = useTransform<number, number>(t, [c(1) - HALF, c(1)], [RATIO.clean, RATIO.evasion]);
  const needleY = useTransform(ratio, (r) => ratioY(r));
  const barHeight = useTransform(needleY, (y) => GAUGE.bottom - y);

  /* ── Chinese wall sweep: chapter 3 ── */
  // wall wipes left→right across the cluster
  const wallProgress = useTransform(t, [c(2) - HALF, c(2)], [0, 1]);
  const wallX = useTransform(wallProgress, [0, 1], [-40, VIEW_W + 40]);
  const wallOpacity = useTransform(t, [c(2) - HALF, c(2), c(2) + HALF], [0, 0.9, 0]);
  // investigator marker turns band-blue once the case crosses (chapter 3 on)
  const bandOn = useTransform(t, [c(2) - 0.2 * HALF, c(2)], [0, 1]);

  /* ── rule-window bracket: quivers between candidates (ch4) → seed (ch5) →
        widens to codified (ch6) ── */
  // window width in ms across the chapters
  const windowMs = useTransform(
    t,
    [
      c(2) + HALF, // before debate: no window yet (hold at seed for layout)
      c(3) - HALF, // debate enter
      c(3) - 0.25 * HALF, // prosecution wide
      c(3) + 0.25 * HALF, // defense tight
      c(3) + HALF, // debate settle near seed
      c(4), // verdict: seed 100ms drawn
      c(5) - HALF, // codify enter
      c(5), // codified 450ms
    ],
    [
      WINDOW.seed,
      WINDOW.seed,
      WINDOW.prosecution,
      WINDOW.defense,
      WINDOW.seed + 20,
      WINDOW.seed,
      WINDOW.seed,
      WINDOW.codified,
    ],
  );
  // bracket is invisible until the debate begins
  const bracketOpacity = useTransform(
    t,
    [c(2) + HALF, c(3) - HALF, 1],
    [0, 1, 1],
  );
  const bracketLeft = useTransform(windowMs, (w) => windowBracket(w).left);
  const bracketRight = useTransform(windowMs, (w) => windowBracket(w).right);
  const bracketW = useTransform(windowMs, (w) => twidth(w));
  const cx = tx(CLUSTER_CENTER_MS);

  /* ── verdict tones: amber PASS-escalate (ch5) → red FLAG (ch6) ── */
  // does the cluster sit inside the window?  span 400ms vs window width
  const clusterInside = useTransform(windowMs, (w): number =>
    w >= CLUSTER.endMs - CLUSTER.startMs ? 1 : 0,
  );
  const clusterStroke = useTransform(clusterInside, (v): string =>
    v >= 0.5 ? "var(--verdict-flag)" : "var(--verdict-escalate)",
  );

  /* ── codify flash: amber border decay on the bracket as it widens (ch6) ── */
  const codifyGlow = useTransform(
    t,
    [c(5) - HALF, c(5) - 0.2 * HALF, c(5) + HALF],
    [0, 1, 0],
  );

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* faint grid backdrop */}
      <rect x={0} y={0} width={VIEW_W} height={VIEW_H} fill="transparent" />

      {/* ── the time lane rail + ticks ── */}
      <line
        x1={LANE.x0}
        y1={LANE.y}
        x2={LANE.x1}
        y2={LANE.y}
        stroke="var(--border-default)"
        strokeWidth={1.5}
      />
      {TICKS.map((ms) => (
        <g key={ms}>
          <line
            x1={tx(ms)}
            y1={LANE.y - 5}
            x2={tx(ms)}
            y2={LANE.y + 5}
            stroke="var(--text-faint)"
            strokeWidth={1}
          />
          <text
            x={tx(ms)}
            y={LANE.y + 22}
            textAnchor="middle"
            className="font-mono"
            fontSize={11}
            fill="var(--text-faint)"
          >
            {ms}
          </text>
        </g>
      ))}
      <text
        x={LANE.x0}
        y={LANE.y + 46}
        className="font-mono"
        fontSize={10}
        letterSpacing="0.14em"
        fill="var(--text-muted)"
      >
        TIME (ms) →
      </text>

      {/* ── benign order flow dots ── */}
      <motion.g style={{ opacity: flowOpacity }}>
        {BENIGN_FLOW.map((d, i) => (
          <circle
            key={i}
            cx={tx(d.ms)}
            cy={laneY(d.lane)}
            r={d.kind === "fill" ? 5 : 4}
            fill={d.kind === "fill" ? "var(--verdict-pass)" : "var(--desk-surv)"}
            opacity={d.kind === "fill" ? 0.9 : 0.55}
          />
        ))}
        {/* connecting stems to the rail */}
        {BENIGN_FLOW.map((d, i) => (
          <line
            key={`s${i}`}
            x1={tx(d.ms)}
            y1={LANE.y}
            x2={tx(d.ms)}
            y2={laneY(d.lane)}
            stroke="var(--hairline)"
            strokeWidth={1}
          />
        ))}
      </motion.g>

      {/* ── the rule-window bracket (debate → verdict → codify) ── */}
      <motion.g style={{ opacity: bracketOpacity }}>
        {/* window fill */}
        <motion.rect
          x={bracketLeft}
          y={LANE.y - 96}
          width={bracketW}
          height={192}
          rx={6}
          style={{ fill: "rgba(154,166,196,0.07)", stroke: "var(--desk-surv)" }}
          strokeWidth={1.25}
          strokeDasharray="5 4"
        />
        {/* codify amber glow ring */}
        <motion.rect
          x={bracketLeft}
          y={LANE.y - 96}
          width={bracketW}
          height={192}
          rx={6}
          fill="none"
          stroke="var(--verdict-escalate)"
          strokeWidth={2}
          style={{ opacity: codifyGlow }}
        />
        {/* left/right caps */}
        <motion.line
          x1={bracketLeft}
          y1={LANE.y - 100}
          x2={bracketLeft}
          y2={LANE.y + 100}
          stroke="var(--desk-surv)"
          strokeWidth={1.5}
        />
        <motion.line
          x1={bracketRight}
          y1={LANE.y - 100}
          x2={bracketRight}
          y2={LANE.y + 100}
          stroke="var(--desk-surv)"
          strokeWidth={1.5}
        />
        {/* window width label */}
        <WindowLabel windowMs={windowMs} cx={cx} />
      </motion.g>

      {/* ── the cancel cluster (8 marks spanning ~400ms) ── */}
      <g>
        {CANCEL_XS.map((x, i) => (
          <CancelMark
            key={i}
            x={x}
            index={i}
            reveal={clusterReveal}
            stroke={clusterStroke}
          />
        ))}
        {/* cluster span bracket under the lane */}
        <motion.line
          x1={tx(CLUSTER.startMs)}
          y1={LANE.y + 60}
          x2={tx(CLUSTER.endMs)}
          y2={LANE.y + 60}
          style={{ opacity: clusterReveal, stroke: clusterStroke }}
          strokeWidth={1.5}
        />
        <motion.text
          x={tx(CLUSTER_CENTER_MS)}
          y={LANE.y + 76}
          textAnchor="middle"
          className="font-mono"
          fontSize={10}
          style={{ opacity: clusterReveal, fill: clusterStroke }}
          letterSpacing="0.06em"
        >
          cancel cluster · 400ms
        </motion.text>
      </g>

      {/* ── investigator marker (waiting-on-Band, ch3) ── */}
      <InvestigatorMarker bandOn={bandOn} />

      {/* ── cancel_to_fill ratio gauge (right column) ── */}
      <g>
        <text
          x={GAUGE.x + GAUGE.width / 2}
          y={GAUGE.top - 16}
          textAnchor="middle"
          className="font-mono"
          fontSize={10}
          fill="var(--text-muted)"
          letterSpacing="0.08em"
        >
          cancel_to_fill
        </text>
        {/* gauge track */}
        <rect
          x={GAUGE.x}
          y={GAUGE.top}
          width={GAUGE.width}
          height={GAUGE.bottom - GAUGE.top}
          rx={6}
          fill="rgba(255,255,255,0.03)"
          stroke="var(--hairline)"
          strokeWidth={1}
        />
        {/* threshold line */}
        <line
          x1={GAUGE.x - 6}
          y1={ratioY(GAUGE.threshold)}
          x2={GAUGE.x + GAUGE.width + 6}
          y2={ratioY(GAUGE.threshold)}
          stroke="var(--verdict-escalate)"
          strokeWidth={1}
          strokeDasharray="3 3"
          opacity={0.7}
        />
        <text
          x={GAUGE.x + GAUGE.width + 10}
          y={ratioY(GAUGE.threshold) + 3}
          className="font-mono"
          fontSize={9}
          fill="var(--verdict-escalate)"
        >
          τ 0.70
        </text>
        {/* fill bar */}
        <motion.rect
          x={GAUGE.x + 1}
          width={GAUGE.width - 2}
          rx={5}
          style={{ y: needleY, height: barHeight, fill: clusterStroke }}
          opacity={0.85}
        />
        {/* needle cap — translateY by the needle position */}
        <motion.line
          x1={GAUGE.x - 4}
          x2={GAUGE.x + GAUGE.width + 4}
          y1={0}
          y2={0}
          strokeWidth={2}
          style={{ y: needleY, stroke: clusterStroke }}
        />
        <RatioLabel ratio={ratio} stroke={clusterStroke} />
      </g>

      {/* ── Chinese-wall divider sweep (ch3) ── */}
      <motion.g style={{ opacity: wallOpacity }}>
        <motion.line
          x1={wallX}
          y1={26}
          x2={wallX}
          y2={VIEW_H - 26}
          stroke="var(--desk-rnd)"
          strokeWidth={2}
          strokeDasharray="6 6"
        />
      </motion.g>
      {/* static wall hint at WALL_X for layout reference (very faint) */}
      <line
        x1={WALL_X}
        y1={40}
        x2={WALL_X}
        y2={VIEW_H - 40}
        stroke="var(--hairline)"
        strokeWidth={1}
        strokeDasharray="2 8"
        opacity={0.4}
      />
    </svg>
  );
}

/* A single CANCEL mark — an ✕ that scales in as the cluster forms. */
function CancelMark({
  x,
  index,
  reveal,
  stroke,
}: {
  x: number;
  index: number;
  reveal: MotionValue<number>;
  stroke: MotionValue<string>;
}) {
  // stagger: each mark reveals across a slice of the [0,1] reveal range
  const start = index / CANCEL_XS.length;
  const end = start + 1 / CANCEL_XS.length;
  const s = useTransform(reveal, [start, end], [0, 1]);
  const y = LANE.y;
  const r = 7;
  return (
    <motion.g style={{ opacity: s, scale: s, transformOrigin: `${x}px ${y}px` }}>
      <motion.line x1={x - r} y1={y - r} x2={x + r} y2={y + r} style={{ stroke }} strokeWidth={2.2} strokeLinecap="round" />
      <motion.line x1={x - r} y1={y + r} x2={x + r} y2={y - r} style={{ stroke }} strokeWidth={2.2} strokeLinecap="round" />
    </motion.g>
  );
}

/* Investigator node that turns band-blue ("waiting on Band") in chapter 3. */
function InvestigatorMarker({ bandOn }: { bandOn: MotionValue<number> }) {
  const fill = useTransform<number, string>(bandOn, [0, 1], ["var(--desk-surv)", "var(--band-blue)"]);
  const labelOpacity = useTransform(bandOn, [0.5, 1], [0, 1]);
  // breathing halo
  const haloOpacity = useTransform(bandOn, [0.6, 1], [0, 0.55]);
  const ix = 248;
  const iy = 92;
  return (
    <g>
      {/* breathing band halo — the CSS box-shadow pulse (.anim-band-pulse) does
          not render on SVG nodes, so the breathing is driven by a looping
          framer animation on the ring (radius + opacity) once the case has
          crossed; haloOpacity gates it on from chapter 3. */}
      <motion.circle
        cx={ix}
        cy={iy}
        fill="none"
        stroke="var(--band-blue)"
        strokeWidth={1.5}
        style={{ opacity: haloOpacity }}
        animate={{ r: [20, 26, 20] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.circle cx={ix} cy={iy} r={9} style={{ fill }} />
      <motion.text
        x={ix + 20}
        y={iy + 4}
        className="font-mono"
        fontSize={11}
        fill="var(--band-blue)"
        style={{ opacity: labelOpacity }}
        letterSpacing="0.04em"
      >
        ▓ waiting on Band ▓
      </motion.text>
      <text
        x={ix}
        y={iy - 30}
        textAnchor="middle"
        className="font-mono"
        fontSize={9.5}
        fill="var(--text-muted)"
        letterSpacing="0.1em"
      >
        INVESTIGATOR
      </text>
    </g>
  );
}

/* Window-width label that reads the live window in ms above the bracket. */
function WindowLabel({ windowMs, cx }: { windowMs: MotionValue<number>; cx: number }) {
  const text = useTransform(windowMs, (w) => `window ${Math.round(w)}ms`);
  return (
    <motion.text
      x={cx}
      y={LANE.y - 108}
      textAnchor="middle"
      className="font-mono"
      fontSize={11}
      fill="var(--desk-surv)"
      letterSpacing="0.06em"
    >
      {text}
    </motion.text>
  );
}

/* Numeric ratio readout at the base of the gauge. */
function RatioLabel({ ratio, stroke }: { ratio: MotionValue<number>; stroke: MotionValue<string> }) {
  const text = useTransform(ratio, (r) => r.toFixed(2));
  return (
    <motion.text
      x={GAUGE.x + GAUGE.width / 2}
      y={GAUGE.bottom + 22}
      textAnchor="middle"
      className="font-mono"
      fontSize={15}
      style={{ fill: stroke }}
    >
      {text}
    </motion.text>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   HUD — derive the numeric MotionValues for the read-out
   ════════════════════════════════════════════════════════════════════════ */
function DerivedHud({ t }: { t: MotionValue<number> }) {
  const ratio = useTransform<number, number>(t, [c(1) - HALF, c(1)], [RATIO.clean, RATIO.evasion]);
  const ratioTone = useTransform(ratio, (r): string =>
    r >= GAUGE.threshold ? "var(--verdict-escalate)" : "var(--text-primary)",
  );
  const depth = useTransform(t, [c(1) - HALF, c(1)], [1, 5]);

  const windowMs = useTransform(
    t,
    [c(3) - HALF, c(3) - 0.25 * HALF, c(3) + 0.25 * HALF, c(3) + HALF, c(4), c(5) - HALF, c(5)],
    [WINDOW.seed, WINDOW.prosecution, WINDOW.defense, WINDOW.seed + 20, WINDOW.seed, WINDOW.seed, WINDOW.codified],
  );

  // verdict: blank → (ch5) PASS escalate amber → (ch6) FLAG red
  const verdict = useTransform(t, (v): string => {
    if (v >= c(5) - 0.2 * HALF) return "FLAG ✓";
    if (v >= c(4) - HALF) return "PASS → ESC";
    return "—";
  });
  const verdictTone = useTransform(t, (v): string => {
    if (v >= c(5) - 0.2 * HALF) return "var(--verdict-flag)";
    if (v >= c(4) - HALF) return "var(--verdict-escalate)";
    return "var(--text-faint)";
  });
  const rules = useTransform(t, [c(5) - 0.3 * HALF, c(5)], [4, 5]);

  return (
    <Hud
      ratio={ratio}
      depth={depth}
      windowMs={windowMs}
      ratioTone={ratioTone}
      verdict={verdict}
      verdictTone={verdictTone}
      rules={rules}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════
   CHAPTERS — the six story beats (shared by the pinned crossfade captions and
   the mobile stacked-sequence fallback)
   ════════════════════════════════════════════════════════════════════════ */
type Chapter = {
  no: number;
  eyebrow: string;
  title: React.ReactNode;
  body: string;
  chip?: { label: string; tone?: string };
};

const CHAPTERS: Chapter[] = [
  {
    no: 1,
    eyebrow: "Clean flow",
    title: (
      <>
        Surveillance watches every order.{" "}
        <span className="text-[var(--text-muted)]">Most flow is benign.</span>
      </>
    ),
    body: "Places and fills tick across the order/time lane. cancel_to_fill sits low at 0.08 — nothing trips the rule engine.",
  },
  {
    no: 2,
    eyebrow: "The adversary's move",
    title: (
      <>
        The R&amp;D red team plants the evasion.{" "}
        <span className="text-[var(--text-muted)]">A 400ms cancel cluster forms.</span>
      </>
    ),
    body: "depth_levels climbs to 5, cancel_to_fill spikes to 0.94 — orders placed only to be pulled, layering the book to mislead.",
    chip: { label: "ADVERSARY · 400ms layering-evasion · Market #0", tone: "var(--desk-rnd)" },
  },
  {
    no: 3,
    eyebrow: "Across the Band",
    title: (
      <>
        The case crosses the Chinese wall.{" "}
        <span className="text-[var(--text-muted)]">Only sanitized events pass.</span>
      </>
    ),
    body: "Surveillance picks it up; the Investigator turns blue — waiting on Band — pulsing as the handoff routes through the bus.",
    chip: { label: "▓ waiting on Band ▓", tone: "var(--band-blue)" },
  },
  {
    no: 4,
    eyebrow: "The debate",
    title: (
      <>
        Prosecution ⚔ Defense.{" "}
        <span className="text-[var(--text-muted)]">They contest the window.</span>
      </>
    ),
    body: "A frontier model argues a wide window_ms; an open model argues tight. The rule-window bracket quivers between candidates until the adjudicator resolves it.",
    chip: { label: "frontier ⚔ open · contesting window_ms", tone: "var(--tier-frontier)" },
  },
  {
    no: 5,
    eyebrow: "The verdict",
    title: (
      <>
        The deterministic rule draws 100ms.{" "}
        <span className="text-[var(--text-muted)]">The cluster sits outside.</span>
      </>
    ),
    body: "The seed rule FINRA-5210-layering renders PASS — the 400ms evasion slips a 100ms window. No LLM overrules it; the case ESCALATES to a human.",
    chip: { label: "PASS (evaded) → ESCALATE", tone: "var(--verdict-escalate)" },
  },
  {
    no: 6,
    eyebrow: "Codify",
    title: (
      <>
        The system learns.{" "}
        <span className="text-[var(--text-muted)]">
          That evasion can never evade again.
        </span>
      </>
    ),
    body: "The human confirms; the window widens 100 ▸ 450ms. The regression gate replays the original evasion — it now FLAGs. Active rules roll 4 ▸ 5.",
    chip: { label: "FLAG ✓ · regression gate PASS · rules 4 ▸ 5", tone: "var(--verdict-flag)" },
  },
];

/* ── pinned path: six crossfaded cards ──────────────────────────────────── */
function Captions({ t }: { t: MotionValue<number> }) {
  // each caption: [enter, settled, leaveStart, leaveEnd]
  const win = (i: number): [number, number, number, number] => {
    const center = c(i);
    return [center - HALF, center - 0.35 * HALF, center + 0.35 * HALF, center + HALF];
  };

  return (
    <>
      {CHAPTERS.map((ch, i) => (
        <Caption
          key={ch.no}
          t={t}
          range={win(i)}
          no={ch.no}
          eyebrow={ch.eyebrow}
          title={ch.title}
          body={ch.body}
          chip={ch.chip}
        />
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   REDUCED-MOTION STATIC FINAL STAGE
   ════════════════════════════════════════════════════════════════════════ */
function StaticFinalStage() {
  const { left, right } = windowBracket(WINDOW.codified);
  const w = right - left;
  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* lane + ticks */}
      <line x1={LANE.x0} y1={LANE.y} x2={LANE.x1} y2={LANE.y} stroke="var(--border-default)" strokeWidth={1.5} />
      {TICKS.map((ms) => (
        <g key={ms}>
          <line x1={tx(ms)} y1={LANE.y - 5} x2={tx(ms)} y2={LANE.y + 5} stroke="var(--text-faint)" strokeWidth={1} />
          <text x={tx(ms)} y={LANE.y + 22} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--text-faint)">
            {ms}
          </text>
        </g>
      ))}
      {/* codified window (450ms) — cluster INSIDE → FLAG */}
      <rect x={left} y={LANE.y - 96} width={w} height={192} rx={6} fill="rgba(239,68,68,0.07)" stroke="var(--verdict-flag)" strokeWidth={1.25} strokeDasharray="5 4" />
      <text x={tx(CLUSTER_CENTER_MS)} y={LANE.y - 108} textAnchor="middle" className="font-mono" fontSize={11} fill="var(--verdict-flag)">
        window 450ms
      </text>
      {/* cancel cluster — FLAG red */}
      {CANCEL_XS.map((x, i) => (
        <g key={i}>
          <line x1={x - 7} y1={LANE.y - 7} x2={x + 7} y2={LANE.y + 7} stroke="var(--verdict-flag)" strokeWidth={2.2} strokeLinecap="round" />
          <line x1={x - 7} y1={LANE.y + 7} x2={x + 7} y2={LANE.y - 7} stroke="var(--verdict-flag)" strokeWidth={2.2} strokeLinecap="round" />
        </g>
      ))}
      <line x1={tx(CLUSTER.startMs)} y1={LANE.y + 60} x2={tx(CLUSTER.endMs)} y2={LANE.y + 60} stroke="var(--verdict-flag)" strokeWidth={1.5} />
      <text x={tx(CLUSTER_CENTER_MS)} y={LANE.y + 76} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--verdict-flag)">
        cancel cluster · 400ms · FLAG ✓
      </text>
      {/* ratio gauge at evasion level */}
      <rect x={GAUGE.x} y={GAUGE.top} width={GAUGE.width} height={GAUGE.bottom - GAUGE.top} rx={6} fill="rgba(255,255,255,0.03)" stroke="var(--hairline)" strokeWidth={1} />
      <rect x={GAUGE.x + 1} y={ratioY(RATIO.evasion)} width={GAUGE.width - 2} height={GAUGE.bottom - ratioY(RATIO.evasion)} rx={5} fill="var(--verdict-flag)" opacity={0.85} />
      <text x={GAUGE.x + GAUGE.width / 2} y={GAUGE.bottom + 22} textAnchor="middle" className="font-mono" fontSize={15} fill="var(--verdict-flag)">
        0.94
      </text>
    </svg>
  );
}

/* ════════════════════════════════════════════════════════════════════════
   MOBILE STORY — no pin. A static final stage at the top, then the six chapters
   rendered as normal stacked cards the user scrolls through.
   ════════════════════════════════════════════════════════════════════════ */
function MobileStory() {
  return (
    <section aria-label="The Evasion" className="relative">
      <div className="mx-auto w-full max-w-[var(--maxw-content)] px-4 py-10 sm:px-8 sm:py-14">
        <StageFrame>
          <StaticFinalStage />
          <HudStatic />
        </StageFrame>

        {/* the six beats, stacked */}
        <ol className="mt-8 flex flex-col gap-4">
          {CHAPTERS.map((ch) => (
            <li
              key={ch.no}
              className="rounded-[var(--r-card)] border p-5"
              style={{
                backgroundColor: "rgba(15,16,17,0.92)",
                borderColor: "rgba(255,255,255,0.09)",
              }}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-[var(--desk-surv)]">
                  {ch.eyebrow}
                </span>
                <span className="font-mono text-[10.5px] tracking-[0.18em] text-[var(--text-faint)]">
                  {String(ch.no).padStart(2, "0")} / 06
                </span>
              </div>

              {ch.chip ? (
                <div className="mt-3">
                  <span
                    className="inline-flex items-center gap-1.5 rounded-[var(--r-chip)] border px-2.5 py-1 font-mono text-[10.5px] tracking-[0.04em]"
                    style={{
                      color: ch.chip.tone ?? "var(--text-body)",
                      borderColor: ch.chip.tone
                        ? `${ch.chip.tone}55`
                        : "var(--border-default)",
                      backgroundColor: "rgba(255,255,255,0.02)",
                    }}
                  >
                    {ch.chip.label}
                  </span>
                </div>
              ) : null}

              <h3
                className="mt-4 font-sans"
                style={{
                  fontSize: "clamp(19px, 5.4vw, 24px)",
                  fontWeight: 360,
                  letterSpacing: "-0.012em",
                  lineHeight: 1.18,
                  color: "var(--text-primary)",
                }}
              >
                {ch.title}
              </h3>
              <p
                className="mt-2.5 font-sans text-[13.5px] leading-relaxed"
                style={{ color: "var(--text-body)" }}
              >
                {ch.body}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export default EvasionStory;
