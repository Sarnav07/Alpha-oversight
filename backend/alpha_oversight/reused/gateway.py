# LIFTED FROM trader-arena/arena/llm/gateway.py:1 — import path fixed; api_base merge is a Phase-1B TODO.
"""LLM Gateway — unified interface to model providers via litellm.

Handles:
- Multi-provider routing (OpenAI, Anthropic, Google)
- JSON response extraction + Pydantic validation
- Retry with exponential backoff
- Cost tracking per model
- Multi-turn tool calling
"""

import asyncio
import json
import logging
import re
import time
from pathlib import Path
from typing import Any, Callable

import litellm

from alpha_oversight.contracts.common import ModelSpec

logger = logging.getLogger(__name__)

# ── Token counting ──
try:
    import tiktoken
    _ENCODER = tiktoken.get_encoding("cl100k_base")
except Exception:
    _ENCODER = None


def _count_tokens(text: str) -> int:
    if _ENCODER:
        return len(_ENCODER.encode(text))
    return len(text) // 4  # fallback approximation

# Suppress litellm's verbose logging
litellm.suppress_debug_info = True

# ── Model Registry (persistent via JSON file) ──

_DEFAULT_MODELS: dict[str, dict] = {
    # ── Season 1 Models (8 active) ──
    "deepseek-v3.2": {
        "key": "deepseek-v3.2", "display_name": "DeepSeek V3.2", "provider": "DeepSeek",
        "litellm_model": "openrouter/deepseek/deepseek-v3.2", "max_tokens": 16384, "temperature": 0.0,
    },
    "gemini-3.1-pro": {
        "key": "gemini-3.1-pro", "display_name": "Gemini 3.1 Pro", "provider": "Google",
        "litellm_model": "openrouter/google/gemini-3.1-pro-preview", "max_tokens": 16384, "temperature": 0.0,
    },
    "grk-4.20": {
        "key": "grk-4.20", "display_name": "Grok 4.20", "provider": "xAI",
        "litellm_model": "openrouter/x-ai/grok-4.20", "max_tokens": 16384, "temperature": 0.0,
    },
    "gpt-5.4-mini": {
        "key": "gpt-5.4-mini", "display_name": "GPT-5.4 Mini", "provider": "OpenAI",
        "litellm_model": "openrouter/openai/gpt-5.4-mini", "max_tokens": 16384, "temperature": 0.0,
    },
    "gpt-5.4": {
        "key": "gpt-5.4", "display_name": "GPT 5.4", "provider": "OpenAI",
        "litellm_model": "openrouter/openai/gpt-5.4", "max_tokens": 16384, "temperature": 0.0,
    },
    "z-ai-glm-5": {
        "key": "z-ai-glm-5", "display_name": "GLM-5", "provider": "Z.ai",
        "litellm_model": "openrouter/z-ai/glm-5", "max_tokens": 16384, "temperature": 0.0,
    },
    "minimax-m2.7": {
        "key": "minimax-m2.7", "display_name": "MiniMax M2.7", "provider": "MiniMax",
        "litellm_model": "openrouter/minimax/minimax-m2.7", "max_tokens": 16384, "temperature": 0.0,
    },
    "claude-opus-4.6": {
        "key": "claude-opus-4.6", "display_name": "Claude Opus 4.6", "provider": "Anthropic",
        "litellm_model": "openrouter/anthropic/claude-opus-4.6", "max_tokens": 16384, "temperature": 0.0,
    },
    "kimi-k2.5": {
        "key": "kimi-k2.5", "display_name": "Kimi K2.5", "provider": "Moonshot AI",
        "litellm_model": "openrouter/moonshotai/kimi-k2.5", "max_tokens": 16384, "temperature": 0.0,
    },
    # ── Legacy models (backward compat with existing season data) ──
    "claude-sonnet": {
        "key": "claude-sonnet", "display_name": "Claude Sonnet 4.6", "provider": "Anthropic",
        "litellm_model": "openrouter/anthropic/claude-sonnet-4-6", "max_tokens": 16384, "temperature": 0.0,
    },
    "gpt-4o": {
        "key": "gpt-4o", "display_name": "GPT-4o", "provider": "OpenAI",
        "litellm_model": "openrouter/openai/gpt-4o", "max_tokens": 16384, "temperature": 0.0,
    },
    "gemini-2.5-pro": {
        "key": "gemini-2.5-pro", "display_name": "Gemini 2.5 Pro", "provider": "Google",
        "litellm_model": "openrouter/google/gemini-2.5-pro-preview-05-06", "max_tokens": 16384, "temperature": 0.0,
    },
    "deepseek-v3": {
        "key": "deepseek-v3", "display_name": "DeepSeek V3", "provider": "DeepSeek",
        "litellm_model": "openrouter/deepseek/deepseek-chat-v3-0324", "max_tokens": 16384, "temperature": 0.0,
    },
}

_MODELS_FILE = Path(__file__).resolve().parents[3] / "data" / "models.json"


def _load_models() -> dict[str, ModelSpec]:
    """Load models from persistent JSON file, falling back to defaults."""
    models: dict[str, ModelSpec] = {}

    # Load defaults first
    for key, cfg in _DEFAULT_MODELS.items():
        models[key] = ModelSpec(**cfg)

    # Overlay persisted models
    if _MODELS_FILE.exists():
        try:
            import json
            with open(_MODELS_FILE) as f:
                saved = json.load(f)
            for key, cfg in saved.items():
                models[key] = ModelSpec(**cfg)
            logger.info(f"Loaded {len(saved)} custom models from {_MODELS_FILE}")
        except Exception as e:
            logger.warning(f"Failed to load models file: {e}")

    return models


def save_models() -> None:
    """Persist current MODELS registry to JSON file."""
    import json
    # Only save non-default models (custom additions)
    custom = {}
    for key, spec in MODELS.items():
        if key not in _DEFAULT_MODELS:
            custom[key] = {
                "key": spec.key, "display_name": spec.display_name, "provider": spec.provider,
                "litellm_model": spec.litellm_model, "max_tokens": spec.max_tokens,
                "temperature": spec.temperature,
            }
    # Also save defaults that were modified
    for key, spec in MODELS.items():
        if key in _DEFAULT_MODELS:
            default = _DEFAULT_MODELS[key]
            if spec.litellm_model != default["litellm_model"] or spec.display_name != default["display_name"]:
                custom[key] = {
                    "key": spec.key, "display_name": spec.display_name, "provider": spec.provider,
                    "litellm_model": spec.litellm_model, "max_tokens": spec.max_tokens,
                    "temperature": spec.temperature,
                }

    _MODELS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(_MODELS_FILE, "w") as f:
        json.dump(custom, f, indent=2)
    logger.info(f"Saved {len(custom)} custom models to {_MODELS_FILE}")


MODELS: dict[str, ModelSpec] = _load_models()


class LLMGateway:
    """Unified LLM interface with cost tracking and retry logic."""

    def __init__(self):
        self.cost_tracker: dict[str, dict] = {}  # {model_key: {calls, input_tokens, output_tokens, cost_usd}}

    async def call(
        self,
        model_key: str,
        system_prompt: str,
        user_prompt: str,
        max_retries: int = 3,
    ) -> dict[str, Any]:
        """Call an LLM and return parsed result.

        Returns:
            {
                "parsed": dict | None,  # Parsed JSON from response
                "raw_text": str,        # Raw response text
                "input_tokens": int,
                "output_tokens": int,
                "cost_usd": float,
                "latency_ms": int,
                "parse_success": bool,
            }
        """
        model_spec = MODELS.get(model_key)
        if not model_spec:
            raise ValueError(f"Unknown model: {model_key}. Available: {list(MODELS.keys())}")

        # Token budget check
        MAX_INPUT_TOKENS = 120_000
        estimated = _count_tokens(system_prompt) + _count_tokens(user_prompt)
        if estimated > MAX_INPUT_TOKENS:
            logger.warning(f"Prompt for {model_key} estimated at {estimated} tokens (limit {MAX_INPUT_TOKENS})")

        last_error = None

        # Build messages with prompt caching for supported providers
        sys_msg: dict[str, Any] = {"role": "system", "content": system_prompt}
        user_msg: dict[str, Any] = {"role": "user", "content": user_prompt}
        if self._supports_cache_control(model_spec.litellm_model):
            sys_msg["cache_control"] = {"type": "ephemeral"}
        messages = [sys_msg, user_msg]

        for attempt in range(max_retries):
            try:
                start = time.monotonic()

                # TODO(Phase-1B): merge providers.resolve_call_kwargs(model_spec) here
                #   (api_base + api_key per provider) and wrap Featherless calls in
                #   `async with providers.FEATHERLESS_SEMAPHORE:`. Today routes via OpenRouter only.
                response = await litellm.acompletion(
                    model=model_spec.litellm_model,
                    messages=messages,
                    max_tokens=model_spec.max_tokens,
                    temperature=model_spec.temperature,
                    response_format={"type": "json_object"},
                )

                latency_ms = int((time.monotonic() - start) * 1000)
                raw_text = response.choices[0].message.content or ""
                usage = response.usage
                input_tokens = usage.prompt_tokens if usage else 0
                output_tokens = usage.completion_tokens if usage else 0

                # Estimate cost
                cost_usd = self._estimate_cost(model_key, input_tokens, output_tokens)

                # Track
                self._track(model_key, input_tokens, output_tokens, cost_usd)

                # Parse JSON
                parsed = self._extract_json(raw_text)

                # Per spec Section 9.4: if response parsed but is None,
                # retry with clarifying re-prompt (not just blind retry)
                if parsed is None and attempt < max_retries - 1:
                    logger.warning(f"Parse failed (attempt {attempt + 1}), sending clarifying re-prompt")
                    messages = [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt},
                        {"role": "assistant", "content": raw_text},
                        {"role": "user", "content": (
                            "Your response wasn't valid JSON. Please respond ONLY with the JSON object "
                            "in the exact schema specified. No markdown, no text outside JSON."
                        )},
                    ]
                    continue

                return {
                    "parsed": parsed,
                    "raw_text": raw_text,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "cost_usd": cost_usd,
                    "latency_ms": latency_ms,
                    "parse_success": parsed is not None,
                }

            except Exception as e:
                import random
                last_error = e
                err_str = str(e)
                is_rate_limit = "429" in err_str or "rate" in err_str.lower() or "too many" in err_str.lower()
                is_unavailable = "503" in err_str or "overloaded" in err_str.lower()
                if is_rate_limit:
                    wait = 30 * (2 ** attempt) + random.uniform(0, 5)
                elif is_unavailable:
                    wait = 5 * (2 ** attempt) + random.uniform(0, 2)
                else:
                    wait = 2 ** attempt + random.uniform(0, 1)
                logger.warning(f"LLM call failed (attempt {attempt + 1}/{max_retries}): {e}. Retrying in {wait:.1f}s...")
                if attempt < max_retries - 1:
                    await asyncio.sleep(wait)

        logger.error(f"LLM call failed after {max_retries} attempts: {last_error}")
        return {
            "parsed": None,
            "raw_text": str(last_error),
            "input_tokens": 0,
            "output_tokens": 0,
            "cost_usd": 0.0,
            "latency_ms": 0,
            "parse_success": False,
        }

    async def call_with_tools(
        self,
        model_key: str,
        system_prompt: str,
        user_prompt: str,
        tools: list[dict],
        tool_executor: Callable,
        max_rounds: int = 3,
    ) -> dict[str, Any]:
        """Multi-turn conversation with tool calling.

        Sends messages + tool definitions to the LLM. If the response contains
        tool_calls, executes each tool, appends results, and re-sends until
        the LLM produces a final text response (no more tool calls) or
        max_rounds is reached.

        Args:
            model_key: Key into MODELS registry.
            system_prompt: System message.
            user_prompt: User message.
            tools: List of litellm-compatible tool definitions.
            tool_executor: async fn(name, args, context) -> str. Called for each tool.
            max_rounds: Max tool-calling rounds before forcing a final answer.

        Returns:
            Same dict as call() plus:
            - "tool_calls": list of {name, args, result, latency_ms}
            - "rounds": number of tool-calling rounds used
        """
        model_spec = MODELS.get(model_key)
        if not model_spec:
            raise ValueError(f"Unknown model: {model_key}. Available: {list(MODELS.keys())}")

        # Token budget check
        MAX_INPUT_TOKENS = 120_000
        estimated = _count_tokens(system_prompt) + _count_tokens(user_prompt)
        if estimated > MAX_INPUT_TOKENS:
            logger.warning(f"Prompt for {model_key} estimated at {estimated} tokens (limit {MAX_INPUT_TOKENS})")

        # Build messages with prompt caching for supported providers
        sys_msg_tools: dict[str, Any] = {"role": "system", "content": system_prompt}
        user_msg_tools: dict[str, Any] = {"role": "user", "content": user_prompt}
        if self._supports_cache_control(model_spec.litellm_model):
            sys_msg_tools["cache_control"] = {"type": "ephemeral"}
        messages = [sys_msg_tools, user_msg_tools]

        all_tool_calls: list[dict] = []
        total_input_tokens = 0
        total_output_tokens = 0
        total_cost = 0.0
        start_time = time.monotonic()
        rounds_used = 0

        for round_idx in range(max_rounds + 1):  # +1 for final answer round
            try:
                # Build completion kwargs
                completion_kwargs: dict[str, Any] = {
                    "model": model_spec.litellm_model,
                    "messages": messages,
                    "max_tokens": model_spec.max_tokens,
                    "temperature": model_spec.temperature,
                }

                # Only pass tools if we haven't exhausted rounds
                if tools and round_idx < max_rounds:
                    completion_kwargs["tools"] = tools
                    completion_kwargs["tool_choice"] = "auto"
                else:
                    # Final round — force text response, request JSON
                    completion_kwargs["response_format"] = {"type": "json_object"}

                # TODO(Phase-1B): completion_kwargs.update(providers.resolve_call_kwargs(model_spec))
                #   + Featherless semaphore wrap (see providers.py).
                response = await litellm.acompletion(**completion_kwargs)

                usage = response.usage
                input_tokens = usage.prompt_tokens if usage else 0
                output_tokens = usage.completion_tokens if usage else 0
                total_input_tokens += input_tokens
                total_output_tokens += output_tokens
                cost = self._estimate_cost(model_key, input_tokens, output_tokens)
                total_cost += cost

                message = response.choices[0].message

                # Check for native OpenAI tool_calls first
                tool_calls_in_response = getattr(message, "tool_calls", None)

                # Fallback: Parse XML-style tool calls from MiniMax/GLM/etc.
                if not tool_calls_in_response and message.content:
                    xml_tool_calls = self._extract_xml_tool_calls(message.content)
                    if xml_tool_calls:
                        tool_calls_in_response = xml_tool_calls

                if tool_calls_in_response and round_idx < max_rounds:
                    rounds_used += 1
                    # Append assistant message with tool_calls
                    # For XML tool calls, synthesize a native-format assistant message
                    if hasattr(message, "tool_calls") and message.tool_calls:
                        messages.append(message.model_dump())
                    else:
                        # XML tool call case — build synthetic assistant message
                        synthetic_tc = [
                            {
                                "id": tc.id,
                                "type": "function",
                                "function": {
                                    "name": tc.function.name,
                                    "arguments": tc.function.arguments,
                                },
                            }
                            for tc in tool_calls_in_response
                        ]
                        messages.append({
                            "role": "assistant",
                            "content": None,
                            "tool_calls": synthetic_tc,
                        })

                    # Execute each tool call
                    for tc in tool_calls_in_response:
                        fn_name = tc.function.name
                        try:
                            fn_args = json.loads(tc.function.arguments)
                        except json.JSONDecodeError:
                            fn_args = {}

                        tc_start = time.monotonic()
                        try:
                            result = await tool_executor(fn_name, fn_args)
                        except Exception as e:
                            result = f"Tool error: {e}"
                        tc_latency = int((time.monotonic() - tc_start) * 1000)

                        all_tool_calls.append({
                            "name": fn_name,
                            "args": fn_args,
                            "result": result[:2000],  # Cap result size
                            "latency_ms": tc_latency,
                        })

                        # Append tool result to conversation
                        messages.append({
                            "role": "tool",
                            "tool_call_id": tc.id,
                            "content": result[:2000],
                        })

                    logger.info(
                        f"Tool round {rounds_used}/{max_rounds}: "
                        f"{len(tool_calls_in_response)} tools called "
                        f"({', '.join(tc.function.name for tc in tool_calls_in_response)})"
                    )
                    continue  # Go to next round

                # No tool calls — this is the final answer
                raw_text = message.content or ""
                parsed = self._extract_json(raw_text)

                # RESILIENCE: If final answer is empty/unparseable, do one more
                # forced JSON round. Handles Claude Opus empty after tools, models
                # that return markdown/XML, or first-shot failures.
                if parsed is None:
                    logger.warning(
                        f"[{model_key}] Empty/unparseable final answer "
                        f"(rounds={rounds_used}, round_idx={round_idx}, raw_len={len(raw_text)}). "
                        f"Forcing JSON-only round."
                    )
                    try:
                        # Build a CLEAN conversation: system + original user + short recap + explicit ask
                        # This avoids confusion from lengthy tool result history
                        tool_results_summary = "\n".join(
                            f"- {tc['name']}: {str(tc.get('result', ''))[:200]}"
                            for tc in all_tool_calls[-10:]
                        )
                        clean_messages = [
                            {"role": "system", "content": system_prompt},
                            {"role": "user", "content": user_prompt},
                            {
                                "role": "assistant",
                                "content": f"I have completed my research using tools:\n{tool_results_summary}\n\nNow I will provide my final trading decision.",
                            },
                            {
                                "role": "user",
                                "content": (
                                    "Provide your FINAL trading decision as a SINGLE JSON object now. "
                                    "Required schema:\n"
                                    '{"actions": [{"symbol": "TICKER", "side": "BUY|SELL", "quantity": 100, '
                                    '"order_type": "MARKET|LIMIT", "limit_price": null, "reasoning": "why"}], '
                                    '"portfolio_reasoning": "overall logic", "risk_notes": "risks"}\n\n'
                                    "Return ONLY the JSON. No markdown, no explanation outside JSON. "
                                    "Empty actions array is valid if no trades."
                                ),
                            },
                        ]
                        # TODO(Phase-1B): merge providers.resolve_call_kwargs(model_spec) + Featherless semaphore.
                        forced_resp = await litellm.acompletion(
                            model=model_spec.litellm_model,
                            messages=clean_messages,
                            max_tokens=model_spec.max_tokens,
                            temperature=model_spec.temperature,
                            response_format={"type": "json_object"},
                        )
                        if forced_resp.usage:
                            total_input_tokens += forced_resp.usage.prompt_tokens
                            total_output_tokens += forced_resp.usage.completion_tokens
                            total_cost += self._estimate_cost(
                                model_key,
                                forced_resp.usage.prompt_tokens,
                                forced_resp.usage.completion_tokens,
                            )
                        raw_text = forced_resp.choices[0].message.content or ""
                        parsed = self._extract_json(raw_text)
                        if parsed:
                            logger.info(f"[{model_key}] Forced JSON round succeeded.")
                        else:
                            logger.error(
                                f"[{model_key}] Forced JSON round returned empty/unparseable: "
                                f"raw_len={len(raw_text)}, preview={raw_text[:200]}"
                            )
                    except Exception as force_err:
                        logger.error(f"[{model_key}] Forced JSON round also failed: {force_err}")

                total_latency = int((time.monotonic() - start_time) * 1000)
                self._track(model_key, total_input_tokens, total_output_tokens, total_cost)

                return {
                    "parsed": parsed,
                    "raw_text": raw_text,
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cost_usd": total_cost,
                    "latency_ms": total_latency,
                    "parse_success": parsed is not None,
                    "tool_calls": all_tool_calls,
                    "rounds": rounds_used,
                }

            except Exception as e:
                import random
                err_str = str(e)
                # Detect transient errors and use longer backoff with jitter
                is_rate_limit = "429" in err_str or "rate" in err_str.lower() or "too many" in err_str.lower()
                is_unavailable = "503" in err_str or "overloaded" in err_str.lower()
                if is_rate_limit:
                    wait = 30 * (2 ** round_idx) + random.uniform(0, 5)
                elif is_unavailable:
                    wait = 5 * (2 ** round_idx) + random.uniform(0, 2)
                else:
                    wait = 2 ** round_idx + random.uniform(0, 1)
                logger.warning(f"Tool-calling round {round_idx} failed: {e}. Backing off {wait:.1f}s")
                if round_idx < max_rounds:
                    await asyncio.sleep(wait)
                    continue

                # All rounds failed
                total_latency = int((time.monotonic() - start_time) * 1000)
                self._track(model_key, total_input_tokens, total_output_tokens, total_cost)
                return {
                    "parsed": None,
                    "raw_text": str(e),
                    "input_tokens": total_input_tokens,
                    "output_tokens": total_output_tokens,
                    "cost_usd": total_cost,
                    "latency_ms": total_latency,
                    "parse_success": False,
                    "tool_calls": all_tool_calls,
                    "rounds": rounds_used,
                }

        # Shouldn't reach here, but safety fallback
        total_latency = int((time.monotonic() - start_time) * 1000)
        self._track(model_key, total_input_tokens, total_output_tokens, total_cost)
        return {
            "parsed": None,
            "raw_text": "Max tool-calling rounds exhausted without final answer.",
            "input_tokens": total_input_tokens,
            "output_tokens": total_output_tokens,
            "cost_usd": total_cost,
            "latency_ms": total_latency,
            "parse_success": False,
            "tool_calls": all_tool_calls,
            "rounds": rounds_used,
        }

    @staticmethod
    def _extract_xml_tool_calls(content: str) -> list | None:
        """Parse XML-style tool calls used by MiniMax/GLM/other non-OpenAI models.

        Formats supported:
          <minimax:tool_call>...<invoke name="X"><parameter name="Y">Z</parameter>...</invoke>...</minimax:tool_call>
          <glm:tool_call>...</glm:tool_call>
          <tool_call>...</tool_call>

        Returns list of SimpleNamespace objects matching OpenAI tool_calls interface,
        or None if no XML tool calls found.
        """
        from types import SimpleNamespace

        if not content or "<" not in content:
            return None

        # Match any wrapper like <foo:tool_call> or <tool_call>
        wrapper_pattern = r'<(?:[a-z]+:)?tool_call>(.*?)</(?:[a-z]+:)?tool_call>'
        blocks = re.findall(wrapper_pattern, content, re.DOTALL | re.IGNORECASE)
        if not blocks:
            return None

        tool_calls = []
        for i, block in enumerate(blocks):
            invoke_match = re.search(
                r'<invoke name="([^"]+)">(.*?)</invoke>', block, re.DOTALL
            )
            if not invoke_match:
                continue
            fn_name = invoke_match.group(1)
            params_block = invoke_match.group(2)

            params: dict = {}
            for p in re.finditer(
                r'<parameter name="([^"]+)">(.*?)</parameter>',
                params_block,
                re.DOTALL,
            ):
                key = p.group(1)
                val = p.group(2).strip()
                # Try to parse JSON (for lists/objects/numbers/booleans)
                try:
                    params[key] = json.loads(val)
                except (json.JSONDecodeError, ValueError):
                    params[key] = val

            tool_calls.append(
                SimpleNamespace(
                    id=f"xml_tc_{i}",
                    type="function",
                    function=SimpleNamespace(
                        name=fn_name,
                        arguments=json.dumps(params),
                    ),
                )
            )

        return tool_calls if tool_calls else None

    def _extract_json(self, text: str) -> dict | None:
        """Extract JSON from LLM response. Handles markdown code blocks."""
        text = text.strip()

        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # Try extracting from ```json ... ``` blocks
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            try:
                return json.loads(match.group(1).strip())
            except json.JSONDecodeError:
                pass

        # Try finding first { ... } block
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass

        logger.warning(f"Failed to parse JSON from response: {text[:200]}...")
        return None

    @staticmethod
    def _supports_cache_control(litellm_model: str) -> bool:
        """Check if the model provider supports prompt caching (cache_control)."""
        return any(
            provider in litellm_model
            for provider in ("anthropic/", "google/", "deepseek/")
        )

    def _estimate_cost(self, model_key: str, input_tokens: int, output_tokens: int) -> float:
        """Rough cost estimate per model. Prices per 1M tokens, approximate Q1 2026."""
        prices = {
            # Season 1 models
            "claude-opus-4.6":   {"input": 15.00, "output": 75.00},  # Anthropic premium tier
            "gemini-3.1-pro":    {"input": 1.25,  "output": 5.00},
            "grk-4.20":          {"input": 5.00,  "output": 15.00},  # xAI Grok
            "gpt-5.4":           {"input": 2.50,  "output": 10.00},
            "z-ai-glm-5":        {"input": 0.50,  "output": 2.00},   # GLM-5 Turbo
            "minimax-m2.7":      {"input": 0.60,  "output": 2.40},
            "deepseek-v3.2":     {"input": 0.27,  "output": 1.10},
            "kimi-k2.5":         {"input": 0.60,  "output": 2.50},
            # Legacy models
            "gpt-5.4-mini":      {"input": 1.50,  "output": 6.00},
            "gpt-4o":            {"input": 2.50,  "output": 10.00},
            "claude-sonnet":     {"input": 3.00,  "output": 15.00},
            "gemini-2.5-pro":    {"input": 1.25,  "output": 10.00},
            "deepseek-v3":       {"input": 0.27,  "output": 1.10},
        }
        p = prices.get(model_key, {"input": 5.0, "output": 15.0})
        return (input_tokens * p["input"] + output_tokens * p["output"]) / 1_000_000

    def _track(self, model_key: str, input_tokens: int, output_tokens: int, cost_usd: float):
        if model_key not in self.cost_tracker:
            self.cost_tracker[model_key] = {"calls": 0, "input_tokens": 0, "output_tokens": 0, "cost_usd": 0.0}
        t = self.cost_tracker[model_key]
        t["calls"] += 1
        t["input_tokens"] += input_tokens
        t["output_tokens"] += output_tokens
        t["cost_usd"] += cost_usd

    def get_cost_report(self) -> dict[str, dict]:
        """Return accumulated cost per model."""
        return self.cost_tracker.copy()
