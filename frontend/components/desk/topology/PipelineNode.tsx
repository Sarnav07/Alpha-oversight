/**
 * PipelineNode — one custom xyflow node = one pipeline actor.
 *
 * Status visuals (NodeView.status):
 *   idle             → dim, muted border
 *   active           → lit frost ring + scale, escalate-amber accent
 *   done             → settled (desk-tone border, normal text)
 *   waiting_on_band  → THE load-bearing visual: --band-blue fill, breathing
 *                      `.anim-band-pulse` halo, "▓ waiting on Band ▓" label.
 *
 * Verdict-flip: when this node's case verdict resolves to FLAG, recolor toward
 * --verdict-flag (red ring + label).
 *
 * Reduced-motion: the parent passes `staticMode`; when true we render the final
 * resting state of every status with NO animation (no pulse, no scale).
 */
"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";
import type { NodeId, NodeStatus } from "@/lib/desk/contract";
import type { Desk } from "@/lib/types";

export type PipelineNodeData = {
  nodeId: NodeId;
  label: string;
  desk: Desk;
  status: NodeStatus;
  detail: string | null;
  modelTier: "frontier" | "open" | "deterministic" | null;
  /** true when this node's case verdict resolved to FLAG (drives the red flip). */
  flagged: boolean;
  /** reduced-motion: render final state, no animation. */
  staticMode: boolean;
  /** true when this node is the active click-to-filter selection (neutral ring). */
  selected: boolean;
  /** which connection handles this node needs (derived from EDGES). */
  handles: { top: boolean; bottom: boolean; left: boolean; right: boolean };
};

export type PipelineFlowNode = Node<PipelineNodeData, "pipeline">;

const TIER_COLOR: Record<NonNullable<PipelineNodeData["modelTier"]>, string> = {
  frontier: "var(--tier-frontier)",
  open: "var(--tier-open)",
  deterministic: "var(--text-faint)",
};

const TIER_LABEL: Record<NonNullable<PipelineNodeData["modelTier"]>, string> = {
  frontier: "frontier",
  open: "open",
  deterministic: "rules",
};

const HANDLE_STYLE = {
  width: 6,
  height: 6,
  background: "var(--border-strong)",
  border: "none",
} as const;

function PipelineNodeImpl({ data }: NodeProps<PipelineFlowNode>) {
  const { status, flagged, staticMode, handles, selected } = data;
  const waiting = status === "waiting_on_band";

  // resolve the accent that drives border + ring + tone label.
  let accent = "var(--border-default)";
  let toneLabel: { text: string; color: string } | null = null;
  if (waiting) {
    accent = "var(--band-blue)";
    toneLabel = { text: "▓ waiting on Band ▓", color: "var(--band-blue)" };
  } else if (flagged) {
    accent = "var(--verdict-flag)";
    toneLabel = { text: "FLAG", color: "var(--verdict-flag)" };
  } else if (status === "active") {
    accent = "var(--verdict-escalate)";
  } else if (status === "done") {
    accent = data.desk === "rnd" ? "var(--desk-rnd)" : "var(--desk-surv)";
  }

  const dim = status === "idle";
  const lit = status === "active" && !staticMode;

  const baseRing = waiting
    ? undefined // pulse halo via className handles the glow
    : status === "active"
      ? `0 0 0 1px ${accent}, 0 0 20px var(--band-blue-glow)`.replace(
          "var(--band-blue-glow)",
          "rgba(245,158,11,0.28)",
        )
      : flagged
        ? `0 0 0 1px ${accent}, 0 0 18px rgba(239,68,68,0.25)`
        : "none";

  // neutral selection ring (NOT --band-blue, which is SACRED). Layered OUTSIDE
  // any status ring so the click-to-filter selection reads on every state.
  const SELECT_RING = "0 0 0 2px var(--border-strong), 0 0 0 4px var(--bg-inset)";
  const ring = selected
    ? baseRing && baseRing !== "none"
      ? `${SELECT_RING}, ${baseRing}`
      : SELECT_RING
    : baseRing;

  return (
    <div
      className={waiting && !staticMode ? "anim-band-pulse" : undefined}
      style={{
        width: 184,
        boxSizing: "border-box",
        background: waiting ? "rgba(59,130,246,0.10)" : "var(--bg-card)",
        border: `1px solid ${accent}`,
        borderRadius: "var(--r-card)",
        padding: "9px 12px",
        opacity: dim ? 0.5 : 1,
        boxShadow: ring,
        cursor: "pointer",
        transform: lit ? "scale(1.04)" : "scale(1)",
        transition: staticMode
          ? "none"
          : "transform var(--dur-fast) var(--ease-spring), opacity var(--dur-fast) var(--ease-out), border-color 240ms var(--ease-out), box-shadow 240ms var(--ease-out), background 240ms var(--ease-out)",
        color: "var(--text-primary)",
      }}
    >
      {handles.top && (
        <Handle type="target" position={Position.Top} style={HANDLE_STYLE} isConnectable={false} />
      )}
      {handles.left && (
        <Handle
          id="l"
          type="target"
          position={Position.Left}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            letterSpacing: "-0.01em",
            color: waiting ? "var(--band-blue)" : "var(--text-primary)",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {data.label}
        </span>
        {data.modelTier && (
          <span
            title={data.modelTier}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-faint)",
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: TIER_COLOR[data.modelTier],
              }}
            />
            {TIER_LABEL[data.modelTier]}
          </span>
        )}
      </div>

      <div
        style={{
          marginTop: 3,
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: "var(--font-mono)",
          fontSize: 9.5,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: data.desk === "rnd" ? "var(--desk-rnd)" : "var(--desk-surv)" }}>
          {data.desk === "rnd" ? "R&D" : "SURV"}
        </span>
        {toneLabel ? (
          <span style={{ color: toneLabel.color, fontWeight: 600 }}>{toneLabel.text}</span>
        ) : (
          <span style={{ color: "var(--text-faint)" }}>{status}</span>
        )}
      </div>

      {handles.bottom && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
      )}
      {handles.right && (
        <Handle
          id="r"
          type="source"
          position={Position.Right}
          style={HANDLE_STYLE}
          isConnectable={false}
        />
      )}
    </div>
  );
}

export const PipelineNode = memo(PipelineNodeImpl);
