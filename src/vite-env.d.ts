/// <reference types="vite/client" />
import { ConfigData, SaveConfigResponse } from "@/type/config";
interface Window {
  // expose in the `electron/preload/index.ts`
  ipcRenderer: import("electron").IpcRenderer;
  // Add the electronAPI definition
  electronAPI: {
    loadConfig: () => Promise<ConfigData | null>;
    saveConfig: (configData: ConfigData) => Promise<SaveConfigResponse>;
  };
}

export {};
