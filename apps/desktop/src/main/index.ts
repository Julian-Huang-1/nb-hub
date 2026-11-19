import { app, BrowserWindow, ipcMain } from "electron";
import { getAuthToken, setAuthToken } from "./auth-storage";
import { join } from "node:path";

function createWindow() {
  const window = new BrowserWindow({
    width: 1100,
    height: 760,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event) => event.preventDefault());
  window.webContents.on("will-redirect", (event) => event.preventDefault());

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

app.whenReady().then(() => {
  const assertSender = (event: Electron.IpcMainInvokeEvent) => {
    if (
      !event.senderFrame ||
      event.senderFrame !== event.sender.mainFrame ||
      !BrowserWindow.fromWebContents(event.sender)
    )
      throw new Error("Untrusted token storage request");
  };
  ipcMain.handle("auth:get-token", async (event) => {
    assertSender(event);
    return getAuthToken();
  });
  ipcMain.handle("auth:set-token", async (event, token: string | null) => {
    assertSender(event);
    await setAuthToken(token);
  });
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
