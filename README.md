# Alpha & Oversight

A self-improving market-surveillance system built for the lablab.ai Band of Agents hackathon.

The system runs two AI desks against each other. A red-team Adversary invents order sequences
designed to beat the active rulebook. A blue-team Surveillance desk investigates, debates, and
adjudicates the flow. A small deterministic rule engine — not a language model — renders every
PASS/FLAG verdict. When the Adversary finds an evasion the rules genuinely miss, a human
confirms it, and the system derives a new rule, proves it works, and codifies it. The rulebook
grows by one, the loop resets one level harder, and the cycle continues.

Live deployment:
- Frontend: https://alpha-oversight.vercel.app
- Backend: https://alpha-oversight-backend.onrender.com/stats

---

## Motivation

Markets can be rigged in ways that rules struggle to keep up with. A trader can post orders they
never plan to fill to fake demand, stack fake depth across price levels, trade with themselves to
invent volume, or push the closing print to mark their own book. Regulators write rules against
each pattern — FINRA Rule 5210, SEC Rule 10b-5 — but the rules are fixed while the tactics keep
moving. A small change to a known trick can slip a rule written for last year's version of it.

Two obvious responses both fall short. Writing new rules by hand is slow and always behind.
Letting a language model decide the verdict is worse: the decision becomes a black box a
regulator cannot audit, that an opponent can try to argue around, and that nobody can fully
trust.

This system takes a third path. The verdict stays deterministic and fully auditable. The system
writes its own new rules the moment an old one is beaten. Every flag traces back to a cited
metric and a named regulation. Every handoff between agents is sealed into a hash-chained ledger
a regulator can replay line by line.

---

## Architecture

Two desks, one wall, one rule engine.

```
                    +------------------------------------------+
                    |              R&D DESK                    |
                    |                                          |
                    |   Adversary --------- Backtest Oracle   |
                    |   (red team)          (profit + evade)  |
                    +------------------+--+--------------------+
                                       |
                               SanitizedBridge
                            (strips reasoning +
                             model identity;
                             bare orders only)
                                       |
                    +------------------v---------------------+
                    |           SURVEILLANCE DESK            |
                    |                                        |
                    |  Anomaly Detector                      |
                    |       |                                |
                    |  Investigator --(Band handoff)-->      |
                    |       |          Specialist            |
                    |       |               | (evidence)     |
                    |       +---------------v                |
                    |           Prosecution vs Defense       |
                    |           (local debate, off-Band)     |
                    |                  |                     |
                    |            Adjudicator                 |
                    |                  | (resolved inputs)   |
                    |           +------v------+              |
                    |           | Rule Engine | <-- sole     |
                    |           |  PASS/FLAG  |    verdict   |
                    |           +------+------+   authority  |
                    |                  |                     |
                    |   if PASS + suspicious:                |
                    |           Escalation Manager           |
                    +----------------------------------------+
                                       |
                              human confirm/reject
                                       |
                         derive_rule -> regression_gate
                                       |
                               codify (4 -> 5)
```

The rule engine is not an agent. It is plain Python that walks the active rulebook, runs each
family's math over the order events and resolved inputs, and returns PASS or FLAG. Same inputs
produce the same answer every time.

The SanitizedBridge is the only path from R&D to Surveillance. It copies the raw order events
and strips everything else — the Adversary's reasoning, which model produced the sequence, even
which round it came from. The Surveillance desk judges trades on their own merits. The only
channel in the other direction is the active rulebook, which the red team may read but never
write.

---

## Agents

Eight LLM agents across two desks. The rule engine is listed for completeness but is not an
agent — it is the sole authority on the verdict.

**R&D desk**

- `Adversary` — proposes order sequences engineered to evade every active rule while making
  money. Gated by two deterministic oracles before anything crosses the wall.

**Surveillance desk**

- `Anomaly Detector` — first pass over the order window; computes hard features (cancel ratios,
  book depth, self-match rate) and decides whether to open a case.
- `Investigator` — opens the case and recruits the right Specialist over Band. The only
  tool-using agent in the pipeline (ReAct loop).
- `Specialist` — domain expert for one manipulation family; proposes the contested inputs the
  engine cannot derive on its own (time window, bona-fide order set, likely intent).
- `Prosecution` — argues the reading that makes the order flow look most like manipulation.
- `Defense` — argues the innocent reading. The debate with Prosecution runs locally and never
  touches Band.
- `Adjudicator` — reads both arguments and resolves them into one conservative set of
  engine-ready inputs.
- `Escalation Manager` — when the rulebook misses, packages a clear brief for the human and
  recommends an action.

**Rule Engine** — deterministic Python; sole authority over PASS/FLAG.

**Model assignment.** The four seats on an adversarial boundary each run a distinct model
family so no blind spot in one can quietly pass to the next:

```
Adversary           claude-opus-4-8              Anthropic   (via AI/ML API)
Prosecution         Kimi-K2.7-Code               Moonshot    (Featherless)
Defense             Mistral-Small-3.2-24B         Mistral     (Featherless)
Adjudicator         GLM-5.2                      Zhipu       (Featherless)
Escalation          Qwen3.5-397B-A17B            Qwen        (Featherless)
Triage (x3)         Qwen3-Next-80B-A3B           Qwen        (Featherless)
```

The triage roles (Anomaly Detector, Investigator, Specialist) share one fast open model because
they do not sit on an adversarial pivot. Every model behind a role is pure configuration — an
env var in `providers.py` — so the mix can change without touching pipeline code.

---

## Band — transport of record

Band is not a notification channel. Every cross-agent handoff is a sealed envelope carried over
Band, and every envelope becomes a leaf in the audit ledger. The frontend's verified badge is
recomputed live from real Band message hashes — not read from a stored flag.

Five message kinds travel over Band (wire values are lowercase):

- `handoff` — order-flow events crossing the wall from R&D, or the Investigator recruiting a
  Specialist.
- `evidence` — the Specialist's proposed contested inputs.
- `verdict` — the engine's PASS/FLAG result plus the resolved inputs.
- `escalation` — the human briefing packet when the rulebook misses.
- `rule_codified` — the new rule and its regression proof, emitted when a human confirms.

The Prosecution/Defense debate is the one part of the pipeline that does not ride Band. It runs
locally within the Surveillance desk; only the Adjudicator's resolved output travels onward.

Two implementations share one interface. `MockBand` is an in-process loopback for development
and the keyless demo. `PhoenixBand` is the real Band client: POST to send, GET
`.../messages/next` to pull, ack `processing -> processed`.

---

## Rule engine

The verdict comes from a deterministic engine in `backend/alpha_oversight/rules/`. It walks the
active rulebook; for each rule it runs that family's math over the order events. If any rule
trips, it returns FLAG, the rule id, and the exact metric that crossed the threshold. If none
trip, PASS.

Agents supply the three inputs the engine cannot derive alone:

- **Time window** — which orders belong to the same burst.
- **Bona-fide orders** — which orders were legitimate and should be excluded.
- **Intent** — what the surrounding pattern suggests the trader was doing.

The four seed rules:

```
FINRA-5210-layering   window_ms: 100, min_depth_levels: 3
                      trips when depth_levels >= 3 AND cancel_span_ms <= window_ms

FINRA-5210-spoofing   window_ms: 100, min_cancel_ratio: 0.8
                      trips when near_fill_cancel_ratio >= 0.8

SEC-10b-5-wash        min_self_match_ratio: 0.5
                      trips when self_match_ratio >= 0.5

SEC-10b-5-marking     min_print_move_bps: 100.0
                      trips when eod_print_move_bps >= 100
```

Spoofing trips on `near_fill_cancel_ratio` — cancels placed near opposite-side fills — not the
raw cancel-to-fill ratio.

**Codification (4 -> 5).** When a human confirms a novel evasion:

1. `derive_rule` writes a new parameterized rule from the case. Id: `{family}-v2-{case_id}`;
   provenance `human:compliance/{case_id}`.
2. `regression_gate` replays the evasion through the new rule and verifies it now FLAGs. If the
   proof fails, the rule is rejected (HTTP 422) and nothing is written.
3. The registry grows from four to five and a `rule_codified` Band message is emitted.
4. The case transitions from ESCALATED to FLAGGED.

---

## Case lifecycle

```
OPEN           created; not yet triaged
UNDER_REVIEW   detector flagged it; pipeline is working it
FLAGGED        confirmed manipulation -- directly (Beat A) or after human confirm (Beat B)
ESCALATED      rulebook missed it; waiting on a human
CLOSED         finished: clean, timed out, or dismissed
```

Every non-final state has a timeout that advances the case to CLOSED. Human transitions from
ESCALATED: `confirm` -> FLAGGED (rule written); `reject` -> CLOSED (no rule written).

---

## The two demo beats

**Beat A — catching a known trick.**

Order flow arrives -> Anomaly Detector flags it -> UNDER_REVIEW -> Investigator recruits a
Specialist via Band handoff -> Specialist proposes contested inputs -> Prosecution and Defense
debate locally -> Adjudicator resolves -> engine FLAGs -> verdict Band message -> FLAGGED.
If the detector finds nothing, the case closes immediately.

**Beat B — learning a brand-new trick.**

The R&D loop runs first. The Adversary proposes sequences in bounded rounds. Two deterministic
oracles gate each one: the real rule engine must return PASS (the rules genuinely miss it), and
a backtest must show the sequence makes money and moves price (economically real). Only a
sequence that satisfies both crosses the wall.

The confirmed evasion runs through the Surveillance pipeline. The engine returns PASS — seed
rules miss it — so the case escalates. A human reviews both dossiers and the audit trail and
either confirms (4 -> 5 rules, case flips to FLAGGED) or rejects (case closes, no rule written).

---

## Audit

Every message that crosses Band is sealed into a hash-chained ledger
(`backend/alpha_oversight/audit/ledger.py`). Each leaf records the case id, message kind,
sender, receiver, direction, a SHA-256 fingerprint of the exact content, and the real Band
message id. Each leaf's hash is computed from the previous leaf's hash plus the canonicalized
message body, so altering any byte makes `verify_chain` return false.

The Command Center's audit panel recomputes the chain live on every render. There is no stored
"verified" boolean; the check runs from scratch each time.

---

## Running locally

```bash
# backend (port 8000)
cp .env.example .env
# fill AIML_API_KEY, FEATHERLESS_AI_API_KEY[_2/_3], and the model vars
# leave USE_REAL_BAND=false for MockBand (no Band keys needed)
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt && pip install -e . --no-deps
make run-backend

# frontend (port 4100)
cd frontend
# create .env.local:
#   NEXT_PUBLIC_DATA_MODE=live
#   NEXT_PUBLIC_API_BASE=http://localhost:8000
npm install && npm run dev
```

Open http://localhost:4100/desk, trigger Beat A or Beat B from the controls, and watch the
topology, trace timeline, dossiers, and audit chain update live.

The frontend also runs with no backend. Set `NEXT_PUBLIC_DATA_MODE=mock` (the default) and the
full Beat A / Beat B story plays from bundled fixtures. This is what the public deployment uses.

**Before a live demo.** Featherless evicts idle models after roughly five minutes. Warm them
first, then run the beats back-to-back with no gaps:

```bash
python scripts/warm_models.py
python scripts/live_e2e.py      # Beat A, ~70s warm
python scripts/live_beat_b.py   # Beat B, ~70s warm
```

---

## API

FastAPI on port 8000.

```
GET  /stream                SSE: live trace of every agent action
                            ?desk=rnd|surveillance
                            ?replay=<case_id> for recorded playback

GET  /cases                 list all cases
GET  /cases/{id}            one case in full (state, verdict, features, events, resolved_inputs)
GET  /cases/{id}/audit      ledger rows + freshly recomputed verified flag

GET  /rules                 current active rulebook
GET  /stats                 total_cases, by_state, flagged, escalated, active_rules

POST /cases/{id}/confirm    human confirms escalation -> codify -> FLAGGED
                            409 if not ESCALATED; 422 if regression gate fails
POST /cases/{id}/reject     human dismisses -> CLOSED, no rule written

POST /demo/beat-a           trigger Beat A
POST /demo/beat-b           trigger Beat B
POST /demo/rnd              trigger a live adversary run
```

SSE frame shape:

```jsonc
{
  "agent_name": "Investigator",
  "model_id":   "prosecution-frontier",   // logical key, not the raw provider model name
  "desk":       "surveillance",           // "surveillance" | "rnd"
  "content":    "recruited @layer-spec (layering)",
  "reasoning":  null,
  "tool_calls": [],
  "created_at": "2026-06-18T13:00:00Z"
}
```

Stage markers arrive as `agent_name: "pipeline"` frames. The case id lives only inside `content`;
frames carry no `case_id` field:

```
opened case <case_id>
detector clean -> CLOSED
suspicious -> UNDER_REVIEW; features={...}
recruited <handle> (<family>)
debate complete
verdict=<PASS|FLAG> rule=<rule_id|None>
case <case_id> -> <FINAL_STATE>
```

---

## Repository layout

```
alpha-oversight/
├── backend/
│   └── alpha_oversight/
│       ├── agents/           eight agent roles
│       ├── audit/            hash-chained ledger, canonical JSON
│       ├── band/             MockBand, PhoenixBand, BandHandoff, SanitizedBridge
│       ├── contracts/        Pydantic models: orders, Band envelopes, rules, cases
│       ├── generators/       labeled scenarios, backtest oracle
│       ├── memory/           per-case scratchpad and context store
│       ├── orchestration/    Beat-A choreography, bounded R&D adversary loop
│       ├── providers.py      env-driven model routing (AI/ML API + Featherless)
│       ├── reused/           agent loop, gateway, quant helpers
│       ├── rules/            deterministic engine, per-family math, registry
│       ├── server/           FastAPI app, SSE stream, demo triggers
│       └── state/            case state machine, SQLite store
├── frontend/
│   ├── app/                  Next.js App Router pages (/, /how-it-works, /desk)
│   ├── components/           landing, how-it-works, desk panels
│   └── lib/                  config seam, API client, SSE adapter, zustand store
├── scripts/
│   ├── live_e2e.py           Beat A end-to-end verification
│   ├── live_beat_b.py        Beat B end-to-end verification
│   ├── probe_models.py       verify all six model seats respond
│   └── warm_models.py        pre-warm Featherless models before a demo
├── render.yaml               Render deploy blueprint (backend)
├── pyproject.toml
└── requirements.txt
```

---

## Deployment

Frontend and backend are decoupled by `NEXT_PUBLIC_DATA_MODE`.

**Frontend only (default / public link).** Deploy `frontend/` to Vercel with no env vars. The
demo runs on bundled fixtures — instant, no API keys, no cold-start wait.

**Full live stack.** The backend needs a long-lived host — not a serverless platform — because
`/stream` is a persistent SSE connection. Deploy to Render using the `render.yaml` blueprint in
the repo root. Set the LLM key env vars in the Render dashboard, then point the Vercel frontend
at it: `NEXT_PUBLIC_DATA_MODE=live` and `NEXT_PUBLIC_API_BASE=https://<backend>.onrender.com`.

CORS already allows any `*.vercel.app` origin. For a custom domain, add it to `ALLOWED_ORIGINS`
(comma-separated) in the backend environment. The Render free tier suspends after inactivity,
giving a ~50s cold start on the first request.
