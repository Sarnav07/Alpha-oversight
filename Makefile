VENV := .venv
PY := $(VENV)/bin/python
PYTEST := $(VENV)/bin/pytest

.PHONY: help install test collect run-backend clean

help:
	@echo "Targets: install | test | collect | run-backend | clean"

install:
	$(PY) -m pip install -e . --no-build-isolation --no-deps

# Full test suite (mocked LLMs + MockBand; never hits the network).
test:
	$(PYTEST) -q

# Import-clean / collection gate.
collect:
	$(PYTEST) --collect-only -q

run-backend:
	$(VENV)/bin/uvicorn alpha_oversight.server.app:create_app --factory --port 8000 --reload

clean:
	find . -type d -name __pycache__ -prune -exec rm -rf {} +
	rm -rf .pytest_cache *.egg-info
