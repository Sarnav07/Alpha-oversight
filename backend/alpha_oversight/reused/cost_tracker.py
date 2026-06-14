# LIFTED FROM trader-arena/arena/llm/cost_tracker.py:1 — verbatim.
"""LLM API cost tracking and reporting."""

from dataclasses import dataclass, field


@dataclass
class ModelCosts:
    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    total_cost_usd: float = 0.0
    total_latency_ms: int = 0

    @property
    def avg_latency_ms(self) -> int:
        return self.total_latency_ms // self.calls if self.calls > 0 else 0

    @property
    def avg_cost_per_call(self) -> float:
        return self.total_cost_usd / self.calls if self.calls > 0 else 0.0


@dataclass
class CostTracker:
    """Accumulate LLM costs across a run."""

    by_model: dict[str, ModelCosts] = field(default_factory=dict)

    def record(self, model_key: str, input_tokens: int, output_tokens: int, cost_usd: float, latency_ms: int):
        if model_key not in self.by_model:
            self.by_model[model_key] = ModelCosts()
        m = self.by_model[model_key]
        m.calls += 1
        m.input_tokens += input_tokens
        m.output_tokens += output_tokens
        m.total_cost_usd += cost_usd
        m.total_latency_ms += latency_ms

    @property
    def total_cost(self) -> float:
        return sum(m.total_cost_usd for m in self.by_model.values())

    def report(self) -> str:
        lines = ["=== LLM Cost Report ==="]
        for key, m in sorted(self.by_model.items()):
            lines.append(
                f"  {key}: {m.calls} calls, {m.input_tokens:,} in / {m.output_tokens:,} out, "
                f"${m.total_cost_usd:.4f}, avg {m.avg_latency_ms}ms"
            )
        lines.append(f"  TOTAL: ${self.total_cost:.4f}")
        return "\n".join(lines)
