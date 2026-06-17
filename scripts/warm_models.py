"""Pre-warm the live models so demo cases run at WARM latency.

Featherless loads big open models on-demand: a COLD first call can take minutes
(GLM-5.2 / DeepSeek-V4-Pro / Kimi-K2.7), which makes the very first Beat A ~10 min
and can trip a client timeout mid-case. WARM, the same models answer in 1–12s.
This fires one tiny call to each pipeline model so the cold-load happens ONCE, up
front. Run it (from the repo root, so .env loads) after starting the backend and
before demoing; re-run if Featherless evicts an idle model.

    .venv/bin/python scripts/warm_models.py
"""

from __future__ import annotations

import asyncio
import time

from alpha_oversight import providers
from alpha_oversight.orchestration.surveillance_pipeline import (
    ADVERSARY_MODEL_KEY,
    _DEFAULT_MODELS,
)
from alpha_oversight.reused import gateway as gw


async def _warm(key: str) -> None:
    spec = gw.MODELS.get(key)
    if spec is None:
        print(f"  {key:18s} (not registered — skipped)", flush=True)
        return
    t = time.monotonic()
    try:
        await asyncio.wait_for(
            gw._acompletion(
                spec,
                messages=[{"role": "user", "content": "Reply with one word: OK"}],
                max_tokens=16, timeout=600,
            ),
            timeout=620,
        )
        print(f"  {key:18s} {spec.litellm_model:44s} warm in {time.monotonic()-t:6.1f}s", flush=True)
    except Exception as e:  # tolerate one failure (e.g. a transient switch-limit)
        print(f"  {key:18s} {spec.litellm_model:44s} FAILED {type(e).__name__}: {str(e)[:80]}", flush=True)


async def main() -> None:
    providers.register_models()
    # de-dup while preserving order; the adversary (AIML) is included for parity.
    keys = list(dict.fromkeys([*_DEFAULT_MODELS.values(), ADVERSARY_MODEL_KEY]))
    print(f"warming {len(keys)} models (a cold load can take minutes each)…", flush=True)
    for i, key in enumerate(keys):
        await _warm(key)
        if i < len(keys) - 1:
            await asyncio.sleep(15)  # stay under Featherless's 4 model-switches/minute
    print("done — models warm; run the demo now.", flush=True)


if __name__ == "__main__":
    asyncio.run(main())
