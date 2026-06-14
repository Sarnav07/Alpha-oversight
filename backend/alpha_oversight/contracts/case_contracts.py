"""Agent I/O schemas — the structured outputs each surveillance/R&D agent emits.

These are shared contracts validated via ``structured_completion``. Field names
on ``Features`` are load-bearing: the ``specialist_registry`` triggers read
``cancel_to_fill`` / ``depth_levels`` / ``self_match_ratio`` / ``eod_print_spike``
directly, so they must match exactly.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.contracts.rule_contracts import Rule


class Features(BaseModel):
    """Order-flow features computed by the AnomalyDetector; drive specialist selection."""
    cancel_to_fill: float = 0.0
    depth_levels: int = 0
    self_match_ratio: float = 0.0
    eod_print_spike: bool = False


class ResolvedInputs(BaseModel):
    """The contested inputs the debate sets, fed to the deterministic rule engine."""
    window_ms: int = 0
    bona_fide_ids: list[str] = []
    intent: str = ""


class Dossier(BaseModel):
    """Prosecution / Defense argument: a short headline + detail + the inputs it claims."""
    headline: str
    detail: str
    claimed_inputs: dict = {}


class AnomalyOut(BaseModel):
    """AnomalyDetector output: a smell + the extracted features."""
    suspicious: bool
    features: Features


class InvestigationOut(BaseModel):
    """Investigator output: opened case + the recruited specialist."""
    case_id: str
    specialist: str
    rationale: str = ""


class SpecialistOut(BaseModel):
    """Specialist output: proposed contested rule inputs."""
    candidate_inputs: dict = {}
    rationale: str = ""


class EscalationOut(BaseModel):
    """EscalationManager output: the human packet + (optional) a codified rule."""
    model_config = ConfigDict(arbitrary_types_allowed=True)

    packet: dict
    recommend: str
    rule_codified: Rule | None = None


class AdversaryOut(BaseModel):
    """R&D adversary output: an order-event sequence + the params used to build it."""
    events: list[OrderEvent] = []
    params: dict = {}
