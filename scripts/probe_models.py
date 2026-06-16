"""Throwaway model probe — verify the user-requested model IDs actually complete,
measure latency, confirm JSON output, and check Featherless tool-calling support
(the Investigator role runs a ReAct tool loop). Run:

    .venv/bin/python scripts/probe_models.py
"""
from __future__ import annotations
import os, sys, time, asyncio

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend"))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

import litellm
litellm.drop_params = True  # silently drop unsupported params (gpt-5 temperature, etc.)

AIML = os.environ["AIML_API_KEY"]
FEAT = os.environ["FEATHERLESS_AI_API_KEY"]
AIML_BASE = "https://api.aimlapi.com/v1"

# (label, litellm_model, api_base, api_key)
TARGETS = [
    ("PROSECUTION  claude-sonnet-4-6", "aiml/claude-sonnet-4-6", AIML_BASE, AIML),
    ("ESCALATION   gpt-5-mini",        "aiml/gpt-5-mini",        AIML_BASE, AIML),
    ("DEFENSE      Qwen3.6-35B-A3B",   "featherless_ai/Qwen/Qwen3.6-35B-A3B", None, FEAT),
    ("PLUMBING-A   Qwen3-Next-80B-A3B","featherless_ai/Qwen/Qwen3-Next-80B-A3B-Instruct", None, FEAT),
    ("PLUMBING-B   Qwen3-30B-A3B-2507","featherless_ai/Qwen/Qwen3-30B-A3B-Instruct-2507", None, FEAT),
]

PROMPT = [
    {"role": "system", "content": "Reply with ONLY a compact JSON object, no prose."},
    {"role": "user", "content": 'Return {"ok": true, "n": 7} exactly.'},
]


async def one(label, model, base, key, *, effort=None):
    kw = {"model": model, "messages": PROMPT, "api_key": key, "max_tokens": 256}
    if base:
        kw["api_base"] = base
    if effort:
        kw["reasoning_effort"] = effort
    t0 = time.monotonic()
    try:
        r = await litellm.acompletion(**kw)
        dt = time.monotonic() - t0
        txt = (r.choices[0].message.content or "").strip().replace("\n", " ")
        print(f"  {label:34s} {dt:6.2f}s  OK  {txt[:70]}")
        return dt
    except Exception as e:
        dt = time.monotonic() - t0
        print(f"  {label:34s} {dt:6.2f}s  ERR {type(e).__name__}: {str(e)[:110]}")
        return None


async def tool_check(model, key):
    """Does Featherless pass through OpenAI tools for this model? (Investigator path.)"""
    tools = [{
        "type": "function",
        "function": {
            "name": "list_peers",
            "description": "List specialist peers.",
            "parameters": {"type": "object", "properties": {}},
        },
    }]
    try:
        r = await litellm.acompletion(
            model=model, api_key=key, max_tokens=256,
            messages=[{"role": "user", "content": "Call list_peers to see who is available."}],
            tools=tools, tool_choice="auto",
        )
        tc = r.choices[0].message.tool_calls
        print(f"  tool-calling   {model.split('/')[-1]:28s} {'EMITTED tool_call' if tc else 'no tool_call (advisory-ok)'}")
    except Exception as e:
        print(f"  tool-calling   {model.split('/')[-1]:28s} ERR {type(e).__name__}: {str(e)[:90]}")


async def main():
    print("=== completion + latency (tiny JSON) ===")
    for label, model, base, key in TARGETS:
        await one(label, model, base, key)
    print("\n=== gpt-5-mini with reasoning_effort=minimal (faster escalation?) ===")
    await one("ESCALATION   gpt-5-mini/min", "aiml/gpt-5-mini", AIML_BASE, AIML, effort="minimal")
    print("\n=== Featherless tool-calling passthrough (Investigator) ===")
    await tool_check("featherless_ai/Qwen/Qwen3-Next-80B-A3B-Instruct", FEAT)
    await tool_check("featherless_ai/Qwen/Qwen3-30B-A3B-Instruct-2507", FEAT)


if __name__ == "__main__":
    asyncio.run(main())
