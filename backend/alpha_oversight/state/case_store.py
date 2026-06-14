"""CaseStore — aiosqlite persistence for cases (case_id == Band room task_id).

One row per case. ``state`` is stored as its enum value; ``features``/``verdict``
are JSON TEXT (verdict via Pydantic so it round-trips through the rule engine's
contract); timestamps are ISO-8601 UTC strings. The table is created on
construct, so a fresh handle on an existing db sees prior rows (persistence) —
each method opens its own short-lived connection.

No LLMs / no network here — pure aiosqlite over a local file.
"""

from __future__ import annotations

import json
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import AsyncIterator

import aiosqlite

from alpha_oversight.contracts.rule_contracts import Verdict
from alpha_oversight.state.state_machine import Case, CaseState

_SCHEMA = """
CREATE TABLE IF NOT EXISTS cases (
    case_id     TEXT PRIMARY KEY,
    room_id     TEXT NOT NULL,
    state       TEXT NOT NULL,
    features    TEXT NOT NULL DEFAULT '{}',
    verdict     TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
)
"""


def _utcnow_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _row_to_case(row: aiosqlite.Row) -> Case:
    verdict_raw = row["verdict"]
    return Case(
        case_id=row["case_id"],
        room_id=row["room_id"],
        state=CaseState(row["state"]),
        features=json.loads(row["features"]),
        verdict=Verdict.model_validate_json(verdict_raw) if verdict_raw else None,
        created_at=datetime.fromisoformat(row["created_at"]),
        updated_at=datetime.fromisoformat(row["updated_at"]),
    )


class CaseStore:
    def __init__(self, db_path: str):
        self._db_path = db_path
        self._ready = False

    @asynccontextmanager
    async def _connect(self) -> AsyncIterator[aiosqlite.Connection]:
        # Single `async with` => one await => the worker thread is started once.
        # (Awaiting the Connection a second time raises "threads can only be
        # started once", so callers must NOT `await` this helper's result.)
        async with aiosqlite.connect(self._db_path) as conn:
            conn.row_factory = aiosqlite.Row
            if not self._ready:
                await conn.execute(_SCHEMA)
                await conn.commit()
                self._ready = True
            yield conn

    async def create(self, case_id: str, room_id: str) -> Case:
        """INSERT a fresh OPEN case (case_id == Band room task_id)."""
        now = _utcnow_iso()
        async with self._connect() as conn:
            await conn.execute(
                "INSERT INTO cases "
                "(case_id, room_id, state, features, verdict, created_at, updated_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (case_id, room_id, CaseState.OPEN.value, "{}", None, now, now),
            )
            await conn.commit()
        return Case(
            case_id=case_id,
            room_id=room_id,
            state=CaseState.OPEN,
            features={},
            verdict=None,
            created_at=datetime.fromisoformat(now),
            updated_at=datetime.fromisoformat(now),
        )

    async def get(self, case_id: str) -> Case | None:
        async with self._connect() as conn:
            cur = await conn.execute(
                "SELECT case_id, room_id, state, features, verdict, "
                "created_at, updated_at FROM cases WHERE case_id = ?",
                (case_id,),
            )
            row = await cur.fetchone()
        return _row_to_case(row) if row is not None else None

    async def transition(
        self,
        case_id: str,
        new_state: CaseState,
        *,
        verdict: Verdict | None = None,
        features: dict | None = None,
    ) -> Case:
        """Persist ``new_state`` for ``case_id`` and bump ``updated_at``.

        Raises ``KeyError`` if the case does not exist. State-machine legality is
        the caller's job (``next_state``); this only writes the chosen state.

        ``verdict`` / ``features`` are optional sidecars the pipeline attaches at
        the transition that produces them (the engine's verdict on FLAG/ESCALATE,
        the detector's features on OPEN -> UNDER_REVIEW). Passing ``None`` leaves
        the stored column untouched, so a later transition can't wipe an earlier
        verdict.
        """
        now = _utcnow_iso()
        sets = ["state = ?", "updated_at = ?"]
        args: list = [new_state.value, now]
        if verdict is not None:
            sets.append("verdict = ?")
            args.append(verdict.model_dump_json())
        if features is not None:
            sets.append("features = ?")
            args.append(json.dumps(features))
        args.append(case_id)
        async with self._connect() as conn:
            cur = await conn.execute(
                f"UPDATE cases SET {', '.join(sets)} WHERE case_id = ?",
                tuple(args),
            )
            await conn.commit()
            if cur.rowcount == 0:
                raise KeyError(case_id)
        case = await self.get(case_id)
        assert case is not None  # just updated it
        return case

    async def list(self) -> list[Case]:
        async with self._connect() as conn:
            cur = await conn.execute(
                "SELECT case_id, room_id, state, features, verdict, "
                "created_at, updated_at FROM cases ORDER BY created_at, case_id"
            )
            rows = await cur.fetchall()
        return [_row_to_case(row) for row in rows]
