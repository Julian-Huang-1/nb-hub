import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApiClient } from "@nb-hub/core/api";
import type { Health } from "@nb-hub/core/types";
import { HomeView } from "./home";

vi.mock("@nb-hub/core/api", () => ({ createApiClient: vi.fn() }));

const getHealth = vi.fn<() => Promise<Health>>();
const clients: QueryClient[] = [];
const health: Health = { status: "ok", service: "nb-hub-api" };

function renderHome() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return render(
    <QueryClientProvider client={client}>
      <HomeView apiUrl="http://localhost:8080" />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  getHealth.mockReset();
  vi.mocked(createApiClient).mockReturnValue({ getHealth });
});

afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe("共享首页", () => {
  it("请求未完成时展示连接状态", () => {
    getHealth.mockReturnValue(new Promise(() => {}));
    renderHome();
    expect(screen.getByRole("status")).toHaveTextContent("Connecting…");
  });

  it("请求失败后可通过按钮重试并恢复正常状态", async () => {
    getHealth.mockRejectedValueOnce(new Error("API returned 503")).mockResolvedValue(health);
    renderHome();
    expect(await screen.findByText("API: Unavailable: API returned 503")).toBeVisible();

    await userEvent.setup().click(screen.getByRole("button", { name: "Check again" }));
    expect(await screen.findByText("API: ok")).toBeVisible();
    expect(createApiClient).toHaveBeenCalledWith("http://localhost:8080");
    expect(getHealth).toHaveBeenCalledTimes(2);
  });
});
