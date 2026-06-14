# LIFTED FROM trader-arena/arena/agent/loop.py:1 — import path fixed; api_base merge is a Phase-1B TODO.
"""ReAct Agent Loop — the core harness for Alpha Arena.

Custom implementation inspired by prediction-arena. No framework dependency.
Manages: message history, tool dispatch, iteration limits, action persistence,
reasoning capture, token/cost tracking.

Usage:
    registry = ToolRegistry()
    registry.register(bash_tool_def, bash_executor)
    ...
    agent = AgentLoop(model_key="gpt-5.4-mini", system_prompt=SYSTEM, tool_registry=registry)
    result = await agent.run_turn(user_prompt)
    # result.queued_orders, result.parsed, result.actions, result.total_cost_usd
"""

import json
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Any

import litellm

litellm.drop_params = True  # Gracefully ignore unsupported params per provider

from alpha_oversight.reused.gateway import MODELS

logger = logging.getLogger(__name__)

# Cost per 1M tokens (March 2026 rates via OpenRouter)
_COST_TABLE: dict[str, tuple[float, float]] = {
    # Season 1 models
    "deepseek-v3.2":   (0.27, 1.10),
    "gemini-3.1-pro":  (1.25, 10.00),
    "grk-4.20":        (3.00, 15.00),
    "gpt-5.4-mini":    (1.50, 6.00),
    "z-ai-glm-5":      (1.00, 4.00),
    "minimax-m2.7":    (0.50, 2.00),
    "claude-opus-4.6": (15.00, 75.00),
    "kimi-k2.5":       (0.60, 2.40),
    # Legacy
    "claude-sonnet":   (3.00, 15.00),
    "gpt-4o":          (2.50, 10.00),
    "gemini-2.5-pro":  (1.25, 10.00),
    "deepseek-v3":     (0.27, 1.10),
}

@dataclass
class AgentAction:
    """One turn in the agent trace — persisted to DB."""

    turn_number: int
    role: str  # "user", "assistant", "tool"
    tool_name: str | None = None
    tool_call_id: str | None = None
    input_json: str | None = None
    output_json: str | None = None
    content: str | None = None
    reasoning: str | None = None
    token_usage_prompt: int | None = None
    token_usage_completion: int | None = None
    cost_usd: float = 0.0
    cache_creation_tokens: int = 0
    cache_read_tokens: int = 0


@dataclass
class AgentResult:
    """Result from a complete agent turn."""

    parsed: dict | None = None
    raw_text: str = ""
    actions: list[AgentAction] = field(default_factory=list)
    queued_orders: list = field(default_factory=list)  # list[EquityOrder | CryptoOrder]
    iterations: int = 0
    total_input_tokens: int = 0
    total_output_tokens: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: int = 0
    # Cache metrics
    total_cache_creation_tokens: int = 0
    total_cache_read_tokens: int = 0
    cache_savings_usd: float = 0.0

    def to_llm_data(self) -> dict:
        """Convert to dict for LLMCall DB persistence."""
        return {
            "input_tokens": self.total_input_tokens,
            "output_tokens": self.total_output_tokens,
            "cost_usd": self.total_cost_usd,
            "latency_ms": self.total_latency_ms,
            "prompt_text": "",  # Full trace in agent_actions table instead
            "response_raw": self.raw_text,
            "parse_success": self.parsed is not None,
            "agent_iterations": self.iterations,
            "agent_actions_count": len(self.actions),
            "cache_creation_tokens": self.total_cache_creation_tokens,
            "cache_read_tokens": self.total_cache_read_tokens,
            "cache_savings_usd": round(self.cache_savings_usd, 4),
        }


class AgentLoop:
    """ReAct agent loop with tool calling and Docker sandbox support.

    Max 15 iterations per turn. Last iteration strips tools to force final JSON.
    16th bonus iteration granted if trade rejected on iteration 15.
    Every turn persisted as AgentAction for admin trace visibility.
    """

    def __init__(
        self,
        model_key: str,
        system_prompt: str,
        tool_registry: "ToolRegistry",
        max_iterations: int = 20,
        on_action: Any = None,  # async callback(AgentAction) for DB persistence
    ) -> None:
        self._model_key = model_key
        self._model_spec = MODELS.get(model_key)
        if not self._model_spec:
            raise ValueError(f"Unknown model: {model_key}")
        self._system_prompt = system_prompt
        self._tools = tool_registry
        self._max_iterations = max_iterations
        self._on_action = on_action

        # Prompt caching: supported by Claude, Gemini, DeepSeek via OpenRouter
        model_id = self._model_spec.litellm_model.lower()
        self._supports_cache = any(
            p in model_id for p in ("anthropic/", "google/", "deepseek/")
        )

        # Accumulators
        self._total_input_tokens = 0
        self._total_output_tokens = 0
        self._total_cost_usd = 0.0
        self._total_latency_ms = 0
        self._total_cache_creation_tokens = 0
        self._total_cache_read_tokens = 0
        self._total_cache_savings_usd = 0.0

    async def run_turn(self, user_prompt: str) -> AgentResult:
        """Execute the full ReAct loop. Returns parsed result + trace."""
        if self._supports_cache:
            # Prompt caching: system prompt + user briefing cached across iterations
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": [
                    {"type": "text", "text": self._system_prompt, "cache_control": {"type": "ephemeral"}},
                ]},
                {"role": "user", "content": [
                    {"type": "text", "text": user_prompt, "cache_control": {"type": "ephemeral"}},
                ]},
            ]
        else:
            messages: list[dict[str, Any]] = [
                {"role": "system", "content": self._system_prompt},
                {"role": "user", "content": user_prompt},
            ]
        actions: list[AgentAction] = []

        # Log user prompt as first action
        user_action = AgentAction(turn_number=0, role="user", content=user_prompt[:5000])
        actions.append(user_action)
        await self._emit_action(user_action)

        effective_max = self._max_iterations
        for iteration in range(effective_max + 1):  # +1 allows bonus iteration
            if iteration >= effective_max:
                break  # Normal exit; bonus iteration adjusts effective_max below

            # On last iteration, strip tools to force final JSON response
            is_last = iteration == effective_max - 1
            tool_defs = self._tools.definitions() if not is_last and self._tools.has_tools() else None

            # Context management: prune old tool results if messages are too large
            # Keep system + user (first 2) intact, truncate tool outputs in middle
            total_chars = sum(len(str(m.get("content", ""))) for m in messages)
            if total_chars > 200_000 and len(messages) > 10:
                # Truncate tool results older than last 6 messages to 500 chars each
                for i in range(2, len(messages) - 6):
                    if messages[i].get("role") == "tool":
                        content = str(messages[i].get("content", ""))
                        if len(content) > 500:
                            messages[i]["content"] = content[:500] + "\n... [truncated for context]"
                logger.info(f"[{self._model_key}] Context pruned: {total_chars:,} chars → {sum(len(str(m.get('content', ''))) for m in messages):,} chars")

            # Call LLM
            start_ms = int(time.time() * 1000)
            try:
                completion_kwargs: dict[str, Any] = {
                    "model": self._model_spec.litellm_model,
                    "messages": messages,
                    "temperature": self._model_spec.temperature,
                    "max_tokens": self._model_spec.max_tokens,
                }

                # Enable thinking/reasoning mode for supported models
                model_id = self._model_spec.litellm_model.lower()
                if "claude-opus" in model_id or "claude-sonnet" in model_id:
                    # Anthropic extended thinking
                    completion_kwargs["extra_headers"] = {"anthropic-beta": "interleaved-thinking-2025-05-14"}
                    completion_kwargs["thinking"] = {"type": "enabled", "budget_tokens": 8000}
                elif "gemini" in model_id:
                    # Google thinking mode
                    completion_kwargs["thinking"] = {"type": "enabled", "budget_tokens": 8000}
                # Note: Grok reasoning_effort not supported via OpenRouter — skip

                if tool_defs:
                    completion_kwargs["tools"] = tool_defs
                    completion_kwargs["tool_choice"] = "auto"
                else:
                    # Final round — request JSON
                    completion_kwargs["response_format"] = {"type": "json_object"}

                # TODO(Phase-1B): completion_kwargs.update(providers.resolve_call_kwargs(self._model_spec))
                #   + Featherless semaphore wrap (see providers.py).
                response = await litellm.acompletion(**completion_kwargs)
            except Exception as e:
                logger.error(f"[{self._model_key}] LLM call failed at iteration {iteration + 1}: {e}")
                error_action = AgentAction(
                    turn_number=iteration + 1, role="assistant",
                    content=f"LLM call failed: {e}",
                )
                actions.append(error_action)
                await self._emit_action(error_action)
                break

            latency = int(time.time() * 1000) - start_ms
            self._total_latency_ms += latency

            # Track tokens + cache metrics
            msg = response.choices[0].message
            usage = response.usage
            prompt_tokens = getattr(usage, "prompt_tokens", 0) or 0
            completion_tokens = getattr(usage, "completion_tokens", 0) or 0
            cache_creation = getattr(usage, "cache_creation_input_tokens", 0) or 0
            cache_read = getattr(usage, "cache_read_input_tokens", 0) or 0
            self._total_input_tokens += prompt_tokens
            self._total_output_tokens += completion_tokens
            self._total_cache_creation_tokens += cache_creation
            self._total_cache_read_tokens += cache_read

            # Cost: use OpenRouter's actual reported cost (most accurate)
            # Falls back to litellm's cost, then our estimate
            cost = self._get_actual_cost(response, prompt_tokens, completion_tokens)
            self._total_cost_usd += cost

            if cache_read > 0 or cache_creation > 0:
                logger.info(
                    f"[{self._model_key}] iter {iteration + 1}: "
                    f"cache_write={cache_creation:,} cache_read={cache_read:,} "
                    f"cost=${cost:.5f}"
                )

            # Capture reasoning tokens (DeepSeek, o3, etc)
            reasoning = (
                getattr(msg, "reasoning_content", None)
                or getattr(msg, "thinking", None)
            )

            # Log assistant action
            assistant_action = AgentAction(
                turn_number=iteration + 1,
                role="assistant",
                content=getattr(msg, "content", None) or "",
                reasoning=reasoning,
                token_usage_prompt=prompt_tokens,
                token_usage_completion=completion_tokens,
                cost_usd=cost,
                cache_creation_tokens=cache_creation,
                cache_read_tokens=cache_read,
            )
            actions.append(assistant_action)
            await self._emit_action(assistant_action)

            # Check for tool calls
            tool_calls = getattr(msg, "tool_calls", None)
            if not tool_calls:
                # No tool calls → the model thinks it's done. We need:
                # (a) a non-empty response_raw (some models put their answer in
                #     `reasoning_content` / `thinking` and leave `content`
                #     empty — that would silently drop the trading decision);
                # (b) parseable JSON.
                # Empty `actions: []` is a valid choice (pass on the session).
                # If parse fails AND we still have iterations left, push a
                # corrective user message and let the model retry.
                raw_text = msg.content or ""
                parsed_now = self._extract_json(raw_text)
                empty_content = not raw_text.strip()
                if (empty_content or parsed_now is None) and iteration < effective_max - 1:
                    # Persist the assistant turn into history so the model sees its own reply,
                    # then append a corrective reprompt and continue the loop.
                    messages.append({"role": "assistant", "content": raw_text})
                    nudge = (
                        "Your last reply contained no parseable JSON. Output your final "
                        "decision NOW as a JSON object matching the schema in the system prompt:\n"
                        '{ "summary": "...", "actions": [{"symbol":"...","side":"BUY|SELL",'
                        '"quantity":N,"reasoning":"..."}] }\n'
                        "An empty actions array is valid if you see no opportunity."
                    )
                    messages.append({"role": "user", "content": nudge})
                    logger.info(
                        f"[{self._model_key}] Re-prompting (iter {iteration+1}/{effective_max}): "
                        f"empty_content={empty_content} parse_failed={parsed_now is None}"
                    )
                    continue
                # Otherwise: accept the response (parse may still be None on
                # final iteration — caller handles that).
                return AgentResult(
                    parsed=parsed_now,
                    raw_text=raw_text,
                    actions=actions,
                    iterations=iteration + 1,
                    total_input_tokens=self._total_input_tokens,
                    total_cache_creation_tokens=self._total_cache_creation_tokens,
                    total_cache_read_tokens=self._total_cache_read_tokens,
                    cache_savings_usd=0.0,  # Actual cost already includes cache pricing
                    total_output_tokens=self._total_output_tokens,
                    total_cost_usd=self._total_cost_usd,
                    total_latency_ms=self._total_latency_ms,
                )

            # Process tool calls
            # Build assistant message with tool_calls for message history
            tc_dicts = []
            for tc in tool_calls:
                tc_dicts.append({
                    "id": tc.id,
                    "type": "function",
                    "function": {
                        "name": tc.function.name,
                        "arguments": tc.function.arguments,
                    },
                })
            messages.append({
                "role": "assistant",
                "content": msg.content or "",
                "tool_calls": tc_dicts,
            })

            # Execute each tool call
            had_trade_rejection = False
            for tc in tool_calls:
                fn_name = tc.function.name
                try:
                    fn_args = json.loads(tc.function.arguments)
                except json.JSONDecodeError:
                    fn_args = {}

                logger.info(f"[{self._model_key}] Tool call: {fn_name}({json.dumps(fn_args)[:200]})")
                result = await self._tools.execute(fn_name, fn_args)

                # Track trade rejections for bonus iteration
                if fn_name == "execute_trade" and not result.success:
                    had_trade_rejection = True

                # Build tool content
                if result.success:
                    tool_content = result.data[:self._max_tool_output()]
                else:
                    tool_content = f"ERROR: {result.error}"

                # Append to messages
                messages.append({
                    "role": "tool",
                    "tool_call_id": tc.id,
                    "name": fn_name,
                    "content": tool_content,
                })

                # Log tool action
                tool_action = AgentAction(
                    turn_number=iteration + 1,
                    role="tool",
                    tool_name=fn_name,
                    tool_call_id=tc.id,
                    input_json=json.dumps(fn_args)[:5000],
                    output_json=tool_content[:10000],
                )
                actions.append(tool_action)
                await self._emit_action(tool_action)

            # Bonus iteration: if trade was rejected on last iteration, grant +1
            if had_trade_rejection and iteration == effective_max - 1 and effective_max == self._max_iterations:
                effective_max += 1
                logger.info(f"[{self._model_key}] Trade rejection on last iteration — granting bonus iteration {effective_max}")

        # Log cache summary
        if self._total_cache_read_tokens > 0:
            logger.info(
                f"[{self._model_key}] Cache summary: "
                f"write={self._total_cache_creation_tokens:,} read={self._total_cache_read_tokens:,} "
                f"savings=${self._total_cache_savings_usd:.4f} "
                f"total_cost=${self._total_cost_usd:.4f}"
            )

        # Max iterations or cost budget reached — force one final JSON-only call
        logger.warning(f"[{self._model_key}] Iteration limit reached ({self._max_iterations}). Forcing final JSON response.")
        try:
            final_kwargs = {
                "model": self._model_spec.litellm_model,
                "messages": messages + [{"role": "user", "content": "You have reached your iteration limit. Provide your FINAL trading decision now as a JSON object with actions, portfolio_reasoning, and risk_notes. If you already queued trades via execute_trade, return an empty actions list."}],
                "temperature": self._model_spec.temperature,
                "max_tokens": self._model_spec.max_tokens,
                "response_format": {"type": "json_object"},
            }
            # TODO(Phase-1B): final_kwargs.update(providers.resolve_call_kwargs(self._model_spec)) + semaphore.
            final_response = await litellm.acompletion(**final_kwargs)
            final_text = final_response.choices[0].message.content or ""
            final_parsed = self._extract_json(final_text)
            if final_parsed:
                return AgentResult(
                    parsed=final_parsed,
                    raw_text=final_text,
                    actions=actions,
                    iterations=self._max_iterations,
                    total_input_tokens=self._total_input_tokens,
                    total_output_tokens=self._total_output_tokens,
                    total_cost_usd=self._total_cost_usd,
                    total_latency_ms=self._total_latency_ms,
                    total_cache_creation_tokens=self._total_cache_creation_tokens,
                    total_cache_read_tokens=self._total_cache_read_tokens,
                    cache_savings_usd=0.0,  # Actual cost already includes cache pricing
                )
        except Exception as e:
            logger.error(f"[{self._model_key}] Final forced response failed: {e}")

        return AgentResult(
            parsed=None,
            raw_text="Maximum iterations reached — no valid response produced.",
            actions=actions,
            iterations=self._max_iterations,
            total_input_tokens=self._total_input_tokens,
            total_output_tokens=self._total_output_tokens,
            total_cost_usd=self._total_cost_usd,
            total_latency_ms=self._total_latency_ms,
            total_cache_creation_tokens=self._total_cache_creation_tokens,
            total_cache_read_tokens=self._total_cache_read_tokens,
            cache_savings_usd=self._total_cache_savings_usd,
        )

    def _extract_json(self, text: str) -> dict | None:
        """Extract JSON from LLM response — handles GPT, Claude, DeepSeek quirks."""
        if not text:
            return None
        # Try direct parse
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass
        # Try markdown code block
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
        # Try first { ... } block
        match = re.search(r"\{[\s\S]*\}", text)
        if match:
            try:
                return json.loads(match.group(0))
            except json.JSONDecodeError:
                pass
        logger.warning(f"[{self._model_key}] Could not extract JSON from response")
        return None

    def _get_actual_cost(self, response: Any, input_tokens: int, output_tokens: int) -> float:
        """Get actual cost from OpenRouter response, with fallbacks.

        Priority:
        1. OpenRouter's reported cost (response._hidden_params)
        2. litellm's calculated cost (response._hidden_params.response_cost)
        3. Hardcoded estimate from _COST_TABLE
        """
        # Try OpenRouter's actual cost from response headers
        try:
            hidden = getattr(response, "_hidden_params", {}) or {}
            # litellm stores OpenRouter cost here
            actual_cost = hidden.get("response_cost")
            if actual_cost and float(actual_cost) > 0:
                return float(actual_cost)
        except (TypeError, ValueError):
            pass

        # Try litellm's completion_cost utility
        try:
            cost = litellm.completion_cost(completion_response=response)
            if cost and cost > 0:
                return cost
        except Exception:
            pass

        # Fallback: hardcoded estimate
        return self._estimate_cost_fallback(input_tokens, output_tokens)

    def _estimate_cost_fallback(self, input_tokens: int, output_tokens: int) -> float:
        """Fallback cost estimate using hardcoded rates."""
        prices = _COST_TABLE.get(self._model_key, (2.0, 8.0))
        return (input_tokens * prices[0] + output_tokens * prices[1]) / 1_000_000

    @staticmethod
    def _max_tool_output() -> int:
        return 10_000  # 10KB max per tool result in message history

    async def _emit_action(self, action: AgentAction) -> None:
        if self._on_action:
            try:
                await self._on_action(action)
            except Exception as e:
                logger.debug(f"Failed to emit action: {e}")
