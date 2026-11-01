import { contextBridge } from "electron";

contextBridge.exposeInMainWorld("nbHub", {
  apiUrl: process.env.NB_HUB_API_URL ?? "http://localhost:8080",
});
