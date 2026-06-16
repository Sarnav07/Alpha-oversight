/**
 * Static layout source for the TopologyGraph. Positions are hand-tuned to render
 * the surveillance pipeline as a vertical spine on the RIGHT of the Chinese wall,
 * with the R&D desk (adversary → bridge) stacked on the LEFT. The wall itself is
 * a non-interactive divider node sitting between the two columns.
 *
 * Coordinates are in xyflow flow-space (px). Nodes are 184px wide; the layout is
 * authored against that footprint so handles line up cleanly along the spine.
 */
import type { NodeId } from "@/lib/desk/contract";

export const NODE_W = 184;
export const NODE_H = 64;

/** X anchors for the three lanes. */
const X_RND = 40;
const X_WALL = X_RND + NODE_W + 70; // divider lives in the gutter
const X_SURV = X_WALL + 90;
const X_SURV_PAIR_L = X_SURV - 110; // prosecution (left of spine)
const X_SURV_PAIR_R = X_SURV + 110; // defense (right of spine)

/** Vertical rhythm down the surveillance spine. */
const ROW = 116;
const Y0 = 24;

/** Per-node absolute position (top-left), keyed by NodeId. */
export const NODE_POS: Record<NodeId, { x: number; y: number }> = {
  // R&D desk — left column, top-aligned with the surveillance entry point.
  adversary: { x: X_RND, y: Y0 + ROW * 0.5 },
  bridge: { x: X_RND, y: Y0 + ROW * 1.5 },

  // Surveillance spine — top → bottom.
  anomaly_detector: { x: X_SURV, y: Y0 },
  investigator: { x: X_SURV, y: Y0 + ROW },
  specialist: { x: X_SURV, y: Y0 + ROW * 2 },
  prosecution: { x: X_SURV_PAIR_L, y: Y0 + ROW * 3 },
  defense: { x: X_SURV_PAIR_R, y: Y0 + ROW * 3 },
  adjudicator: { x: X_SURV, y: Y0 + ROW * 4 },
  rule_engine: { x: X_SURV, y: Y0 + ROW * 5 },
  escalation_manager: { x: X_SURV, y: Y0 + ROW * 6 },
  human: { x: X_SURV, y: Y0 + ROW * 7 },
};

/** Geometry for the Chinese-wall divider (a full-height dashed rail). */
export const WALL = {
  x: X_WALL,
  yTop: Y0 - 16,
  height: ROW * 8 + 16,
  width: 2,
};
