import { app, safeStorage } from "electron";
import { readFile, writeFile, rename, unlink } from "node:fs/promises";
import { join } from "node:path";

function filename() { return join(app.getPath("userData"), "auth-token"); }
export async function getAuthToken(): Promise<string | null> {
  let value: Buffer;
  try { value = await readFile(filename()); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("Secure token storage is unavailable");
  return safeStorage.decryptString(value);
}
export async function setAuthToken(token: string | null): Promise<void> {
  if (token === null) { await unlink(filename()).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); return; }
  if (typeof token !== "string" || token.length > 8192) throw new Error("Invalid authentication token");
  if (!safeStorage.isEncryptionAvailable() || (process.platform === "linux" && safeStorage.getSelectedStorageBackend() === "basic_text")) throw new Error("Secure token storage is unavailable");
  const temporary = filename() + ".tmp";
  await writeFile(temporary, safeStorage.encryptString(token), { mode: 0o600 });
  await rename(temporary, filename());
}
