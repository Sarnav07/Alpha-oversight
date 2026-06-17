"use client";

/**
 * ModelBadge - the cross-model tier tag (shared; DossierCards + others import it).
 * frontier (gold `--tier-frontier`) if the model id mentions "frontier", else
 * open (graphite `--tier-open`). Mono glyph `▸ frontier|open`. Static - no motion.
 */
type ModelBadgeProps = {
  modelId: string;
  className?: string;
};

export default function ModelBadge({ modelId, className }: ModelBadgeProps) {
  const frontier = modelId.includes("frontier");
  return (
    <span
      className={`font-mono text-[9px] px-1.5 py-0.5 rounded-[var(--r-chip)] border leading-none ${className ?? ""}`}
      style={{
        color: frontier ? "var(--tier-frontier)" : "var(--tier-open)",
        borderColor: frontier ? "#5a4d22" : "var(--border-default)",
        background: frontier ? "#3a3320" : "#1a1c20",
      }}
    >
      ▸ {frontier ? "frontier" : "open"}
    </span>
  );
}
