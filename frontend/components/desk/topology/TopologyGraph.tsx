/**
 * TopologyGraph - the /desk CENTERPIECE.
 *
 * An @xyflow/react graph of the adversarial trade-surveillance pipeline, driven
 * entirely by `useDeskModel()` (NodeView[] / EdgeView[]). HORIZONTAL flow: R&D
 * desk on the LEFT, a vertical Chinese-wall divider, then the Surveillance spine
 * flowing left→right with the Prosecution ⚔ Defense fan above/below the spine.
 *
 * Load-bearing visual: the Investigator node turns --band-blue with a breathing
 * halo + "▓ waiting on Band ▓" while `model.bandWaiting`, and a blue pulse dot
 * travels the investigator→specialist edge. --band-blue is SACRED = waiting-on-
 * Band ONLY.
 *
 * Reduced motion: a `useReducedMotion()` fallback renders the final/static node
 * and edge states with NO animation (passed down as `staticMode`).
 *
 * Takes NO props - it reads the model itself.
 */
"use client";

import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  ViewportPortal,
  type NodeTypes,
  type EdgeTypes,
} from "@xyflow/react";
import { useReducedMotion } from "framer-motion";
import { useDeskModel } from "@/lib/desk/model";
import type { NodeId } from "@/lib/desk/contract";
import { NODE_POS, WALL, LANES } from "./layout";
import { PipelineNode, type PipelineFlowNode, type NodeHandles } from "./PipelineNode";
import { BandEdge, type BandFlowEdge } from "./BandEdge";

const nodeTypes: NodeTypes = { pipeline: PipelineNode };
const edgeTypes: EdgeTypes = { band: BandEdge };

/**
 * Which handles each node exposes for the HORIZONTAL flow. The spine connects
 * right(source) → left(target); the R&D stack (adversary → bridge) and the
 * human → rule_engine codify feedback use the vertical (bottom/top) handles.
 */
const NODE_HANDLES: Record<NodeId, NodeHandles> = {
  adversary: { tLeft: false, tTop: false, tBottom: false, sRight: false, sBottom: true },
  bridge: { tLeft: false, tTop: true, tBottom: false, sRight: true, sBottom: false },
  anomaly_detector: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  investigator: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  specialist: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  prosecution: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  defense: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  adjudicator: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  rule_engine: { tLeft: true, tTop: false, tBottom: true, sRight: true, sBottom: false },
  escalation_manager: { tLeft: true, tTop: false, tBottom: false, sRight: true, sBottom: false },
  human: { tLeft: true, tTop: false, tBottom: false, sRight: false, sBottom: true },
};

/** Per-edge source/target handle ids (keyed `${from}->${to}`). */
const EDGE_HANDLES: Record<string, { source: string; target: string }> = {
  "adversary->bridge": { source: "s-bottom", target: "t-top" },
  "bridge->anomaly_detector": { source: "s-right", target: "t-left" },
  "anomaly_detector->investigator": { source: "s-right", target: "t-left" },
  "investigator->specialist": { source: "s-right", target: "t-left" },
  "specialist->prosecution": { source: "s-right", target: "t-left" },
  "specialist->defense": { source: "s-right", target: "t-left" },
  "prosecution->adjudicator": { source: "s-right", target: "t-left" },
  "defense->adjudicator": { source: "s-right", target: "t-left" },
  "adjudicator->rule_engine": { source: "s-right", target: "t-left" },
  "rule_engine->escalation_manager": { source: "s-right", target: "t-left" },
  "escalation_manager->human": { source: "s-right", target: "t-left" },
  "human->rule_engine": { source: "s-bottom", target: "t-bottom" },
};

export function TopologyGraph() {
  const model = useDeskModel();
  const reduce = useReducedMotion();
  const staticMode = !!reduce;

  // verdict-flip: the flag accent applies to the node that rendered the FLAG.
  const flaggedNodeId: NodeId | null = useMemo(() => {
    if (model.case.verdict?.result !== "FLAG") return null;
    // the deterministic rule engine renders the authoritative FLAG verdict.
    return "rule_engine";
  }, [model.case.verdict]);

  const nodes = useMemo<PipelineFlowNode[]>(() => {
    return model.nodes.map((n) => ({
      id: n.id,
      type: "pipeline" as const,
      position: NODE_POS[n.id],
      draggable: false,
      selectable: false,
      connectable: false,
      data: {
        nodeId: n.id,
        label: n.label,
        desk: n.desk,
        status: n.status,
        detail: n.detail,
        modelTier: n.modelTier,
        flagged: n.id === flaggedNodeId,
        staticMode,
        selected: false,
        handles: NODE_HANDLES[n.id],
      },
    }));
  }, [model.nodes, flaggedNodeId, staticMode]);

  const edges = useMemo<BandFlowEdge[]>(() => {
    return model.edges.map((e) => {
      const key = `${e.from}->${e.to}`;
      const h = EDGE_HANDLES[key];
      const bandPulse =
        model.bandWaiting && e.from === "investigator" && e.to === "specialist";
      return {
        id: key,
        source: e.from,
        target: e.to,
        type: "band" as const,
        sourceHandle: h?.source ?? null,
        targetHandle: h?.target ?? null,
        data: {
          kind: e.kind,
          active: e.active,
          bandPulse,
          staticMode,
        },
      };
    });
  }, [model.edges, model.bandWaiting, staticMode]);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        minHeight: 350,
        background: "var(--bg-inset)",
        borderRadius: "var(--r-card)",
        border: "1px solid var(--hairline)",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
        fitViewOptions={{ padding: 0.06, minZoom: 0.4, maxZoom: 1.2 }}
        minZoom={0.4}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnScroll={false}
        preventScrolling={false}
        nodeOrigin={[0, 0]}
        defaultEdgeOptions={{ type: "band" }}
        style={{ background: "var(--bg-inset)" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={26}
          size={1}
          color="rgba(20,22,28,0.06)"
        />

        {/* Swimlane panels behind the columns, then the Chinese-wall divider. */}
        <Swimlanes />
        <ChineseWall />
      </ReactFlow>
    </div>
  );
}

/**
 * Swimlane panels - a faint desk-toned frame + eyebrow label behind each column,
 * rendered in flow-space (ViewportPortal) so they pan/zoom with the graph. zIndex
 * -1 keeps them behind the nodes; pointer-events off. Desk tones stay tone-only.
 */
function Swimlanes() {
  return (
    <ViewportPortal>
      {LANES.map((lane) => (
        <div
          key={lane.key}
          style={{
            position: "absolute",
            left: lane.x,
            top: lane.y,
            width: lane.width,
            height: lane.height,
            zIndex: -1,
            pointerEvents: "none",
            borderRadius: 16,
            border: `1px solid color-mix(in srgb, ${lane.tone} 28%, transparent)`,
            background: `color-mix(in srgb, ${lane.tone} 6%, transparent)`,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 8,
              left: 14,
              fontFamily: "var(--font-mono)",
              fontSize: 9,
              letterSpacing: "0.2em",
              textTransform: "uppercase",
              color: `color-mix(in srgb, ${lane.tone} 70%, var(--text-faint))`,
              whiteSpace: "nowrap",
            }}
          >
            {lane.label}
          </span>
        </div>
      ))}
    </ViewportPortal>
  );
}

/**
 * The Chinese-wall divider rendered in flow-space via a ViewportPortal so it
 * pans/zooms with the graph. Pure decoration - no handles, no pointer events.
 */
function ChineseWall() {
  return (
    <ViewportPortal>
      <div
        style={{
          position: "absolute",
          left: WALL.x,
          top: WALL.yTop,
          width: WALL.width,
          height: WALL.height,
          pointerEvents: "none",
          borderLeft: "1px dashed var(--border-default)",
          transform: "translateX(-50%)",
        }}
      >
        <span
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%) rotate(-90deg)",
            transformOrigin: "center",
            whiteSpace: "nowrap",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            letterSpacing: "0.22em",
            textTransform: "uppercase",
            color: "var(--text-faint)",
            background: "var(--bg-inset)",
            padding: "2px 8px",
          }}
        >
          Chinese Wall
        </span>
      </div>
    </ViewportPortal>
  );
}
