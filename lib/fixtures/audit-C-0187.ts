import type { AuditResponse } from "../types";

/**
 * Audit hash-chain fixture for case C-0187 — feeds the AuditDrawer
 * (GET /cases/{id}/audit). Six genuinely chained LedgerEntry rows: genesis
 * prev_hash="" then each hash = sha256(prev_hash + canonical_json(body)).
 * Hashes were computed offline so the chain links verify; `verified: true`.
 */
export const fixtureAuditC0187: AuditResponse = {
  case_id: "C-0187",
  verified: true,
  entries: [
    {
      agent: "pipeline",
      desk: "surveillance",
      role: "system",
      content_sha256: "5089a84ed5f6ecab48d6f4aed6f7229a1c5475c02af79a72c2551db7f74ef50c",
      band_message_id: "bmid-0187-00",
      prev_hash: "",
      hash: "8c7fab2ed657421246769aec721d3efc583669d841fec2a2dd42d4ee1caa5613",
    },
    {
      agent: "bridge",
      desk: "rnd",
      role: "handoff",
      content_sha256: "39a403475ea21815fa0b8fbe59f2cf8278668dc35c32e34901ab5cd76ffc9a01",
      band_message_id: "bmid-0187-01",
      prev_hash: "8c7fab2ed657421246769aec721d3efc583669d841fec2a2dd42d4ee1caa5613",
      hash: "2303b302c69465fba21bbb24502809490f1547eef62c191477b3b665e18cfcbd",
    },
    {
      agent: "anomaly_detector",
      desk: "surveillance",
      role: "agent",
      content_sha256: "352700e8df6ba377fb9c0e3222adb0010660feebac7f7feeb43eda21f8c55800",
      band_message_id: "bmid-0187-02",
      prev_hash: "2303b302c69465fba21bbb24502809490f1547eef62c191477b3b665e18cfcbd",
      hash: "91e1bc481b959d193c0e11d2f07ef090c3ceffa0d9bc5d54281b562fd550dfa1",
    },
    {
      agent: "investigator",
      desk: "surveillance",
      role: "agent",
      content_sha256: "22e3fe87739637cbb74b1dcd98c0686ce9b909319f0a24ea951a8780418874d2",
      band_message_id: "bmid-0187-03",
      prev_hash: "91e1bc481b959d193c0e11d2f07ef090c3ceffa0d9bc5d54281b562fd550dfa1",
      hash: "bb44d98ea3aa726144f76c63f14284f2a7a4977f541577c46e60d0eca5a12b19",
    },
    {
      agent: "adjudicator",
      desk: "surveillance",
      role: "verdict",
      content_sha256: "d0f8e9d25a5b0ba709e8f11d042e936b7e60c8a544dcdb20333335d60bbadf5e",
      band_message_id: "bmid-0187-04",
      prev_hash: "bb44d98ea3aa726144f76c63f14284f2a7a4977f541577c46e60d0eca5a12b19",
      hash: "1fce0e648c23efe627945d8b82306d90fb3987c9e6d75f33fbcd85cae69fba72",
    },
    {
      agent: "escalation_manager",
      desk: "surveillance",
      role: "escalation",
      content_sha256: "f8421d32344c1efa557d6f325aa9c2eaf1f247eb6c3539c20eaa9cf632be234a",
      band_message_id: "bmid-0187-05",
      prev_hash: "1fce0e648c23efe627945d8b82306d90fb3987c9e6d75f33fbcd85cae69fba72",
      hash: "785150dc8489cd8504e194b45f9f1b5b68eaf86990dfd083597a59e686bf0f44",
    },
  ],
};
