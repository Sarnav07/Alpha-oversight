"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { AuditView } from "@/lib/desk/contract";
import type { LedgerEntry } from "@/lib/types";
import { fixtureAuditC0187 } from "@/lib/fixtures/audit-C-0187";

/**
 * AuditDrawer — the compliance system of record. A right slide-over that renders
 * the hash-chained audit ledger (GET /cases/{id}/audit) as mono rows, each
 * link showing prev_hash → hash so the chain reads as a chain. The header badge
 * `verify_chain ✓/✗` reflects `verified` (a fresh server-side verify_chain).
 *
 * Controlled: pass `{open, onClose}`. The audit view defaults to the C-0187
 * fixture (DataLayer has not yet exposed getAuditView() on the controller —
 * TODO: import that once present so the drawer follows the live case).
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
  /** Defaults to the C-0187 fixture until the controller exposes the live view. */
  audit?: AuditView;
};

const short = (h: string) => (h ? `${h.slice(0, 8)}…${h.slice(-4)}` : "∅");

function LedgerRow({ entry, index }: { entry: LedgerEntry; index: number }) {
  return (
    <li className="border-b border-[var(--hairline)] last:border-0 py-3">
      <div className="flex items-center gap-2 text-[12px]">
        <span className="font-mono text-[10px] text-[var(--text-faint)] w-6 shrink-0">
          {String(index).padStart(2, "0")}
        </span>
        <span className="text-[var(--text-primary)] truncate">{entry.agent}</span>
        <span className="font-mono text-[9px] uppercase tracking-wider text-[var(--text-muted)] rounded-[var(--r-chip)] border border-[var(--border-subtle)] px-1.5 py-0.5">
          {entry.role}
        </span>
        {entry.desk ? (
          <span
            className="font-mono text-[9px] ml-auto shrink-0"
            style={{
              color:
                entry.desk === "rnd" ? "var(--desk-rnd)" : "var(--desk-surv)",
            }}
          >
            {entry.desk}
          </span>
        ) : null}
      </div>
      <p className="font-mono text-[10px] text-[var(--text-body)] mt-1.5">
        sha256 {short(entry.content_sha256)}
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
  const view = audit ?? FIXTURE_AUDIT;
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
