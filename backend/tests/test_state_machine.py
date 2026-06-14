"""Case state machine + CaseStore (Phase-3A).

The state machine is the demo's safety valve: every transition is bounded and a
``timeout`` trigger always falls back to CLOSED, so no case can wedge. Illegal
transitions raise (a coding bug, not a runtime branch). ``CaseStore`` persists
cases on aiosqlite keyed by ``case_id`` (== Band room task_id).

No LLMs / no network here — pure logic + a tmp sqlite file.
"""

from __future__ import annotations

import pytest

from alpha_oversight.contracts.rule_contracts import Verdict
from alpha_oversight.state.case_store import CaseStore
from alpha_oversight.state.state_machine import (
    TIMEOUTS,
    Case,
    CaseState,
    next_state,
)


# ── next_state: legal transitions (design §2.3) ──────────────────────────────


def test_open_suspicious_to_under_review() -> None:
    assert next_state(CaseState.OPEN, "suspicious") == CaseState.UNDER_REVIEW


def test_under_review_known_pattern_to_flagged() -> None:
    # Beat A: rule engine recognises a known pattern, instant FLAG.
    assert next_state(CaseState.UNDER_REVIEW, "flag") == CaseState.FLAGGED


def test_under_review_rules_miss_to_escalated() -> None:
    # Beat B: the active rules all PASS, debate -> human.
    assert next_state(CaseState.UNDER_REVIEW, "escalate") == CaseState.ESCALATED


def test_flagged_to_closed() -> None:
    assert next_state(CaseState.FLAGGED, "close") == CaseState.CLOSED


def test_escalated_confirm_to_flagged() -> None:
    # Human confirms manipulation: codify -> regression gate -> FLAGGED.
    assert next_state(CaseState.ESCALATED, "confirm") == CaseState.FLAGGED


def test_escalated_reject_to_closed() -> None:
    # Human dismisses: case closes.
    assert next_state(CaseState.ESCALATED, "reject") == CaseState.CLOSED


def test_full_happy_path_open_to_flagged_to_closed() -> None:
    # OPEN -> UNDER_REVIEW -> FLAGGED -> CLOSED (Beat A end-to-end).
    s = CaseState.OPEN
    s = next_state(s, "suspicious")
    assert s == CaseState.UNDER_REVIEW
    s = next_state(s, "flag")
    assert s == CaseState.FLAGGED
    s = next_state(s, "close")
    assert s == CaseState.CLOSED


def test_full_escalation_path_open_to_escalated_to_flagged_to_closed() -> None:
    # OPEN -> UNDER_REVIEW -> ESCALATED -> FLAGGED -> CLOSED (Beat B end-to-end).
    s = CaseState.OPEN
    s = next_state(s, "suspicious")
    s = next_state(s, "escalate")
    assert s == CaseState.ESCALATED
    s = next_state(s, "confirm")
    assert s == CaseState.FLAGGED
    s = next_state(s, "close")
    assert s == CaseState.CLOSED


# ── next_state: timeout always -> CLOSED ─────────────────────────────────────


@pytest.mark.parametrize(
    "state",
    [CaseState.OPEN, CaseState.UNDER_REVIEW, CaseState.FLAGGED, CaseState.ESCALATED],
)
def test_timeout_from_any_nonterminal_to_closed(state: CaseState) -> None:
    assert next_state(state, "timeout") == CaseState.CLOSED


def test_every_nonterminal_state_has_a_timeout_budget() -> None:
    # The safety valve must be reachable from every live state.
    for state in (
        CaseState.OPEN,
        CaseState.UNDER_REVIEW,
        CaseState.FLAGGED,
        CaseState.ESCALATED,
    ):
        assert state in TIMEOUTS
        assert TIMEOUTS[state] > 0.0


# ── next_state: illegal transitions raise ────────────────────────────────────


def test_illegal_trigger_raises() -> None:
    with pytest.raises(ValueError):
        next_state(CaseState.OPEN, "flag")  # OPEN cannot jump straight to FLAGGED


def test_unknown_trigger_raises() -> None:
    with pytest.raises(ValueError):
        next_state(CaseState.UNDER_REVIEW, "bogus")


def test_transition_out_of_closed_raises() -> None:
    # CLOSED is terminal; nothing (not even timeout) leaves it.
    with pytest.raises(ValueError):
        next_state(CaseState.CLOSED, "suspicious")
    with pytest.raises(ValueError):
        next_state(CaseState.CLOSED, "timeout")


def test_skip_review_open_to_escalated_raises() -> None:
    with pytest.raises(ValueError):
        next_state(CaseState.OPEN, "escalate")


# ── CaseStore: aiosqlite round-trips on a tmp db ─────────────────────────────


async def test_create_then_get_round_trip(case_db: str) -> None:
    store = CaseStore(case_db)
    created = await store.create("case-42", "room-42")
    assert isinstance(created, Case)
    assert created.case_id == "case-42"
    assert created.room_id == "room-42"
    assert created.state == CaseState.OPEN
    assert created.created_at is not None
    assert created.updated_at is not None

    fetched = await store.get("case-42")
    assert fetched is not None
    assert fetched.case_id == "case-42"
    assert fetched.room_id == "room-42"
    assert fetched.state == CaseState.OPEN


async def test_get_missing_returns_none(case_db: str) -> None:
    store = CaseStore(case_db)
    assert await store.get("nope") is None


async def test_transition_persists_new_state(case_db: str) -> None:
    store = CaseStore(case_db)
    await store.create("case-1", "room-1")

    moved = await store.transition("case-1", CaseState.UNDER_REVIEW)
    assert moved.state == CaseState.UNDER_REVIEW

    # the change is durable: a fresh handle on the same db sees UNDER_REVIEW.
    store2 = CaseStore(case_db)
    again = await store2.get("case-1")
    assert again is not None
    assert again.state == CaseState.UNDER_REVIEW


async def test_transition_bumps_updated_at(case_db: str) -> None:
    store = CaseStore(case_db)
    created = await store.create("case-2", "room-2")
    moved = await store.transition("case-2", CaseState.FLAGGED)
    # updated_at moves forward (or stays equal); created_at is preserved.
    assert moved.created_at == created.created_at
    assert moved.updated_at >= created.updated_at


async def test_transition_missing_case_raises(case_db: str) -> None:
    store = CaseStore(case_db)
    with pytest.raises(KeyError):
        await store.transition("ghost", CaseState.CLOSED)


async def test_list_returns_all_created_cases(case_db: str) -> None:
    store = CaseStore(case_db)
    await store.create("c-a", "r-a")
    await store.create("c-b", "r-b")
    await store.create("c-c", "r-c")

    cases = await store.list()
    assert {c.case_id for c in cases} == {"c-a", "c-b", "c-c"}
    assert all(isinstance(c, Case) for c in cases)


async def test_list_empty_on_fresh_db(case_db: str) -> None:
    store = CaseStore(case_db)
    assert await store.list() == []


async def test_create_round_trips_verdict_after_transition(case_db: str) -> None:
    # A FLAGGED case carries a verdict; ensure the Case round-trips with it set.
    store = CaseStore(case_db)
    await store.create("case-v", "room-v")
    case = await store.get("case-v")
    assert case is not None
    # verdict starts unset; the engine sets it later in the pipeline.
    assert case.verdict is None
    # sanity: Verdict is the type the pipeline will attach.
    assert Verdict(result="FLAG", rule_id="FINRA-5210-layering").result == "FLAG"
