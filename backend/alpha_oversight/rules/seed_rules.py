"""Curated boot rules — FINRA-5210 / SEC-10b-5 ACTIVE patterns seeded at startup."""

from __future__ import annotations

from alpha_oversight.contracts.rule_contracts import Rule


def seed_rules() -> list[Rule]:
    raise NotImplementedError
