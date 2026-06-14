"""Surveillance choreography on Band — the Phase-4 milestone.

``run_surveillance`` drives one case end to end over a ``BandTransport`` (MockBand
this round) + the deterministic rule engine:

    SanitizedBridge injects events  ->  AnomalyDetector triages
      ->  Investigator opens a case (CaseStore) + recruits a specialist via an
          @mention handoff  ->  Specialist proposes contested inputs
      ->  Prosecution / Defense debate (<= N rounds, STAGED sequentially so the
          shared Featherless 4-slot semaphore is never exceeded and the debate
          never overlaps the detector/specialist)
      ->  Adjudicator resolves the contested inputs
      ->  rules.evaluate renders the authoritative Verdict
      ->  state transitions persisted (CaseStore)  ->  EscalationManager builds
          the human packet.

Every step emits to the EventBus (``desk`` tagged) + the hash-chained ledger via
the handoff, and is tee'd to the replay writer (``events-<case>.jsonl``). The
deterministic engine — not any LLM — renders the verdict (design §6.2); the debate
is load-bearing only through ``ResolvedInputs.window_ms`` (design §6.3).
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import TYPE_CHECKING, Mapping

from alpha_oversight.agents.adjudicator import Adjudicator
from alpha_oversight.agents.anomaly_detector import AnomalyDetector
from alpha_oversight.agents.defense import Defense
from alpha_oversight.agents.escalation_manager import EscalationManager
from alpha_oversight.agents.investigator import Investigator
from alpha_oversight.agents.prosecution import Prosecution
from alpha_oversight.agents.specialist import Specialist
from alpha_oversight.agents.specialist_registry import SPECIALISTS, select_specialist
from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.contracts.case_contracts import (
    AnomalyOut,
    Dossier,
    ResolvedInputs,
    SpecialistOut,
)
from alpha_oversight.contracts.order_events import OrderEvent
from alpha_oversight.orchestration import briefs
from alpha_oversight.reused.events import ActivityEvent
from alpha_oversight.reused.tool_registry import ToolDefinition, ToolRegistry, ToolResult
from alpha_oversight.rules import engine
from alpha_oversight.state.state_machine import Case, CaseState, next_state

if TYPE_CHECKING:
    from alpha_oversight.audit.ledger import Ledger
    from alpha_oversight.band.bridge import SanitizedBridge
    from alpha_oversight.band.handoff import BandHandoff
    from alpha_oversight.orchestration.replay_writer import ReplayWriter
    from alpha_oversight.reused.events import EventBus
    from alpha_oversight.rules.registry import RuleRegistryStore
    from alpha_oversight.state.case_store import CaseStore

# Logical role -> model key. The pipeline accepts an override map; these defaults
# are the keys ``providers.register_models()`` installs from env.
_DEFAULT_MODELS: dict[str, str] = {
    "anomaly": "open-triage",
    "investigator": "open-triage",
    "specialist": "open-triage",
    "prosecution": "prosecution-frontier",
    "defense": "defense-open",
    "adjudicator": "open-triage",
    "escalation": "escalation-frontier",
}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


class _ReplayTeeBus:
    """An EventBus facade that mirrors every publish into the replay writer.

    Agents + handoff publish through this so their trace lands BOTH on the live
    SSE bus and in ``events-<case>.jsonl`` (the replay is a faithful copy of the
    live stream). ``subscribe``/``unsubscribe`` delegate to the real bus.
    """

    def __init__(self, bus: "EventBus", replay: "ReplayWriter | None", case_id: str):
        self._bus = bus
        self._replay = replay
        self._case_id = case_id

    async def publish(self, event: ActivityEvent) -> None:
        await self._bus.publish(event)
        if self._replay is not None:
            await self._replay.tee(event, case_id=self._case_id)

    def subscribe(self):  # pragma: no cover - parity with EventBus
        return self._bus.subscribe()

    def unsubscribe(self, q) -> None:  # pragma: no cover
        self._bus.unsubscribe(q)


def _recruit_registry() -> ToolRegistry:
    """A tiny tool registry so the Investigator exercises the ReAct loop path.

    The authoritative recruit is the ``@mention`` handoff + ``select_specialist``;
    these tools just let the tool-using Investigator role surface its peer lookup
    in the trace (design §6.4). They never touch the network.
    """
    reg = ToolRegistry()

    async def _list_peers(_args: dict) -> ToolResult:
        return ToolResult(success=True, data=[s["handle"] for s in SPECIALISTS.values()])

    async def _add_participant(args: dict) -> ToolResult:
        return ToolResult(success=True, data={"added": args.get("handle", "")})

    reg.register(
        ToolDefinition(
            name="list_peers",
            description="List Band specialist peers available for recruit.",
            parameters={"type": "object", "properties": {}},
        ),
        _list_peers,
    )
    reg.register(
        ToolDefinition(
            name="add_participant",
            description="Add a specialist peer to the case room.",
            parameters={
                "type": "object",
                "properties": {"handle": {"type": "string"}},
                "required": ["handle"],
            },
        ),
        _add_participant,
    )
    return reg


async def run_surveillance(
    events: list[OrderEvent],
    handoff: "BandHandoff",
    store: "CaseStore",
    registry: "RuleRegistryStore",
    bus: "EventBus",
    ledger: "Ledger",
    *,
    bridge: "SanitizedBridge | None" = None,
    replay: "ReplayWriter | None" = None,
    models: Mapping[str, str] | None = None,
    surveillance_room: str = "case-e2e",
    max_rounds: int = 1,
) -> "Case":
    """Run one surveillance case end to end; return the final persisted ``Case``.

    The case ends ``FLAGGED`` (engine fired), ``ESCALATED`` (rules missed, sent to
    a human), or ``CLOSED`` (detector saw nothing). ``case_id == surveillance_room
    == Band room task_id``. ``bridge``/``replay`` are optional so the orchestrator
    can run without the Chinese-wall crossing or replay tee in a smoke test.
    """
    cfg = {**_DEFAULT_MODELS, **(dict(models) if models else {})}
    case_id = surveillance_room
    tee_bus = _ReplayTeeBus(bus, replay, case_id)

    async def _emit(agent: str, content: str) -> None:
        """Pipeline-level stage marker -> live bus + replay (distinct from agent steps)."""
        event: ActivityEvent = {
            "agent_name": agent,
            "model_id": "",
            "desk": "surveillance",
            "content": content,
            "reasoning": None,
            "tool_calls": [],
            "created_at": _now(),
        }
        await tee_bus.publish(event)

    # ── 0. open the case (case_id == room task_id) ───────────────────────────
    case = await store.create(case_id, surveillance_room)
    await _emit("pipeline", f"opened case {case_id}")

    # ── 1. SanitizedBridge injects the order flow (Chinese wall, events only) ─
    if bridge is not None:
        await bridge.publish_flow(events)
        # Drain the surveillance inbox so the crossing is ACKed + ledger-bound.
        await handoff.pump(_ignore_inbound)

    detector = AnomalyDetector(cfg["anomaly"], ToolRegistry(), tee_bus, ledger)

    # ── 2. AnomalyDetector triages the window ────────────────────────────────
    brief = briefs.flow_brief(events)
    smell: AnomalyOut = await detector.run(brief, AnomalyOut)
    features = smell.features
    if not smell.suspicious:
        # Nothing to chase: close the case (bounded — no wedge).
        closed = await store.transition(
            case_id, next_state(CaseState.OPEN, "timeout"),
            features=features.model_dump(),
        )
        await _emit("pipeline", "detector clean -> CLOSED")
        return closed

    await store.transition(
        case_id, next_state(CaseState.OPEN, "suspicious"),
        features=features.model_dump(),
    )
    await _emit("pipeline", f"suspicious -> UNDER_REVIEW; features={features.model_dump()}")

    # ── 3. Investigator opens + recruits the specialist (tool-using loop) ────
    investigator = Investigator(cfg["investigator"], _recruit_registry(), tee_bus, ledger)
    await investigator.run(briefs.investigation_brief(case_id, features))
    # The registry table is authoritative for the recruit (Band peers carry no
    # capability metadata); the LLM's pick is advisory.
    family, handle = select_specialist(features)
    await _send(handoff, surveillance_room, case_id, "investigator", handle,
                BandKind.HANDOFF, {"recruit": handle, "family": family})
    await _emit("pipeline", f"recruited {handle} ({family})")

    # ── 4. Specialist proposes the contested inputs ──────────────────────────
    specialist = Specialist(cfg["specialist"], ToolRegistry(), tee_bus, ledger)
    spec_out: SpecialistOut = await specialist.run(
        briefs.specialist_brief(family, features), SpecialistOut
    )
    await _send(handoff, surveillance_room, case_id, handle, "prosecution",
                BandKind.EVIDENCE, {"candidate_inputs": spec_out.candidate_inputs})

    # ── 5. Prosecution / Defense debate, STAGED sequentially (Featherless<=4) ─
    prosecution = Prosecution(cfg["prosecution"], ToolRegistry(), tee_bus, ledger)
    defense = Defense(cfg["defense"], ToolRegistry(), tee_bus, ledger)
    pro_dossier: Dossier | None = None
    def_dossier: Dossier | None = None
    for _round in range(max(1, max_rounds)):
        pro_dossier = await prosecution.run(
            briefs.debate_brief("prosecution", family, spec_out, def_dossier), Dossier
        )
        def_dossier = await defense.run(
            briefs.debate_brief("defense", family, spec_out, pro_dossier), Dossier
        )
    await _emit("pipeline", "debate complete")

    # ── 6. Adjudicator resolves the contested inputs ─────────────────────────
    adjudicator = Adjudicator(cfg["adjudicator"], ToolRegistry(), tee_bus, ledger)
    resolved: ResolvedInputs = await adjudicator.run(
        briefs.adjudication_brief(pro_dossier, def_dossier), ResolvedInputs
    )

    # ── 7. deterministic rule engine renders the authoritative verdict ───────
    verdict = engine.evaluate(events, resolved, registry.active())
    await _send(handoff, surveillance_room, case_id, "adjudicator", "escalation",
                BandKind.VERDICT, {"verdict": verdict.model_dump(),
                                   "resolved_inputs": resolved.model_dump()})
    await _emit("pipeline", f"verdict={verdict.result} rule={verdict.rule_id}")

    # ── 8. EscalationManager builds the human packet ─────────────────────────
    escalation = EscalationManager(cfg["escalation"], ToolRegistry(), tee_bus, ledger)
    esc_out = await escalation.run(
        briefs.escalation_brief(verdict, pro_dossier, def_dossier),
    )
    await _send(handoff, surveillance_room, case_id, "escalation", "human",
                BandKind.ESCALATION,
                {"packet": esc_out.packet, "recommend": esc_out.recommend})

    # ── 9. persist the terminal-for-now state (Beat A: FLAGGED; Beat B: ESCALATED)
    trigger = "flag" if verdict.result == "FLAG" else "escalate"
    final = await store.transition(
        case_id, next_state(CaseState.UNDER_REVIEW, trigger), verdict=verdict
    )
    await _emit("pipeline", f"case {case_id} -> {final.state.value}")
    return final


# ── inbound dispatch + handoff helper ────────────────────────────────────────


async def _ignore_inbound(_env: Envelope) -> None:
    """Bridge crossing needs no agent dispatch here; pump still ledgers/ACKs it."""
    return None


async def _send(
    handoff: "BandHandoff",
    room: str,
    case_id: str,
    sender: str,
    peer: str,
    kind: BandKind,
    payload: dict,
) -> str:
    env = Envelope(case_id=case_id, from_=sender, to=peer, kind=kind, payload=payload)
    return await handoff.send(room, env, peer)
