# LIFTED FROM info-biz-arena/src/arena/logging/trace.py:1-215 — Pydantic models only.
# STRIPPED: DecisionTraceLogger (lines 217-498) + its aiofiles/structlog/StateStore/MODEL_CONFIGS deps.
"""Frontier-grade trace Pydantic models.

These are the structured-logging record types. Hash fields here are
empty-string stubs — the REAL tamper-evident chain (sha256 + prev_hash +
verify_chain) is built in ``audit/ledger.py``, not here.
"""

from datetime import datetime

from pydantic import BaseModel


# ── External API call trace ──


class ExternalAPICallTrace(BaseModel):
    """Trace of a single external API call."""
    service: str
    endpoint: str
    request_summary: dict = {}
    response_status: int = 0
    response_size_bytes: int = 0
    latency_ms: int = 0
    retries: int = 0
    error: str | None = None


# ── Tool execution pipeline trace ──


class PipelineStepTrace(BaseModel):
    """Result of a single pipeline step in tool execution."""
    step: str
    passed: bool
    detail: dict = {}


class ToolPipelineTrace(BaseModel):
    """Full 5-step pipeline trace for one tool execution."""
    tool_name: str
    arguments_raw: str = ""
    arguments_parsed: dict = {}
    pipeline_steps: list[PipelineStepTrace] = []
    external_api_calls: list[ExternalAPICallTrace] = []
    budget_before_cents: int = 0
    budget_after_cents: int = 0
    budget_deducted_cents: int = 0
    budget_refunded: bool = False
    total_duration_ms: int = 0
    success: bool = False
    error: str | None = None


# ── LLM call metadata ──


class LLMCallTrace(BaseModel):
    """Full metadata for one LLM API call."""
    model_id: str
    litellm_model: str
    request_timestamp: str
    response_timestamp: str
    latency_ms: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cached_tokens: int = 0
    finish_reason: str = ""
    response_id: str = ""
    parameters: dict = {}
    messages_hash: str = ""
    tools_hash: str = ""
    context_window_used: int = 0
    truncation_applied: bool = False


# ── Content filter audit ──


class ContentFilterAudit(BaseModel):
    """Audit log for content filter checks."""
    ran: bool = False
    tool_name: str = ""
    input_preview: str = ""
    patterns_checked: int = 0
    passed: bool = True
    matched_pattern: str | None = None
    reason: str | None = None


# ── Fairness proof ──


class FairnessProof(BaseModel):
    """Proof that all models received identical conditions."""
    system_prompt_hash: str = ""
    cycle_prompt_hash: str = ""
    tools_list_hash: str = ""
    tool_count: int = 0
    config_snapshot: dict = {}


# ── Budget mutation event ──


class BudgetMutation(BaseModel):
    """Single budget change event."""
    event: str
    amount_cents: int
    reason: str
    balance_before_cents: int
    balance_after_cents: int
    timestamp: str


# ── Core trace models ──


class ToolCallTrace(BaseModel):
    turn: int
    tool_name: str
    arguments: dict
    success: bool
    duration_ms: int
    result_preview: str = ""
    result: dict | None = None
    pipeline_trace: ToolPipelineTrace | None = None
    content_filter_audit: ContentFilterAudit | None = None


class TurnTrace(BaseModel):
    turn_number: int
    assistant_text: str | None = None
    tool_calls: list[ToolCallTrace] = []
    message_count: int = 0
    approx_tokens: int = 0
    new_messages_added: list[str] = []
    compression_triggered: bool = False
    llm_cost_cents: int = 0
    tracking_snapshot: dict | None = None
    phase: str | None = None
    llm_call: LLMCallTrace | None = None
    messages_snapshot_hash: str = ""
    budget_mutations: list[BudgetMutation] = []


class CycleTrace(BaseModel):
    run_id: str
    model_id: str
    provider: str
    model_name: str
    cycle_type: str
    skill_type: str | None = None
    arena_day: int
    season: str
    started_at: datetime
    finished_at: datetime
    duration_seconds: float
    total_turns: int
    total_tool_calls: int
    final_text: str | None = None
    status: str = "completed"
    error: str | None = None
    turns: list[TurnTrace] = []
    products_created: list[str] = []
    content_posted: list[str] = []
    strategy_updated: bool = False
    budget_spent_cents: int = 0
    system_prompt: str | None = None
    skill_prompt: str | None = None
    break_reason: str | None = None
    completion_reason: str | None = None
    checkpoint_resumed_from_turn: int | None = None
    stagnation_detected: bool = False
    fairness_proof: FairnessProof | None = None
    total_external_api_calls: int = 0
    total_budget_mutations: int = 0
