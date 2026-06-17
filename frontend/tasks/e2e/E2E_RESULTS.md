# Live end-to-end test — Alpha & Oversight (frontend ↔ backend)

> Current (2026-06-17 live E2E). For the full per-change verification walkthrough see ../VERIFICATION_GUIDE.md.

**Date:** 2026-06-17 · **Verdict: PASS** — the integration works end-to-end from the browser.
All 7 steps green; **0 console errors, 0 page errors, 0 HTTP errors**. Two real live-mode
breakers were found and fixed during the run (below).

## How it was run
- **Backend** `:8077` — `uvicorn alpha_oversight.server.app:create_app --factory --port 8077`
  (port 8000 is occupied by an unrelated "OpenEnv" server, so an alt port + the frontend pointed at
  it; the unknown service was left untouched). Band = in-process **MockBand**; agents = **real LLMs**
  (AIML + Featherless). Runtime data was reset to a clean slate first (old ledger/events/cases backed
  up under `data/_bak_*`) so the audit chain verifies honestly.
- **Frontend** `:4100` — `NEXT_PUBLIC_DATA_MODE=live NEXT_PUBLIC_API_BASE=http://localhost:8077 npm run dev`.
- **Driver:** `tasks/e2e/run-e2e.mjs` (puppeteer-core + cached Chromium) clicks the real UI buttons,
  polls the backend for authoritative state, and screenshots `#live-desk` at each milestone. Re-runnable.

## Scorecard
| # | Step | Result | Evidence |
|---|------|--------|----------|
| 1 | Landing `/` loads | ✓ (preloader "connecting to the band" captured) | `01-landing.png` |
| 2 | `/desk` live SSE connects (4 seed rules) | ✓ | `02-desk-connected.png` |
| 3 | **Run Beat A → FLAGGED** (151s, real pipeline) | ✓ backend `case-2a7fae43` FLAGGED · rule `FINRA-5210-layering`; UI topology + Prosecution⚔Defense dossiers render real LLM output | `03-beatA-flagged.png` |
| 4 | **Run Beat B → ESCALATED** (160s) | ✓ backend `case-fb955a65` ESCALATED; **HITL panel** appears | `04-beatB-escalated.png` |
| 5 | **Confirm → codify rule 4→5** | ✓ POST fired; backend rules **4→5** (`layering-v2-case-fb955a65`); stat bar shows **5 ACTIVE RULES** | `05-codify-4to5.png` |
| 6 | **Audit drawer → verify_chain** | ✓ `verify_chain ✓ = true`, **5 hash-chained leaves** for the case | `06-audit-verified.png` |
| 7 | Run R&D (live adversary) | ✓ ran; no terminal case within 240s — **expected** (non-deterministic search) | `07-rnd-running.png`, `08-rnd-settled.png` |

**Final `/stats`:** `total_cases:2, FLAGGED:2, escalated:0, active_rules:5` — Beat B escalated then
re-flagged after the human confirm codified the 5th rule. The co-evolution loop closed live.

## Real breakers found & fixed (root cause: live `/stream` frames omit `case_id`)
The backend's SSE `ActivityEvent` has no top-level `case_id`; the id lives only inside the `content`
markers (`opened case <id>` / `case <id> -> <state>`). Two components scanned `events[i].case_id`
directly and so got `null` in live mode:

1. **Live Confirm/Reject never fired** — `lib/desk/controller.ts` `currentCaseId()` returned null →
   `POST /cases/{id}/confirm` was skipped → the headline **codify 4→5 was dead in live mode**.
2. **Live audit drawer never fetched** — `components/desk/AuditDrawer.tsx` `useLiveCaseId()` had the
   same scan → `useAudit()` stayed inert → drawer fell back to an empty fixture view (0 leaves).

**Fix:** one shared `latestCaseId(events)` helper in `lib/eventsource/parseMarker.ts` that falls back
to parsing the id from markers (mock path unchanged — fixtures set `case_id`, so the `??` short-circuits).
Both consumers now use it. `npx tsc --noEmit` clean; both behaviors verified live (steps 5 & 6 above).

## Observations (not blockers — fed into FRONTEND_IMPROVEMENTS.md)
- **SSE reconnect per beat:** `startLive` disconnects + reopens the EventSource each run → a benign
  `/stream` request-abort each time (the 3 `failedRequests` in diagnostics). Functionally fine; could
  reuse the connection.
- **Audit drawer doesn't close on Escape** (only scrim/✕). Minor UX.
- **Global ledger is shared by all cases** (`data/ledger/ledger.jsonl`); `verify_chain` runs over the
  whole file. Sequential cases are fine; **concurrent cases can corrupt the chain** — don't fire two
  beats at once (and a per-case ledger or write-lock would harden it). The pre-run `verify_chain=False`
  was accumulated dirty data from prior runs, cleared by the reset.
- **R&D** is non-deterministic and slow (many LLM calls); budget for it in a demo or use Beat A/B.

## Reproduce
```bash
# backend (fresh data optional)
cd alpha-oversight && .venv/bin/uvicorn alpha_oversight.server.app:create_app --factory --port 8077
# frontend (live)
cd alpha-oversight/frontend && NEXT_PUBLIC_DATA_MODE=live NEXT_PUBLIC_API_BASE=http://localhost:8077 npm run dev
# drive it
node alpha-oversight/frontend/tasks/e2e/run-e2e.mjs   # screenshots + e2e.log + diagnostics.json in tasks/e2e/
```
