# Model assignments — capability + family diversity per seat

Why each agent runs the model it runs, and the Featherless/AIML constraints that
shaped the choice. Updated 2026-06-17.

## The matrix

| Seat | Model | Family | Gateway | Why |
|------|-------|--------|---------|-----|
| **Adversary (R&D)** | `claude-opus-4-8` | Anthropic | AIML (paid) | The hardest job — invent evasions that beat the live rulebook. A frontier model, and a family no surveillance seat uses, so the red team shares no blind spots with its own catchers. Low volume (≤3 calls/run), so the paid seat costs cents. |
| **Prosecution** | `moonshotai/Kimi-K2.7-Code` | Moonshot | Featherless | Builds the manipulation case from order-flow evidence — strong reasoning, and a different family from both the defense it argues against and the adversary it is (indirectly) chasing. |
| **Defense** | `deepseek-ai/DeepSeek-V4-Pro` | DeepSeek | Featherless | Argues exoneration. Distinct from prosecution + adjudicator so the courtroom isn't one model talking to itself. |
| **Adjudicator** | `zai-org/GLM-5.2` | Zhipu | Featherless | The load-bearing call — resolves the engine's `window_ms`. A third distinct family judging the Moonshot-vs-DeepSeek debate. |
| Escalation | `Qwen/Qwen3.5-397B-A17B` | Qwen | Featherless | Synthesises the human review packet. Last call in a case (low rate-limit risk). |
| Anomaly · Investigator · Specialist | `Qwen/Qwen3-Next-80B-A3B-Instruct` | Qwen | Featherless | Fast triage MoE (3B active). Non-key seats, deliberately sharing one model to limit model-switching (see below). |
| Rule engine | — (deterministic) | — | — | The **only** authority for PASS/FLAG. No LLM decides the verdict. |

**The four seats that sit on an adversarial boundary — adversary, prosecution,
defense, adjudicator — run four different model families.** That is the whole
point: a manipulation the Anthropic adversary hides should be caught by a Moonshot
prosecutor, weighed against a DeepSeek defender, and adjudicated by a Zhipu model,
none of which share the adversary's failure modes. The triage/specialist seats are
not adversarial pivots, so they share one fast model.

## Featherless economics (the $25 plan), measured

- **Tokens: unlimited, flat-rate.** Calls do not deduct credits. Make as many as
  you like.
- **Concurrency: 4 slots.** A big model claims all four, so in practice one big
  call runs at a time. The pipeline is sequential, so this is never contended in a
  single case — but **don't run two cases at once** (it also corrupts the shared
  ledger).
- **Model switching: max 4 per minute.** This is the real constraint. A case
  switches across ~4 open models; `structured_completion` backs off and retries
  the rate-limit rather than failing the case. Adding *more* distinct open models
  would trip this harder — which is why the non-key seats are consolidated.
- **Cold loads are the latency, not inference.** Featherless loads a model on its
  first use; a cold call to a 753B–1T model takes minutes. **Warm, the same models
  answer in 1–12s** (measured: GLM-5.2 1.4s, DeepSeek-V4-Pro 12s, Qwen 4–8s). So a
  cold first Beat A is ~10 min; every case after is fast.

### Demo runbook (big models on the $25 plan)
Featherless evicts idle models within ~5 min, so warm **immediately** before
demoing and keep cases close together:

```bash
.venv/bin/python scripts/warm_models.py   # ~minutes if cold; do it right before
# then run ONE case at a time (Beat A, let it finish, then Beat B)
```

- **One case at a time.** A case switches ~4 open models = right at the 4/min cap;
  two overlapping cases trip the limit (and corrupt the shared ledger).
- A case still **finalises even if the client disconnects** (`asyncio.shield`), so
  a slow case lands FLAGGED/ESCALATED — the frontend follows it via SSE + polling.
- For back-to-back runs without the rate-limit dance, **upgrade the Featherless
  plan** (more concurrency + switches/min) or pick faster variants per
  `## How to retune`.

## Robustness added alongside the reassignment

- **Rate-limit backoff** (`structured.py`): the agent path now retries Featherless
  `RateLimitError` with backoff (waits the rolling-minute window out) instead of
  failing the case. Permanent errors (400/auth) still fail fast.
- **Per-call ceiling** (`LLM_CALL_TIMEOUT`, code default 600s; `.env` sets 900s to
  clear the worst cold-load): bounds a hung/cold call. A timeout is *not* retried
  (a stuck model won't recover blindly).
- **Adversary temperature = 1.0**: `claude-opus-4-8` is an adaptive-thinking model
  that rejects an explicit `temperature` (and litellm can't auto-drop it on the
  `aiml/` route). 1.0 is its default and also suits a creative red-teamer.

## How to retune

Every seat is an env var (`.env`); no code change needed to swap a model.

| Env | Seat | Notes |
|-----|------|-------|
| `ADVERSARY_MODEL` | adversary | AIML id, e.g. `claude-opus-4-8` / `claude-fable-5`. |
| `FEATHERLESS_PROSECUTION_MODEL` | prosecution | keep a family ≠ defense/adjudicator |
| `FEATHERLESS_DEFENSE_MODEL` | defense | |
| `FEATHERLESS_ADJUDICATOR_MODEL` | adjudicator | the load-bearing seat |
| `FEATHERLESS_ESCALATION_MODEL` | escalation | |
| `FEATHERLESS_OPEN_MODEL` | anomaly + investigator + specialist | one shared triage MoE |
| `LLM_CALL_TIMEOUT` | all | per-call ceiling (seconds) |

To flip a debate seat back to a paid frontier, point `_DEFAULT_MODELS` at the
back-compat `prosecution-frontier` / `escalation-frontier` keys (still registered
from `AIML_FRONTIER_MODEL*`).

**Not used:** MiniMax M3 — not available on Featherless as of 2026-06; it would
need a separate provider gateway. Substituted with DeepSeek/GLM/Kimi.

## Verification

- Hermetic suite green (204 tests, `FakeGateway` + `MockBand`, no network), incl.
  new `test_model_assignments.py` (wiring + 4-distinct-families invariant) and
  `test_structured_retry.py` (rate-limit retry / permanent-error no-retry).
- Live: every model id confirmed against the live Featherless/AIML catalogs; a
  full Beat-A computed the correct `verdict=FLAG (FINRA-5210-layering)` through the
  new pipeline (Kimi → DeepSeek → GLM → Qwen), proving the wiring end to end.
