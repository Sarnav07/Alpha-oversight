/**
 * Static layout source for the TopologyGraph. Positions are hand-tuned to render
 * the pipeline as a HORIZONTAL flow, left → right: the R&D desk (adversary over
 * bridge) on the far left, a vertical Chinese-wall divider, then the Surveillance
 * spine flowing rightward with the Prosecution ⚔ Defense pair fanning above/below
 * the spine into the Adjudicator. `fitView` scales the whole band to fill the
 * ~1470×350 agents panel, so the nodes render large and legible.
 *
 * Coordinates are in xyflow flow-space (px). Authored against a ~158px node.
 */
import type { NodeId } from "@/lib/desk/contract";

export const NODE_W = 158;
export const NODE_H = 70;

/** Horizontal rhythm: one column step along the spine. */
const COL = 196;
/** Surveillance spine vertical centre + the prosecution/defense fan offset. */
const CY = 168;
const FAN = 96;

/** X anchors. R&D shares one column on the far left; the wall sits in the gutter. */
const X_RND = 0;
const X_WALL = X_RND + NODE_W + 38; // vertical divider between the two desks
const X0 = X_WALL + 42; // surveillance spine entry column

/** Per-node absolute position (top-left), keyed by NodeId. Left → right flow. */
export const NODE_POS: Record<NodeId, { x: number; y: number }> = {
  // R&D desk - stacked on the far left (adversary → bridge → cross the wall).
  adversary: { x: X_RND, y: CY - NODE_H - 18 },
  bridge: { x: X_RND, y: CY + 18 },

  // Surveillance spine - left → right.
  anomaly_detector: { x: X0, y: CY - NODE_H / 2 },
  investigator: { x: X0 + COL, y: CY - NODE_H / 2 },
  specialist: { x: X0 + COL * 2, y: CY - NODE_H / 2 },
  // the prosecution ⚔ defense fan (one column, above/below the spine).
  prosecution: { x: X0 + COL * 3, y: CY - FAN - NODE_H / 2 },
  defense: { x: X0 + COL * 3, y: CY + FAN - NODE_H / 2 },
  adjudicator: { x: X0 + COL * 4, y: CY - NODE_H / 2 },
  rule_engine: { x: X0 + COL * 5, y: CY - NODE_H / 2 },
  escalation_manager: { x: X0 + COL * 6, y: CY - NODE_H / 2 },
  human: { x: X0 + COL * 7, y: CY - NODE_H / 2 },
};

/** Right edge of the surveillance spine (used to bound the lane). */
const X_END = X0 + COL * 7 + NODE_W;
const Y_TOP = NODE_POS.prosecution.y - 22;
const Y_BOT = NODE_POS.defense.y + NODE_H + 22;

/** Geometry for the Chinese-wall divider (a full-height dashed vertical rail). */
export const WALL = {
  x: X_WALL,
  yTop: Y_TOP,
  height: Y_BOT - Y_TOP,
  width: 2,
};

/**
 * Swimlane background panels (flow-space) - a faint desk-toned frame + eyebrow
 * label behind each desk, so R&D and Surveillance read as two lanes either side
 * of the Chinese wall. Desk tones are tone-only (D3): a low-opacity border +
 * near-invisible fill, never a loud accent.
 */
export const LANES = [
  {
    key: "rnd" as const,
    label: "R&D Desk · Adversary",
    tone: "var(--desk-rnd)",
    x: X_RND - 16,
    y: Y_TOP,
    width: NODE_W + 32,
    height: Y_BOT - Y_TOP,
  },
  {
    key: "surv" as const,
    label: "Surveillance Desk",
    tone: "var(--desk-surv)",
    x: X0 - 18,
    y: Y_TOP,
    width: X_END - (X0 - 18) + 16,
    height: Y_BOT - Y_TOP,
  },
];
