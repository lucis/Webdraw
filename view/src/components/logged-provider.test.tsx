import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiClientError } from "../lib/api";
import LoggedProvider from "./logged-provider";
import { UserButton } from "./user-button";

const { requestJson } = vi.hoisted(() => ({ requestJson: vi.fn() }));

vi.mock("../lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/api")>()),
  requestJson,
}));

function renderWithQuery(ui: React.ReactNode) {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      {ui}
    </QueryClientProvider>,
  );
}

afterEach(() => {
  requestJson.mockReset();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("LoggedProvider and UserButton", () => {
  it("redirects an unauthenticated app request to the OpenRouter login route", async () => {
    const assign = vi.fn();
    vi.stubGlobal("location", { assign, pathname: "/app", search: "", hash: "" });
    requestJson.mockRejectedValue(new ApiClientError(401, "unauthorized", "Sign in required"));

    renderWithQuery(<LoggedProvider><div>Protected canvas</div></LoggedProvider>);

    await screen.findByText("Redirecting to OpenRouter sign in…");
    expect(assign).toHaveBeenCalledWith("/api/auth/login?next=%2Fapp");
  });

  it("shows the OpenRouter identifier and logs out with POST", async () => {
    requestJson.mockResolvedValueOnce({ user: { id: "user-1", openRouterUserId: "openrouter-42" } });
    requestJson.mockResolvedValueOnce(undefined);
    const user = userEvent.setup();

    renderWithQuery(<UserButton />);

    expect(await screen.findByRole("button", { name: /openrouter-42/i })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /openrouter-42/i }));
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect(requestJson).toHaveBeenLastCalledWith("/api/auth/logout", { method: "POST" });
  });

  it("handles a failed logout in the UI", async () => {
    requestJson.mockResolvedValueOnce({ user: { id: "user-1", openRouterUserId: "openrouter-42" } });
    requestJson.mockRejectedValueOnce(new Error("Logout request failed"));
    const user = userEvent.setup();

    renderWithQuery(<UserButton />);

    await user.click(await screen.findByRole("button", { name: /openrouter-42/i }));
    await user.click(screen.getByRole("button", { name: "Log out" }));

    expect((await screen.findByRole("alert")).textContent).toBe("Logout request failed");
  });
});
