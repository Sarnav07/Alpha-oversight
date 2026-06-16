# Backend integration — shared reference (live wiring)

Ground truth from a fresh backend recon (2026-06-16). The backend was updated; this
supersedes CONTEXT.md §3/§7 where they differ. **Goal:** make `NEXT_PUBLIC_DATA_MODE=live`
work end-to-end against the FastAPI server, one case at a time, swap-proof with mock.

## Backend facts
- Run: `cd alpha-oversight && make run-backend` → uvicorn `:8000`. LLM keys ARE in its
  `.env` (AIML/FEATHERLESS/BAND_*), so `/demo/*` + live `/stream` work. Recorded replays
  exist at `data/events/events-<case_id>.jsonl` (e.g. `events-case-57191e5e.jsonl`, a full
  case) → keyless `?replay=<case_id>` verification.
- **CORS: DONE by lead** — `CORSMiddleware` allows `http://(localhost|127.0.0.1):<port>`.
  So the frontend can hit REST + EventSource directly at `API_BASE=http://localhost:8000`.
- **`ActivityEvent` has NO `case_id`, NO `stage`** (7 fields only). One case at a time stays.

## Real REST contract (field names verbatim)
- `GET /stats` → `{ total_cases, by_state:{<UPPERCASE_STATE>:n}, flagged, escalated, active_rules }` — COUNTS ONLY (narrative tiles 847/72%/41.2h stay hard-coded).
- `GET /rules` → `Rule[]` = `{ id, family(lowercase: spoofing|layering|wash_trade|marking), params, provenance, status:"ACTIVE" }`.
- `GET /cases` / `GET /cases/{id}` → `Case` = `{ case_id, room_id, state, features, verdict, events[], resolved_inputs, created_at, updated_at }`. `events` empty until terminal. `features` gains a `family` key at FLAGGED/ESCALATED. 404 → `{detail}`.
- `GET /cases/{id}/audit` → `{ case_id, entries: LedgerEntry[], verified }`. **`entries` are Band-handoff leaves ONLY**: `{ band_message_id, bmid, case_id, direction:"sent"|"received", from, to, kind, sha256, prev_hash, hash }` (agent-step leaves have no case_id → filtered out).
- `POST /cases/{id}/confirm` → `{ case, codified:true, regression_passed:true, rule:{id:"layering-v2-…", family, params, provenance:"human:…", status:"ACTIVE"} }`. Errors 404/409/422.
- `POST /cases/{id}/reject` → **`{ case, codified:false }`** (CHANGED — was bare Case). Read `.case`.
- `POST /demo/beat-a|beat-b` → `{ case_id, state, verdict }` (beat-b → state ESCALATED, verdict null).
- `POST /demo/rnd` → NOW BUILT, union: fail `{ confirmed:false, rounds, note }` | ok `{ confirmed:true, rounds, params, case_id, state, verdict }`.

(All mirrored in `lib/types.ts` — reconciled by lead: `Case`, `LedgerEntry`, `RejectResponse`,
`RndResponse`, `BeatResponse`, `Features.family?`.)

## Real SSE `/stream` markers (parseMarker inputs)
Frame = `data: <ActivityEvent json>\n\n`; heartbeat `: keep-alive\n\n` (EventSource ignores `:` natively). `agent_name:"pipeline"` (desk surveillance, model_id "") carries these EXACT strings:
```
opened case <case_id>
detector clean -> CLOSED
suspicious -> UNDER_REVIEW; features={'cancel_to_fill': 0.0, 'depth_levels': 4, 'self_match_ratio': 0.0, 'eod_print_spike': False}
recruited <handle> (<family>)
debate complete
verdict=<PASS|FLAG> rule=<rule_id|None>
case <case_id> -> <FINAL_STATE>
```
**GOTCHA:** the `features={...}` is Python `repr` (`True`/`False`, single quotes) — NOT JSON. Parse per-key with regex, never `JSON.parse`.
Replay frames add `replay_ts`. Band-handoff events: `agent_name` = sender (`investigator`, `@layer-spec`, `adjudicator`, `escalation`), content = `@mention + json`.
**Agent-name casing:** real agents emit CLASS NAMES — `AnomalyDetector, Investigator, Specialist, Prosecution, Defense, Adjudicator, EscalationManager` — while Band-handoff/pipeline use lowercase (`investigator`, `@layer-spec`, `pipeline`). `nodeIdForAgent` must map BOTH.

## Frozen `lib/api/queries.ts` public API (RestLive implements, DeskLive consumes)
```ts
export const qk = { stats:["stats"], rules:["rules"], cases:["cases"], audit:(id:string)=>["audit",id] };
export function useStats(): UseQueryResult<Stats>;
export function useRules(): UseQueryResult<Rule[]>;
export function useCases(): UseQueryResult<Case[]>;
export function useAudit(caseId: string | null): UseQueryResult<AuditResponse>;
export function useInvalidateOnMarkers(): void; // mount once in /desk; watches trace store, invalidates stats/rules/cases on verdict|escalate|codify|"-> FINAL" markers
```

## Verification (2026-06-16 — DONE, against the LIVE backend)
Built by a 3-teammate team (RestLive / SseLive / DeskLive) against the frozen contracts above.
- `npx tsc --noEmit` exit 0 · `npm run build` exit 0 (4 routes).
- Backend run on :8010 (ours, with the new CORS) and verified:
  - **CORS** → `access-control-allow-origin: http://localhost:4100` on `GET /stats` with that Origin ✓
  - `GET /stats` → `{total_cases,by_state{UPPER},flagged,escalated,active_rules}` ✓ matches `Stats`
  - `GET /rules[0]` → `FINRA-5210-layering`, family lowercase, status `"ACTIVE"` ✓ matches `Rule`
  - `GET /cases/{id}` keys = case_id/room_id/state/verdict/features/resolved_inputs/events/created_at/updated_at ✓ matches `Case`
  - `GET /cases/{id}/audit` entry keys = band_message_id/bmid/case_id/direction/from/to/kind/sha256/prev_hash/hash ✓ matches new `LedgerEntry`
  - `GET /stream?replay=case-57191e5e` (keyless) emits the REAL markers `opened case …`, `suspicious -> UNDER_REVIEW; features={py-repr}` ✓ handled by the new parseMarker
- `useInvalidateOnMarkers()` mounted in `app/desk/page.tsx`; live mount opens `/stream` and waits (no LLM run on load); mock mount keeps the auto Beat-B demo.

### ⚠️ Environment notes for going live
- **Port 8000 is occupied by a DIFFERENT backend** (`/app/env`, `server.app:app`) that 404s our routes. To run live, free :8000 and `cd alpha-oversight && make run-backend` (our app, port 8000, now CORS-enabled), OR point `NEXT_PUBLIC_API_BASE` at wherever our backend runs.
- **NEXT_PUBLIC_* are build-time inlined.** To serve a live PROD build, build with `NEXT_PUBLIC_DATA_MODE=live`. `next dev` reads env at start, so `NEXT_PUBLIC_DATA_MODE=live NEXT_PUBLIC_API_BASE=http://localhost:8000 npm run dev` works for live testing.
- Browser-only (can't verify headless): the live topology lighting from real SSE, React-Query stats/rules refetch, and the codify 4→5 on a live Confirm. Run a live Beat B (keys present) and watch.

## Keep stable (so parallel teammates don't break each other)
- `parseMarker` returns the SAME `Marker.stage` union values (anomaly|recruit|waiting_on_band|propose|debate|verdict|escalate|codify) — only fix the regexes to the real strings above.
- `nodeIdForAgent`, `NODE_META`, `EDGES` keep their signatures.
- `DeskModel` / `DeskController` contracts (lib/desk/contract.ts) DO NOT change.
