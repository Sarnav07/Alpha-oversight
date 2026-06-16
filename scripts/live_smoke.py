"""Live provider smoke test — run AFTER putting your keys in ``alpha-oversight/.env``.

What it does (no project imports needed; talks to the providers directly):
  1. Lists the models your AI/ML API + Featherless keys can actually see (catalog).
  2. If AIML_FRONTIER_MODEL / FEATHERLESS_OPEN_MODEL are set, does a tiny real
     completion against each via litellm to confirm the exact id + routing works.

Usage:
    .venv/bin/python scripts/live_smoke.py
"""

from __future__ import annotations

import asyncio
import os

import httpx
from dotenv import load_dotenv

load_dotenv()  # reads alpha-oversight/.env

import litellm  # noqa: E402

litellm.drop_params = True

AIML_KEY = os.environ.get("AIML_API_KEY", "")
AIML_BASE = os.environ.get("AIML_API_BASE", "https://api.aimlapi.com/v2").rstrip("/")
FEATHER_KEY = os.environ.get("FEATHERLESS_AI_API_KEY", "")
FEATHER_BASE = "https://api.featherless.ai/v1"


def list_catalog(base: str, key: str, label: str, pick_hint: tuple[str, ...]) -> list[str]:
    """GET <base>/models (OpenAI-compatible) and print a sample + matches for hints."""
    try:
        r = httpx.get(
            base + "/models",
            headers={"Authorization": f"Bearer {key}"},
            timeout=30.0,
        )
        r.raise_for_status()
        payload = r.json()
        rows = payload.get("data", payload if isinstance(payload, list) else [])
        ids = [str(m.get("id", m)) for m in rows]
        print(f"[{label}] catalog OK — {len(ids)} models visible.")
        hits = [i for i in ids if any(h.lower() in i.lower() for h in pick_hint)]
        if hits:
            print(f"[{label}] candidates matching {pick_hint}:")
            for i in hits[:25]:
                print(f"    {i}")
        else:
            print(f"[{label}] sample ids: {ids[:25]}")
        return ids
    except Exception as e:  # noqa: BLE001
        print(f"[{label}] catalog list FAILED: {type(e).__name__}: {e}")
        return []


async def test_completion(model: str, api_base: str | None, key: str, label: str) -> bool:
    try:
        kw: dict = {
            "model": model,
            "messages": [{"role": "user", "content": "Reply with exactly: OK"}],
            "max_tokens": 16,
            "api_key": key,
        }
        if api_base:
            kw["api_base"] = api_base
        resp = await litellm.acompletion(**kw)
        content = resp.choices[0].message.content
        print(f"[{label}] completion OK — {model!r} -> {content!r}")
        return True
    except Exception as e:  # noqa: BLE001
        print(f"[{label}] completion FAILED for {model!r}: {type(e).__name__}: {e}")
        return False


async def main() -> None:
    print("=" * 60)
    if AIML_KEY:
        list_catalog(AIML_BASE, AIML_KEY, "AIML", ("opus", "claude", "gpt-5", "gpt-4"))
        fm = os.environ.get("AIML_FRONTIER_MODEL", "")
        if fm:
            await test_completion(f"aiml/{fm}", AIML_BASE, AIML_KEY, "AIML.frontier")
        else:
            print("[AIML] AIML_FRONTIER_MODEL not set — pick one from candidates above.")
    else:
        print("[AIML] AIML_API_KEY not set in .env — skipping.")
    print("=" * 60)
    if FEATHER_KEY:
        list_catalog(FEATHER_BASE, FEATHER_KEY, "Featherless", ("deepseek", "qwen", "llama", "mistral"))
        om = os.environ.get("FEATHERLESS_OPEN_MODEL", "")
        if om:
            await test_completion(f"featherless_ai/{om}", None, FEATHER_KEY, "Featherless.open")
        else:
            print("[Featherless] FEATHERLESS_OPEN_MODEL not set — pick one from candidates above.")
    else:
        print("[Featherless] FEATHERLESS_AI_API_KEY not set in .env — skipping.")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())
