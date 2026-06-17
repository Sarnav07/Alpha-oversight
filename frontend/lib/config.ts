/**
 * One flag selects the data source. Components never know which adapter is live.
 *   NEXT_PUBLIC_DATA_MODE = mock | live   (default: mock)
 *   NEXT_PUBLIC_API_BASE  = http://localhost:8000  (FastAPI backend)
 * See FRONTEND_BUILD_PLAN.md §7 - the swap-proof seam.
 */
export const DATA_MODE: "mock" | "live" =
  process.env.NEXT_PUBLIC_DATA_MODE === "live" ? "live" : "mock";

export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export const IS_MOCK = DATA_MODE === "mock";
