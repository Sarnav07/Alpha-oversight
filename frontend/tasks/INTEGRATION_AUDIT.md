# Frontend ↔ Backend integration audit (2026-06-16)

> ✅ COMPLETED 2026-06-16 (live backend contract verified). Still accurate.

Cross-checked the frontend's backend-integration layer against the **live backend code**
(`alpha-oversight/backend/alpha_oversight/`) and the authoritative `Report_band_agents.pdf`.
Verdict: the contract was ~95% aligned. Endpoints, SSE frame shape, Case/Verdict/Stats/Rule/
Confirm/Reject/Beat/Rnd schemas, BandKind casing (lowercase), agent-name matching, and the
pipeline marker grammar all matched. Two real discrepancies fixed in the frontend; a few
backend-vs-doc nuances flagged (no backend edits, per scope).

## Fixed (frontend)

1. **Case-id attribution in live mode (critical).** `deriveCase` set the id only from
   `e.case_id`, but backend `/stream` frames carry **no `case_id` field** - the id lives only in
   the `content` markers. Added `caseId` parsing to `parseMarker` (from `opened case <id>` and
   `case <id> -> <state>`) and used it as the fallback in `lib/desk/model.ts`. Without this, live
   mode could never attribute events to a case.
   - `lib/eventsource/parseMarker.ts`, `lib/desk/model.ts`

2. **Audit-leaf `direction` value.** Backend emits `"sent"` / `"recv"`; the type + one fixture
   used `"received"`. Aligned the `LedgerEntry.direction` union and the fixture to `"recv"`.
   (Display-only in `AuditDrawer`, so no runtime break - but the type and mock now match reality.)
   - `lib/types.ts`, `lib/fixtures/audit-C-0187.ts`

## Flagged (backend ↔ doc nuances - not changed)

- **Spoofing trip metric** is `near_fill_cancel_ratio ≥ 0.8` in code (`rules/math_spoofing.py`),
  not the raw `cancel_ratio` the older CLAUDE.md prose implied.
- **Wash / marking thresholds are inclusive** (`≥`) in code, not strict (`>`).
- **`model_id` on the stream is a logical key** (`open-triage`, `prosecution-frontier`, …), not
  the raw provider model name the report's example showed. UI tier-badge logic handles it.
- **Band kinds are lowercase** wire values; uppercase forms are display labels only.

## Verified
- `npx tsc --noEmit` clean · `npm run build` exit 0 · no stray `"received"` references.
