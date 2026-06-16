"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AuditView } from "@/lib/desk/contract";
import type { LedgerEntry } from "@/lib/types";
import { fixtureAuditC0187 } from "@/lib/fixtures/audit-C-0187";
import { useAudit } from "@/lib/api/queries";
import { useTraceStore } from "@/lib/store/useTraceStore";
import { IS_MOCK } from "@/lib/config";

/**
 * AuditDrawer — the compliance system of record. A right slide-over that renders
 * the hash-chained audit ledger (GET /cases/{id}/audit) as mono rows. Each row is
 * a Band-handoff leaf: `from → to`, a `kind` badge, the `direction`, and the
 * sha256 / prev_hash → hash links so the chain reads as a chain. The header badge
 * `verify_chain ✓/✗` reflects `verified` (a fresh server-side verify_chain).
 *
 * Controlled: pass `{open, onClose}`. In LIVE mode the drawer follows the active
 * case via useAudit(<live case id from the trace store>); in MOCK mode it uses the
 * `audit` prop the page derives from getAuditView() (C-0187 fixture).
 */

const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number];

const FIXTURE_AUDIT: AuditView = {
  caseId: fixtureAuditC0187.case_id,
  entries: fixtureAuditC0187.entries,
  verified: fixtureAuditC0187.verified,
};

type AuditDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** MOCK source — the C-0187 fixture view the page passes in. */
  audit?: AuditView;
};

const short = (h: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "∅");

/** Live case id from the trace store — the latest frame carrying a case_id. */
function useLiveCaseId(): string | null {
  return useTraceStore((s) => {
    for (let i = s.events.length - 1; i >= 0; i--) {
      if (s.events[i].case_id) return s.events[i].case_id!;
    }
    return null;
  });
}

function LedgerRow({ entry, index }: { entry: LedgerEntry; index: number }) {
  return (
    <li className="border-b border-[var(--hairline)] last:border-0 py-3">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-[var(--text-primary)] truncate">
          {entry.from}
          <span aria-hidden className="text-[var(--text-muted)] px-1">
            →
          </span>
          {entry.to}
        </span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)] rounded-[var(--r-chip)] border border-[var(--border-subtle)] px-1.5 py-0.5">
          {entry.kind}
        </span>
        <span className="font-mono text-[9px] ml-auto shrink-0 text-[var(--text-faint)]">
          {entry.direction}
        </span>
      </div>
      <p className="font-mono text-[10px] text-[var(--text-body)] mt-1.5">
        sha256 {short(entry.sha256)}
      </p>
      <p className="font-mono text-[10px] mt-1 flex items-center gap-1.5 text-[var(--text-faint)]">
        <span>{short(entry.prev_hash)}</span>
        <span aria-hidden className="text-[var(--text-muted)]">
          →
        </span>
        <span className="text-[var(--text-muted)]">{short(entry.hash)}</span>
      </p>
    </li>
  );
}

export default function AuditDrawer({ open, onClose, audit }: AuditDrawerProps) {
  const reduce = useReducedMotion() ?? false;

  // LIVE: follow the active case via GET /cases/{id}/audit. MOCK: use the prop /
  // fixture. useAudit is gated on caseId, so it stays inert (no fetch) in mock.
  const liveCaseId = useLiveCaseId();
  const liveAudit = useAudit(IS_MOCK ? null : liveCaseId);

  let view: AuditView;
  if (!IS_MOCK && liveAudit.data) {
    view = {
      caseId: liveAudit.data.case_id,
      entries: liveAudit.data.entries,
      verified: liveAudit.data.verified,
    };
  } else {
    view = audit ?? FIXTURE_AUDIT;
  }
  const verified = view.verified;

  return (
    <AnimatePresence>
      {open ? (
        <>
          <motion.div
            key="audit-scrim"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2, ease: EASE }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/55"
            aria-hidden
          />
          <motion.aside
            key="audit-panel"
            role="dialog"
            aria-label="Case audit — hash chain"
            initial={reduce ? false : { x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ duration: 0.32, ease: EASE }}
            className="fixed top-0 right-0 z-50 h-full w-full max-w-[440px] border-l border-[var(--border-default)] bg-[var(--bg-card)] flex flex-col"
          >
            <header className="flex items-center justify-between gap-3 px-5 py-4 border-b border-[var(--border-subtle)]">
              <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-[0.18em] text-[var(--text-muted)]">
                  Audit ledger
                </p>
                <p className="font-mono text-[11px] text-[var(--text-faint)] mt-0.5 truncate">
                  {view.caseId ?? "no case"} · {view.entries.length} leaves
                </p>
              </div>
              <span
                className="font-mono text-[11px] rounded-[var(--r-chip)] border px-2 py-1 shrink-0"
                style={{
                  color: verified
                    ? "var(--verdict-complete)"
                    : "var(--verdict-flag)",
                  borderColor: verified
                    ? "var(--verdict-complete)"
                    : "var(--verdict-flag)",
                }}
              >
                verify_chain {verified ? "✓" : "✗"}
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close audit drawer"
                className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] text-lg leading-none px-1 transition-colors"
              >
                ✕
              </button>
            </header>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {view.entries.length === 0 ? (
                <p className="text-[12px] text-[var(--text-muted)] py-8 text-center">
                  no audit entries yet.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {view.entries.map((entry, i) => (
                    <LedgerRow
                      key={`${entry.hash}-${i}`}
                      entry={entry}
                      index={i}
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="px-5 py-3 border-t border-[var(--border-subtle)]">
              <p className="font-mono text-[10px] text-[var(--text-faint)]">
                append-only · hash = sha256(prev_hash + canonical_json(body))
              </p>
            </footer>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
