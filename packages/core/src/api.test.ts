// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createApiClient } from "./api";

const health = { status: "ok", service: "nb-hub-api" };

describe("API 客户端", () => {
  it("移除地址尾部斜杠并解析健康检查响应", async () => {
    const fetchMock = vi.fn().mockResolvedValue(Response.json(health));
    vi.stubGlobal("fetch", fetchMock);

    await expect(createApiClient("http://localhost:8080/").getHealth()).resolves.toEqual(health);
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8080/api/health");
  });

  it.each([null, {}, { status: "unknown", service: "nb-hub-api" }, { status: "ok", service: "other" }])(
    "拒绝不符合契约的响应：%j",
    async (body) => {
      vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(body)));
      await expect(createApiClient("http://localhost:8080").getHealth()).rejects.toThrow();
    },
  );

  it("报告非成功 HTTP 状态", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("unavailable", { status: 503 })));
    await expect(createApiClient("http://localhost:8080").getHealth()).rejects.toThrow("API returned 503");
  });

  it("透传网络错误", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    await expect(createApiClient("http://localhost:8080").getHealth()).rejects.toThrow("Failed to fetch");
  });

  it("拒绝无法解析的 JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not-json")));
    await expect(createApiClient("http://localhost:8080").getHealth()).rejects.toThrow();
  });
});
