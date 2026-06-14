"""Curated boot rules — FINRA-5210 / SEC-10b-5 ACTIVE patterns seeded at startup.

A deliberately small, real-regulation-anchored set (design §6.2): two FINRA
Rule 5210 patterns (layering, spoofing) + an SEC Rule 10b-5 wash-trade pattern +
a marking-the-close pattern. Windows are tight (100ms) on purpose — the Beat-B
novel evasion stretches the layering cancels to ~400ms to slip this set, and the
human-confirmed ``layering-v2`` (Phase 5) re-widens the window to catch it.
"""

from __future__ import annotations

from alpha_oversight.contracts.rule_contracts import Rule, RuleFamily


def seed_rules() -> list[Rule]:
    return [
        Rule(
            id="FINRA-5210-layering",
            family=RuleFamily.LAYERING,
            params={"window_ms": 100, "min_depth_levels": 3},
            provenance="FINRA-5210",
            status="ACTIVE",
        ),
        Rule(
            id="FINRA-5210-spoofing",
            family=RuleFamily.SPOOFING,
            params={"window_ms": 100, "min_cancel_ratio": 0.8},
            provenance="FINRA-5210",
            status="ACTIVE",
        ),
        Rule(
            id="SEC-10b-5-wash",
            family=RuleFamily.WASH_TRADE,
            params={"min_self_match_ratio": 0.5},
            provenance="SEC-10b-5",
            status="ACTIVE",
        ),
        Rule(
            id="SEC-10b-5-marking",
            family=RuleFamily.MARKING,
            params={"min_print_move_bps": 100.0},
            provenance="SEC-10b-5",
            status="ACTIVE",
        ),
    ]
