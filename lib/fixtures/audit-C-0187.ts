import type { AuditResponse } from "../types";

/**
 * Audit hash-chain fixture for case C-0187 — feeds the AuditDrawer
 * (GET /cases/{id}/audit). Band-handoff LEAVES ONLY (the only kind the audit
 * endpoint returns; agent-step leaves carry no case_id and are filtered out
 * server-side). Five genuinely chained LedgerEntry rows: genesis prev_hash=""
 * then each hash = sha256(prev_hash + canonical_json(body)) over the
 * {band_message_id, case_id, direction, from, to, kind, sha256} body. Hashes
 * were computed offline so the chain links verify; `verified: true`.
 */
export const fixtureAuditC0187: AuditResponse = {
  case_id: "C-0187",
  verified: true,
  entries: [
    { band_message_id: "bmid-0187-00", bmid: "bmid-0187-00", case_id: "C-0187", direction: "sent", from: "bridge", to: "anomaly_detector", kind: "handoff", sha256: "5089a84ed5f6ecab48d6f4aed6f7229a1c5475c02af79a72c2551db7f74ef50c", prev_hash: "", hash: "332a592ae0a4622892331741dbd9aa847a5f4f55a443f4448bce35c26e84885e" },
    { band_message_id: "bmid-0187-01", bmid: "bmid-0187-01", case_id: "C-0187", direction: "sent", from: "investigator", to: "specialist", kind: "handoff", sha256: "39a403475ea21815fa0b8fbe59f2cf8278668dc35c32e34901ab5cd76ffc9a01", prev_hash: "332a592ae0a4622892331741dbd9aa847a5f4f55a443f4448bce35c26e84885e", hash: "6963b032de77eaff4fb58413d6d51a5f789f75461fe360362868666a105890c3" },
    { band_message_id: "bmid-0187-02", bmid: "bmid-0187-02", case_id: "C-0187", direction: "received", from: "specialist", to: "adjudicator", kind: "evidence", sha256: "352700e8df6ba377fb9c0e3222adb0010660feebac7f7feeb43eda21f8c55800", prev_hash: "6963b032de77eaff4fb58413d6d51a5f789f75461fe360362868666a105890c3", hash: "9fb47ee368b2b6f90274169f592b864eb78d5dd3e5c7bb913823f93aba403166" },
    { band_message_id: "bmid-0187-03", bmid: "bmid-0187-03", case_id: "C-0187", direction: "sent", from: "adjudicator", to: "escalation", kind: "verdict", sha256: "22e3fe87739637cbb74b1dcd98c0686ce9b909319f0a24ea951a8780418874d2", prev_hash: "9fb47ee368b2b6f90274169f592b864eb78d5dd3e5c7bb913823f93aba403166", hash: "a86b8259d9d716054e05882111669ebc242135a53e9f4f80678c238f27736b95" },
    { band_message_id: "bmid-0187-04", bmid: "bmid-0187-04", case_id: "C-0187", direction: "sent", from: "escalation", to: "human", kind: "escalation", sha256: "d0f8e9d25a5b0ba709e8f11d042e936b7e60c8a544dcdb20333335d60bbadf5e", prev_hash: "a86b8259d9d716054e05882111669ebc242135a53e9f4f80678c238f27736b95", hash: "9b12c2ea535fb4b685e2bf912821add5074b0475544609e3429a3980511fa10e" },
  ],
};
