"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import type { TimelineDot } from "@/lib/desk/contract";

/**
 * VerdictTimeline — vertical dot timeline of the case lifecycle.
 *
 * Renders `model.timeline` (TimelineDot[]). Dot color maps from `tone`:
 *   pass → --verdict-pass · flag → --verdict-flag · escalate → --verdict-escalate
 *   complete → --verdict-complete · band → --band-blue · neutral → --text-faint
 *
 * On a PASS→FLAG transition (Beat B confirm), the segment connecting the last
 * PASS dot to the new FLAG dot re-shades amber→red. `font-mono` HH:MM:SS stamps
 * sliced from the ISO `ts`. Reduced-motion renders final colors immediately.
 */

const TONE_VAR: Record<TimelineDot["tone"], string> = {
  pass: "var(--verdict-pass)",
  flag: "var(--verdict-flag)",
  escalate: "var(--verdict-escalate)",
  complete: "var(--verdict-complete)",
  band: "var(--band-blue)",
  neutral: "var(--text-faint)",
};

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

export default function VerdictTimeline() {
  const model = useDeskModel();
  const reduce = useReducedMotion() ?? false;
  const dots = model.timeline;

  // Track whether a FLAG has appeared after a PASS — drives the segment re-shade.
  const [flipped, setFlipped] = useState(false);
  const sawFlag = useRef(false);

  const hasPass = dots.some((d) => d.tone === "pass");
  const flagIndex = dots.findIndex((d) => d.tone === "flag");
  const passToFlag = hasPass && flagIndex > 0;

  useEffect(() => {
    if (reduce) {
      setFlipped(passToFlag);
      return;
    }
    if (passToFlag && !sawFlag.current) {
      sawFlag.current = true;
      setFlipped(true);
    }
  }, [passToFlag, reduce]);

  if (dots.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "var(--r-card)",
        }}
        className="px-5 py-5"
      >
        <Eyebrow />
        <p
          className="mt-4 font-sans"
          style={{ fontSize: 13, color: "var(--text-faint)" }}
        >
          Awaiting first verdict…
        </p>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: "var(--bg-card)",
        border: "1px solid var(--border-subtle)",
        borderRadius: "var(--r-card)",
      }}
      className="px-5 py-5"
    >
      <Eyebrow />
      <ol className="mt-5" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {dots.map((dot, i) => {
          const isLast = i === dots.length - 1;
          // The connector below this dot. Re-shade the segment that leads INTO
          // the flag dot from amber (transition) to red on PASS→FLAG.
          const leadsToFlag = flagIndex > 0 && i === flagIndex - 1;
          const connectorColor =
            leadsToFlag && flipped
              ? "var(--verdict-flag)"
              : "var(--hairline)";

          return (
            <li
              key={dot.id}
              className="relative flex gap-4"
              style={{ paddingBottom: isLast ? 0 : 20 }}
            >
              {/* rail + dot */}
              <div
                className="relative flex flex-col items-center"
                style={{ width: 12 }}
              >
                <motion.span
                  initial={reduce ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ duration: 0.4, ease: EASE }}
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: "50%",
                    backgroundColor: TONE_VAR[dot.tone],
                    boxShadow:
                      dot.tone === "band"
                        ? "0 0 10px var(--band-blue-glow)"
                        : "none",
                    flex: "0 0 auto",
                    zIndex: 1,
                  }}
                />
                {!isLast && (
                  <motion.span
                    aria-hidden
                    style={{
                      width: 2,
                      flex: 1,
                      marginTop: 2,
                      backgroundColor: connectorColor,
                    }}
                    animate={{ backgroundColor: connectorColor }}
                    transition={
                      reduce ? { duration: 0 } : { duration: 0.6, ease: EASE }
                    }
                  />
                )}
              </div>

              {/* label + timestamp */}
              <div className="flex flex-col gap-0.5 pb-0">
                <span
                  className="font-sans"
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--text-body)",
                    textTransform: "capitalize",
                  }}
                >
                  {dot.label}
                </span>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    letterSpacing: "0.04em",
                    color: "var(--text-muted)",
                  }}
                >
                  {dot.ts.slice(11, 19)}
                </span>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Eyebrow() {
  return (
    <span
      className="font-mono"
      style={{
        fontSize: 10.5,
        textTransform: "uppercase",
        letterSpacing: "0.15em",
        color: "var(--text-muted)",
      }}
    >
      Verdict Timeline
    </span>
  );
}
