"""CaseStore — aiosqlite persistence for cases (case_id == Band room task_id)."""

from __future__ import annotations

from alpha_oversight.state.state_machine import Case, CaseState


class CaseStore:
    def __init__(self, db_path: str):
        self._db_path = db_path
        raise NotImplementedError

    async def create(self, case_id: str, room_id: str) -> Case:
        raise NotImplementedError

    async def get(self, case_id: str) -> Case | None:
        raise NotImplementedError

    async def transition(self, case_id: str, new_state: CaseState) -> Case:
        raise NotImplementedError

    async def list(self) -> list[Case]:
        raise NotImplementedError
