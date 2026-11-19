import { test, expect } from "./fixtures";

test("首页通过真实 API 获取状态，并支持手动刷新", async ({ page, api }) => {
  await api.signIn();
  const response = await api.getHealth();
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ status: "ok", service: "nb-hub-api" });

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "nb-hub", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText(/API:\s*ok/);

  const refreshed = page.waitForResponse(
    (response) =>
      new URL(response.url()).pathname === "/api/health" && response.request().method() === "GET",
  );
  await page.getByRole("button", { name: "Check again" }).click();
  expect((await refreshed).ok()).toBe(true);
  await expect(page.getByRole("status")).toHaveText(/API:\s*ok/);
});
