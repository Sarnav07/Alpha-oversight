"use client";

import { motion, useReducedMotion } from "framer-motion";
import Logomark from "@/components/landing/Logomark";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { useDeskController } from "@/lib/desk/controller";
import ConnectionStatus from "./ConnectionStatus";

/**
 * DeskHeader — the live-desk top bar. Angular logomark + wordmark, the
 * ConnectionStatus pill, a ReplayBanner chip (shown only while the stream is
 * replaying recorded JSONL), and DemoControls: scripted beats + reset that drive
 * the DeskController. The header is the operator's cockpit chrome.
 *
 * Optional `onOpenAudit` surfaces the audit drawer toggle from here so the whole
 * desk has a single chrome bar.
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

type DeskHeaderProps = {
  onOpenAudit?: () => void;
};

function ReplayBanner() {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.span
      initial={reduce ? false : { opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: EASE }}
      className="inline-flex items-center gap-1.5 font-mono text-[10px] rounded-[var(--r-chip)] border px-2 py-1"
      style={{
        color: "var(--verdict-escalate)",
        borderColor: "var(--verdict-escalate)",
        background: "#1c1405",
      }}
    >
      <span aria-hidden>⟲</span> REPLAY
    </motion.span>
  );
}

function DemoButton({
  label,
  onClick,
  variant = "default",
}: {
  label: string;
  onClick: () => void;
  variant?: "default" | "ghost";
}) {
  const reduce = useReducedMotion() ?? false;
  return (
    <motion.button
      type="button"
      onClick={onClick}
      whileTap={reduce ? undefined : { scale: 0.95 }}
      transition={{ duration: 0.15, ease: EASE }}
      className="font-mono text-[10px] uppercase tracking-wider rounded-[var(--r-chip)] border px-2.5 py-1.5 transition-colors"
      style={
        variant === "ghost"
          ? {
              borderColor: "var(--border-subtle)",
              color: "var(--text-muted)",
              background: "transparent",
            }
          : {
              borderColor: "var(--border-default)",
              color: "var(--text-body)",
              background: "var(--bg-inset)",
            }
      }
    >
      {label}
    </motion.button>
  );
}

function DemoControls() {
  const controller = useDeskController();
  return (
    <div className="flex items-center gap-1.5">
      <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-faint)] mr-1 hidden md:inline">
        demo
      </span>
      <DemoButton label="Run Beat A" onClick={controller.runBeatA} />
      <DemoButton label="Run Beat B" onClick={controller.runBeatB} />
      <DemoButton label="Run R&D" onClick={controller.runRnD} />
      <DemoButton label="Reset" onClick={controller.resetDesk} variant="ghost" />
    </div>
  );
}

export default function DeskHeader({ onOpenAudit }: DeskHeaderProps) {
  const connection = useTraceStore((s) => s.connection);

  return (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-3 px-6 py-3.5 border-b border-[var(--hairline)] bg-[var(--bg-nav)]">
      <div className="flex items-center gap-2.5 text-[var(--text-primary)]">
        <Logomark size={18} />
        <span className="font-semibold tracking-wide text-[13px]">
          ALPHA &amp; OVERSIGHT
        </span>
        <span className="font-mono text-[10px] text-[var(--text-faint)]">
          · LIVE DESK
        </span>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {connection === "replay" ? <ReplayBanner /> : null}
        <ConnectionStatus state={connection} />
        {onOpenAudit ? (
          <DemoButton label="Audit ▦" onClick={onOpenAudit} variant="ghost" />
        ) : null}
      </div>

      <div className="w-full flex md:w-auto md:ml-2">
        <DemoControls />
      </div>
    </header>
  );
}
