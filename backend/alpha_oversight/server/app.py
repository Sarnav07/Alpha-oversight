"""FastAPI app factory.

``create_app`` wires the lifespan (``register_models()``; seed -> registry; build
the stores + the Band coordination spine) and ``app.state``
(``event_bus`` / ``case_store`` / ``registry`` / ``handoff`` + the ledger, replay
writer, bridge and settings the routes read), then mounts the routers.

Transport is ``MockBand`` this round (``USE_REAL_BAND=false``): two identities on
one shared broker give the Chinese-wall pair without a live Phoenix WS. Stores are
local SQLite + append-only JSONL — no network at import or startup.
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.bridge import SanitizedBridge
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.mock_band import MockBand
from alpha_oversight.config import Settings
from alpha_oversight.orchestration.replay_writer import ReplayWriter
from alpha_oversight.providers import register_models
from alpha_oversight.reused.events import EventBus
from alpha_oversight.rules.registry import RuleRegistryStore
from alpha_oversight.rules.seed_rules import seed_rules
from alpha_oversight.server import routes_cases, routes_demo, routes_human, routes_stream
from alpha_oversight.state.case_store import CaseStore

_SURVEILLANCE_ROOM = "surveillance"


def create_app() -> FastAPI:
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        settings = Settings.load()
        # 1) make the demo model specs resolvable (no-op when env is empty).
        register_models()

        # 2) stores + the hash-chained ledger.
        ledger = Ledger(f"{settings.ledger_dir}/ledger.jsonl", settings.rules_db)
        registry = RuleRegistryStore(settings.rules_db)
        # 3) seed the curated FINRA-5210 / SEC-10b-5 rules (idempotent on id).
        for rule in seed_rules():
            registry.codify(rule)
        case_store = CaseStore(settings.case_db)
        event_bus = EventBus()
        replay = ReplayWriter(settings.events_dir)

        # 4) Band coordination spine — two identities on one broker (mock this round).
        rnd_band, surv_band = MockBand.pair("rnd", _SURVEILLANCE_ROOM)
        handoff = BandHandoff(surv_band, ledger, event_bus, desk="surveillance")
        rnd_handoff = BandHandoff(rnd_band, ledger, event_bus, desk="rnd")
        bridge = SanitizedBridge(rnd_handoff, surveillance_room=_SURVEILLANCE_ROOM)

        app.state.settings = settings
        app.state.event_bus = event_bus
        app.state.case_store = case_store
        app.state.registry = registry
        app.state.ledger = ledger
        app.state.handoff = handoff
        app.state.rnd_handoff = rnd_handoff
        app.state.bridge = bridge
        app.state.replay = replay
        app.state.events_dir = settings.events_dir
        app.state.surveillance_room = _SURVEILLANCE_ROOM
        yield

    app = FastAPI(title="Alpha & Oversight", lifespan=lifespan)
    app.include_router(routes_stream.router)
    app.include_router(routes_cases.router)
    app.include_router(routes_human.router)
    app.include_router(routes_demo.router)
    return app
