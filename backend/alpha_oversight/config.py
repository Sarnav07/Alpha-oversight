"""Runtime configuration (env-driven).

Loads ``.env`` (via python-dotenv) then reads every §3 variable from the
environment. Built on plain pydantic ``BaseModel`` + an ``os.environ`` loader
because ``pydantic-settings`` is not a project dependency — ``Settings.load()``
is the single entry point.
"""

from __future__ import annotations

import os

from pydantic import BaseModel

try:  # python-dotenv is installed; load .env best-effort.
    from dotenv import load_dotenv

    load_dotenv()
except Exception:  # pragma: no cover - dotenv missing is non-fatal
    pass


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


class Settings(BaseModel):
    # ── AI/ML API (frontier) ──
    aiml_api_key: str = ""
    aiml_api_base: str = "https://api.aimlapi.com/v2"
    aiml_frontier_model: str = ""
    aiml_frontier_model_alt: str = ""
    aiml_free_model: str = ""
    # ── Featherless (open) ──
    featherless_ai_api_key: str = ""
    featherless_open_model: str = ""
    featherless_defense_model: str = ""
    featherless_max_concurrency: int = 4
    # ── Band (two identities) ──
    band_rnd_api_key: str = ""
    band_rnd_agent_id: str = ""
    band_rnd_room: str = ""
    band_surv_api_key: str = ""
    band_surv_agent_id: str = ""
    band_surv_room: str = ""
    band_api_base: str = "https://app.band.ai/api/v1"
    band_ws_url: str = "wss://app.band.ai/api/v1/socket/websocket"
    band_human_peer: str = ""
    use_real_band: bool = False
    # ── Local stores ──
    ledger_dir: str = "./data/ledger"
    events_dir: str = "./data/events"
    case_db: str = "./data/cases.db"
    rules_db: str = "./data/rules.db"
    memory_db: str = "./data/memory.db"
    # ── Server ──
    backend_port: int = 8000
    frontend_api_base: str = "http://localhost:8000"

    @classmethod
    def load(cls) -> "Settings":
        """Build Settings from the current environment (§3 schema)."""
        return cls(
            aiml_api_key=os.environ.get("AIML_API_KEY", ""),
            aiml_api_base=os.environ.get("AIML_API_BASE", "https://api.aimlapi.com/v2"),
            aiml_frontier_model=os.environ.get("AIML_FRONTIER_MODEL", ""),
            aiml_frontier_model_alt=os.environ.get("AIML_FRONTIER_MODEL_ALT", ""),
            aiml_free_model=os.environ.get("AIML_FREE_MODEL", ""),
            featherless_ai_api_key=os.environ.get("FEATHERLESS_AI_API_KEY", ""),
            featherless_open_model=os.environ.get("FEATHERLESS_OPEN_MODEL", ""),
            featherless_defense_model=os.environ.get("FEATHERLESS_DEFENSE_MODEL", ""),
            featherless_max_concurrency=int(os.environ.get("FEATHERLESS_MAX_CONCURRENCY", "4")),
            band_rnd_api_key=os.environ.get("BAND_RND_API_KEY", ""),
            band_rnd_agent_id=os.environ.get("BAND_RND_AGENT_ID", ""),
            band_rnd_room=os.environ.get("BAND_RND_ROOM", ""),
            band_surv_api_key=os.environ.get("BAND_SURV_API_KEY", ""),
            band_surv_agent_id=os.environ.get("BAND_SURV_AGENT_ID", ""),
            band_surv_room=os.environ.get("BAND_SURV_ROOM", ""),
            band_api_base=os.environ.get("BAND_API_BASE", "https://app.band.ai/api/v1"),
            band_ws_url=os.environ.get(
                "BAND_WS_URL", "wss://app.band.ai/api/v1/socket/websocket"
            ),
            band_human_peer=os.environ.get("BAND_HUMAN_PEER", ""),
            use_real_band=_bool("USE_REAL_BAND", False),
            ledger_dir=os.environ.get("LEDGER_DIR", "./data/ledger"),
            events_dir=os.environ.get("EVENTS_DIR", "./data/events"),
            case_db=os.environ.get("CASE_DB", "./data/cases.db"),
            rules_db=os.environ.get("RULES_DB", "./data/rules.db"),
            memory_db=os.environ.get("MEMORY_DB", "./data/memory.db"),
            backend_port=int(os.environ.get("BACKEND_PORT", "8000")),
            frontend_api_base=os.environ.get("FRONTEND_API_BASE", "http://localhost:8000"),
        )
