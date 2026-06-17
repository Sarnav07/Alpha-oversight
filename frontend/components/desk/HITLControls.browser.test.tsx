import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

/**
 * HITLControls — the human-in-the-loop verdict panel. Visible ONLY while the
 * case is ESCALATED; Confirm/Reject delegate to the DeskController and surface a
 * status-mapped inline reason on failure. The model, controller, and
 * framer-motion are all mocked so the test drives pure component behaviour.
 */

// Mutable case state the component reads via useDeskModel().case.state.
let caseState: string | null = "ESCALATED";

vi.mock("@/lib/desk/model", () => ({
  useDeskModel: () => ({ case: { state: caseState } }),
}));

// DeskActionError must be the SAME class object the component imports, so its
// `err instanceof DeskActionError` check matches what the test throws. Defining
// it inside the mock factory makes both sides resolve to this one class.
const confirm = vi.fn();
const reject = vi.fn();
vi.mock("@/lib/desk/controller", () => {
  class DeskActionError extends Error {
    readonly status: number | null;
    constructor(status: number | null, message: string) {
      super(message);
      this.name = "DeskActionError";
      this.status = status;
    }
  }
  return {
    DeskActionError,
    useDeskController: () => ({ confirm, reject }),
  };
});

// framer-motion → plain passthrough elements (drop animation-only props) so the
// rendered DOM is inspectable and useReducedMotion is deterministic.
vi.mock("framer-motion", () => {
  const passthrough =
    (Tag: "button" | "p") =>
    ({
      children,
      whileTap: _whileTap,
      animate: _animate,
      transition: _transition,
      initial: _initial,
      ...rest
    }: {
      children?: ReactNode;
      whileTap?: unknown;
      animate?: unknown;
      transition?: unknown;
      initial?: unknown;
      [key: string]: unknown;
    }) => <Tag {...rest}>{children}</Tag>;
  return {
    motion: { button: passthrough("button"), p: passthrough("p") },
    useReducedMotion: () => false,
  };
});

import HITLControls from "./HITLControls";
import { DeskActionError } from "@/lib/desk/controller";

beforeEach(() => {
  // vitest globals are OFF, so testing-library's auto-cleanup afterEach is not
  // registered — unmount the previous tree by hand to avoid duplicate DOM.
  cleanup();
  caseState = "ESCALATED";
  confirm.mockReset();
  reject.mockReset();
});

describe("HITLControls — visibility gating", () => {
  it("renders nothing when the case is not ESCALATED", () => {
    caseState = "FLAGGED";
    const { container } = render(<HITLControls />);
    expect(container.firstChild).toBeNull();
  });

  it("renders Confirm + Reject when the case is ESCALATED", () => {
    render(<HITLControls />);
    expect(screen.getByRole("button", { name: /codify rule/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close case/i })).toBeInTheDocument();
  });
});

describe("HITLControls — Confirm path", () => {
  it("goes busy (aria-busy + disabled) then settles to the codified label on success", async () => {
    const user = userEvent.setup();
    // Hold the promise so we can observe the pending state mid-flight.
    let resolveConfirm: () => void = () => {};
    confirm.mockReturnValue(new Promise<void>((r) => (resolveConfirm = r)));

    render(<HITLControls />);
    const btn = screen.getByRole("button", { name: /codify rule/i });
    await user.click(btn);

    expect(confirm).toHaveBeenCalledTimes(1);
    expect(btn).toHaveAttribute("aria-busy", "true");
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent(/codifying/i);

    resolveConfirm();
    expect(await screen.findByText(/codified/i)).toBeInTheDocument();
  });

  it("renders the 422 regression-gate reason inline (role=alert) on failure", async () => {
    const user = userEvent.setup();
    confirm.mockRejectedValue(new DeskActionError(422, "POST /cases/C-0187/confirm -> 422"));

    render(<HITLControls />);
    await user.click(screen.getByRole("button", { name: /codify rule/i }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent(/regression gate failed/i);
  });

  it("renders the 404 case-not-found reason inline on failure", async () => {
    const user = userEvent.setup();
    confirm.mockRejectedValue(new DeskActionError(404, "POST /cases/C-0187/confirm -> 404"));

    render(<HITLControls />);
    await user.click(screen.getByRole("button", { name: /codify rule/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/case not found/i);
  });
});

describe("HITLControls — Reject path", () => {
  it("calls controller.reject and settles to the closed label", async () => {
    const user = userEvent.setup();
    reject.mockResolvedValue(undefined);

    render(<HITLControls />);
    await user.click(screen.getByRole("button", { name: /close case/i }));

    expect(reject).toHaveBeenCalledTimes(1);
    expect(await screen.findByText(/closed/i)).toBeInTheDocument();
  });
});
