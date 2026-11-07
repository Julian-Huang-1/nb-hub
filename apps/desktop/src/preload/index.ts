import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("nbHub", {
  apiUrl: process.env.NB_HUB_API_URL ?? "http://localhost:8080",
  authStorage: {
    get: (): Promise<string | null> => ipcRenderer.invoke("auth:get-token"),
    set: (token: string | null): Promise<void> => ipcRenderer.invoke("auth:set-token", token),
  },
});
