"""FastAPI app factory.

``create_app`` wires the lifespan (register_models(); seed -> registry) and
app.state (event_bus, case_store, registry, handoff), then mounts the routers.
"""

from __future__ import annotations

from fastapi import FastAPI


def create_app() -> FastAPI:
    raise NotImplementedError
