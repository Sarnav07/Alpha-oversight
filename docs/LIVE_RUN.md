# Live Run (real keys) — Alpha & Oversight

Validated end-to-end on real APIs: all three sponsor stacks (AI/ML API,
Featherless, Band) plus the **whole choreography over real Band**. Run everything
from `alpha-oversight/`.

## 0. Keys (`.env`)
Fill `AIML_API_KEY`, `FEATHERLESS_AI_API_KEY`, and the two Band identities
(`BAND_RND_*`, `BAND_SURV_*`) + `BAND_HUMAN_PEER` + `BAND_SHARED_ROOM`. The model
IDs + URLs below are already set.

> **AI/ML API base is `/v1`** (not `/v2` — litellm's aiml default 404s on chat).

## 1. Models in use
| Role | Logical key | Model | Provider |
|------|-------------|-------|----------|
| Prosecution (frontier reasoning, on camera) | `prosecution-frontier` | `claude-sonnet-4-6` | AI/ML API |
| Escalation (human packet) | `escalation-frontier` | `gpt-5-mini` | AI/ML API |
| Plumbing — anomaly / investigator / specialist / adjudicator | `open-triage` | `Qwen/Qwen3-Next-80B-A3B-Instruct` | Featherless |
| Defense (open-model contrast) | `defense-open` | `Qwen/Qwen3.6-35B-A3B` | Featherless |

`aiml-free` (`gpt-4o-mini`) stays registered as a fast fallback (unused by default).

**Latency:** ~130 s for a full 8-agent case. The two *reasoning* models chosen
— Defense (`Qwen3.6-35B-A3B`) and Escalation (`gpt-5-mini`) — dominate, plus the
80B plumbing across four sequential calls. All endpoints (`/demo/beat-a|b|rnd`)
share this cost. **To trade impressiveness for speed:** swap Defense to
`Qwen/Qwen3-30B-A3B-Instruct-2507` (~1.2 s vs ~8 s) and/or plumbing to the same —
both are non-thinking instruct MoEs. Avoid GLM-4.6 / MiniMax-M2 here: they are
thinking models and would be far slower across the plumbing calls.

Re-verify any model id + latency live: `.venv/bin/python scripts/probe_models.py`.

## 2. Band setup (one-time)
Both agents must share ONE room so cross-desk @mentions route. `BAND_SHARED_ROOM`
is the R&D room with the Surveillance agent added as a participant. Re-add with:
`POST /api/v1/agent/chats/{room}/participants {"participant":{"participant_id":"<surv agent id>"}}`.

Band API constraints discovered live (enforced by `PhoenixBand`):
- a message's `mentions` array must have **≥1** entry, and you **cannot mention
  yourself** (`cannot_mention_self`). So the surveillance desk's *internal*
  sub-agent steps (specialist/prosecution/...) — which aren't separate Band
  identities — are addressed to the **human overseer** (the one participant we may
  always mention without breaching the Chinese wall). A nice side effect: the
  human's Band view shows the whole case unfold.

## 3. Smoke + e2e scripts
```bash
.venv/bin/python scripts/live_smoke.py            # model catalogs + tiny completions
.venv/bin/python scripts/probe_models.py          # the 4 chosen models: latency + JSON + tool-calling
.venv/bin/python scripts/live_band_smoke.py       # REAL Band round-trip; verify_chain over real msg id
.venv/bin/python scripts/live_e2e.py              # Beat-A on real LLMs (MockBand transport) -> FLAGGED
.venv/bin/python scripts/live_realband_e2e.py     # Beat-A: WHOLE choreography over REAL Band -> FLAGGED
.venv/bin/python scripts/live_beat_b.py           # Beat-B (MockBand): novel evasion -> ESCALATE -> 4→5 -> FLAG
.venv/bin/python scripts/live_realband_beat_b.py  # Beat-B over REAL Band: ESCALATE -> codify -> 4→5 -> FLAG
.venv/bin/python scripts/verify_phase7_server.py  # USE_REAL_BAND wires PhoenixBand; /demo/rnd compose
```

## 4. Server with real Band
```bash
USE_REAL_BAND=true make run-backend     # FastAPI builds two PhoenixBand identities on the shared room
curl -XPOST localhost:8000/demo/beat-a  # known layering -> FLAGGED over real Band
curl -XPOST localhost:8000/demo/beat-b  # novel evasion -> ESCALATED (awaiting /cases/{id}/confirm)
curl -XPOST localhost:8000/demo/rnd     # LIVE R&D adversary: oracle-gated; first confirmed evasion -> choreography
```
Default (`USE_REAL_BAND` unset/false) uses MockBand — the safe local default.
`case_id` is decoupled from the Band room, so many cases share the one persistent
shared room without CaseStore collisions.

## 5. What is real vs in-process
- **REAL:** all LLM reasoning (4 models); BOTH desk identities are real
  `PhoenixBand` (REST-poll); the R&D→Surveillance handoff, **every internal desk
  step, and the human escalation are real Band messages** — each handoff ledger
  leaf binds a real `band_message_id` and `verify_chain()` holds; the
  deterministic rule engine + codify/regression gate.
- **In-process:** both desk identities are driven by one Python process — Band is
  the coordination spine / transport-of-record, not a remote agent host. The
  agents are our code; Band carries their messages.

## 6. Security
Keys pasted in chat are exposed in the session transcript — **rotate them** in the
AI/ML, Featherless, and Band dashboards after testing. `.env` is gitignored.
