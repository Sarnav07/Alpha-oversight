/**
 * TopologyGraph - the /desk CENTERPIECE.
 *
 * An @xyflow/react graph of the adversarial trade-surveillance pipeline, driven
 * entirely by `useDeskModel()` (NodeView[] / EdgeView[]). R&D desk on the LEFT,
 * a Chinese-wall divider, Surveillance desk flowing top→bottom on the RIGHT.
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
import { useDeskUIStore } from "@/lib/desk/uiStore";
import type { NodeId } from "@/lib/desk/contract";
import { NODE_POS, WALL, LANES } from "./layout";
import { PipelineNode, type PipelineFlowNode } from "./PipelineNode";
import { BandEdge, type BandFlowEdge } from "./BandEdge";

const nodeTypes: NodeTypes = { pipeline: PipelineNode };
const edgeTypes: EdgeTypes = { band: BandEdge };

/**
 * Which side handles each node exposes, derived from the cross-wall geometry:
 * the only horizontal hop is bridge(right) → anomaly_detector(left). Everything
 * else flows vertically (bottom→top), including the prosecution/defense fan.
 */
const NEEDS_RIGHT = new Set<NodeId>(["bridge"]);
const NEEDS_LEFT = new Set<NodeId>(["anomaly_detector"]);
/** the cross-wall edge uses side handles instead of top/bottom. */
const SIDE_EDGE = (from: NodeId, to: NodeId) => from === "bridge" && to === "anomaly_detector";

export function TopologyGraph() {
  const model = useDeskModel();
  const reduce = useReducedMotion();
  const staticMode = !!reduce;

  // click-to-filter: the selected node id + toggle action (lib/desk/uiStore).
  const nodeFilter = useDeskUIStore((s) => s.nodeFilter);
  const toggleNodeFilter = useDeskUIStore((s) => s.toggleNodeFilter);

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
        selected: n.id === nodeFilter,
        handles: {
          top: true,
          bottom: true,
          left: NEEDS_LEFT.has(n.id),
          right: NEEDS_RIGHT.has(n.id),
        },
      },
    }));
  }, [model.nodes, flaggedNodeId, staticMode, nodeFilter]);

  const edges = useMemo<BandFlowEdge[]>(() => {
    return model.edges.map((e) => {
      const side = SIDE_EDGE(e.from, e.to);
      const bandPulse =
        model.bandWaiting && e.from === "investigator" && e.to === "specialist";
      return {
        id: `${e.from}->${e.to}`,
        source: e.from,
        target: e.to,
        type: "band" as const,
        sourceHandle: side ? "r" : null,
        targetHandle: side ? "l" : null,
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
        minHeight: 560,
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
        fitViewOptions={{ padding: 0.14, minZoom: 0.4, maxZoom: 1.1 }}
        minZoom={0.4}
        maxZoom={1.4}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        onNodeClick={(_, node) => toggleNodeFilter(node.id as NodeId)}
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
          color="rgba(255,255,255,0.045)"
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
