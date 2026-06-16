"""Live Band round-trip smoke — REAL Band, two registered identities.

Proves the Phase-7 transport: the R&D identity sends a HANDOFF envelope into the
shared Band room @mentioning the Surveillance identity; the Surveillance identity
polls REAL Band, receives it, ACKs (/processing,/processed), and the hash-chained
ledger leaf binds the REAL band_message_id. Then verify_chain() over that ledger.

    .venv/bin/python scripts/live_band_smoke.py
"""
from __future__ import annotations
import os, sys, asyncio

_BACKEND = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "backend")
sys.path.insert(0, os.path.abspath(_BACKEND))
from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".env"))

from alpha_oversight.audit.ledger import Ledger
from alpha_oversight.band.handoff import BandHandoff
from alpha_oversight.band.phoenix_band import PhoenixBand
from alpha_oversight.contracts.band_envelope import BandKind, Envelope
from alpha_oversight.reused.events import EventBus

BASE = os.environ["BAND_API_BASE"]; WS = os.environ["BAND_WS_URL"]
SHARED = os.environ["BAND_SHARED_ROOM"]
RND_KEY = os.environ["BAND_RND_API_KEY"]; RND_ID = os.environ["BAND_RND_AGENT_ID"]
SURV_KEY = os.environ["BAND_SURV_API_KEY"]; SURV_ID = os.environ["BAND_SURV_AGENT_ID"]
LEDGER = "./data/live/band_smoke.jsonl"; DB = "./data/live/band_smoke.db"


async def main() -> int:
    os.makedirs("./data/live", exist_ok=True)
    for p in (LEDGER, DB):
        if os.path.exists(p): os.remove(p)

    rnd = PhoenixBand(BASE, RND_KEY, WS, "rnd", agent_id=RND_ID, rooms=[SHARED])
    surv = PhoenixBand(BASE, SURV_KEY, WS, "surv", agent_id=SURV_ID, rooms=[SHARED],
                       recv_timeout=45.0)

    me = await rnd.me(); print(f"[connect] R&D  = {me['name']} ({me['id'][:8]}…)")
    me = await surv.me(); print(f"[connect] SURV = {me['name']} ({me['id'][:8]}…)")

    ledger = Ledger(LEDGER, DB); bus = EventBus()
    rnd_handoff = BandHandoff(rnd, ledger, bus, desk="rnd")
    surv_handoff = BandHandoff(surv, ledger, bus, desk="surv")

    # Drain any leftover backlog in the shared room first (idempotent start).
    async def _skip(_e): return None
    await surv_handoff.pump(_skip)

    # R&D -> Surveillance: a confirmed-evasion handoff (events-only across the wall).
    env = Envelope(case_id="live-case-001", from_="rnd", to="surveillance",
                   kind=BandKind.HANDOFF,
                   payload={"events": [{"action": "PLACE", "side": "BUY", "px": 100.0,
                                        "qty": 500, "ts_ms": 0}], "note": "layering@400ms"})
    bmid = await rnd_handoff.send(SHARED, env, SURV_ID)
    print(f"[send]    R&D posted HANDOFF to real Band — band_message_id={bmid}")

    # Surveillance polls REAL Band and receives it.
    got: list[Envelope] = []
    async def dispatch(e: Envelope): got.append(e)
    print("[poll]    Surveillance polling real Band for the mention…")
    await surv_handoff.pump(dispatch)

    ok = bool(got) and got[0].case_id == env.case_id and got[0].msg_id == env.msg_id
    print(f"[recv]    received {len(got)} envelope(s); match={ok}")
    if got:
        print(f"          payload.note = {got[0].payload.get('note')!r}")

    chain = Ledger.verify_chain(LEDGER)
    n = sum(1 for _ in open(LEDGER)) if os.path.exists(LEDGER) else 0
    print(f"[audit]   ledger leaves={n}  verify_chain()={chain}")

    await rnd.aclose(); await surv.aclose()
    print("\nRESULT:", "PASS ✅" if (ok and chain) else "FAIL ❌")
    return 0 if (ok and chain) else 1


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
