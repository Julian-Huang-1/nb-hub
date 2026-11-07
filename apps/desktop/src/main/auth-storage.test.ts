// @vitest-environment node
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const environment = vi.hoisted(() => ({ directory: "", available: true }));
vi.mock("electron", () => ({
  app: { getPath: () => environment.directory },
  safeStorage: {
    isEncryptionAvailable: () => environment.available,
    getSelectedStorageBackend: () => "gnome_libsecret",
    encryptString: (value: string) => Buffer.from(`encrypted:${Buffer.from(value).toString("base64")}`),
    decryptString: (value: Buffer) => Buffer.from(value.toString().slice("encrypted:".length), "base64").toString(),
  },
}));
import { getAuthToken, setAuthToken } from "./auth-storage";

beforeEach(async () => { environment.directory = await mkdtemp(join(tmpdir(), "nb-hub-auth-storage-")); environment.available = true; });
afterEach(async () => { await rm(environment.directory, { recursive: true, force: true }); });
it("uses the platform encryption adapter and a private file, then deletes it on logout", async () => {
  expect(await getAuthToken()).toBeNull();
  await setAuthToken("session-secret");
  const file = join(environment.directory, "auth-token");
  expect((await readFile(file)).toString()).not.toBe("session-secret");
  expect((await stat(file)).mode & 0o777).toBe(0o600);
  expect(await getAuthToken()).toBe("session-secret");
  await setAuthToken(null);
  expect(await getAuthToken()).toBeNull();
});
it("refuses to persist tokens when OS encryption is unavailable", async () => {
  environment.available = false;
  await expect(setAuthToken("secret")).rejects.toThrow("Secure token storage is unavailable");
  await expect(readFile(join(environment.directory, "auth-token"))).rejects.toThrow();
});
