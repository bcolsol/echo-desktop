import { app, BrowserWindow, shell, ipcMain } from "electron";

import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { update } from "./update";
import {
  validateUrl,
  validatePrivateKey,
  validateSolAmount,
  validatePositiveNumber,
  validateNonNegativeNumber,
  validateWalletAddressesString,
} from "../utils/index";
import { ConfigData, SaveConfigResponse } from "@/type/config";
import { walletMonitor } from "../services/walletMonitor";
import { WalletLogEvent, WalletMonitoringError, WalletEventResponse, StartMonitoringRequest } from "@/type/wallet";
import { CopyTradeResult } from "@/type/jupiter";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬ dist-electron
// │ ├─┬ main
// │ │ └── index.js    > Electron-Main
// │ └─┬ preload
// │   └── index.mjs   > Preload-Scripts
// ├─┬ dist
// │ └── index.html    > Electron-Renderer
//
process.env.APP_ROOT = path.join(__dirname, "../..");

export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
export const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

// Disable GPU Acceleration for Windows 7
if (os.release().startsWith("6.1")) app.disableHardwareAcceleration();

// Set application name for Windows 10+ notifications
if (process.platform === "win32") app.setAppUserModelId(app.getName());

if (!app.requestSingleInstanceLock()) {
  app.quit();
  process.exit(0);
}

let win: BrowserWindow | null = null;
const preload = path.join(__dirname, "../preload/index.mjs");
const indexHtml = path.join(RENDERER_DIST, "index.html");

async function createWindow() {
  win = new BrowserWindow({
    title: "Main window",
    icon: path.join(process.env.VITE_PUBLIC, "favicon.ico"),
    webPreferences: {
      preload,
      // Warning: Enable nodeIntegration and disable contextIsolation is not secure in production
      // nodeIntegration: true,

      // Consider using contextBridge.exposeInMainWorld
      // Read more on https://www.electronjs.org/docs/latest/tutorial/context-isolation
      // contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    // #298
    win.loadURL(VITE_DEV_SERVER_URL);
    // Open devTool if the app is not packaged
    win.webContents.openDevTools();
  } else {
    win.loadFile(indexHtml);
  }

  // Test actively push message to the Electron-Renderer
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  // Make all links open with the browser, not with the application
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https:")) shell.openExternal(url);
    return { action: "deny" };
  });

  // Auto update
  update(win);
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  win = null;
  if (process.platform !== "darwin") app.quit();
});

app.on("second-instance", () => {
  if (win) {
    // Focus on the main window if the user tried to open another
    if (win.isMinimized()) win.restore();
    win.focus();
  }
});

app.on("activate", () => {
  const allWindows = BrowserWindow.getAllWindows();
  if (allWindows.length) {
    allWindows[0].focus();
  } else {
    createWindow();
  }
});

const CONFIG_FILE_PATH = path.join(
  app.getPath("userData"),
  "echo-bot-config.json"
);

ipcMain.handle("config:load", async (): Promise<ConfigData | null> => {
  try {
    await fs.access(CONFIG_FILE_PATH); // Check if file exists
    const fileContent = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    const config = JSON.parse(fileContent) as ConfigData;
    console.log("Configuration loaded from:", CONFIG_FILE_PATH);
    return config;
  } catch (error) {
    console.error(
      "Failed to load config or file does not exist, returning defaults/null:",
      (error as Error).message
    );
    // If the file doesn't exist or there's an error, the renderer will use defaults.
    return null;
  }
});

ipcMain.handle(
  "config:save",
  async (_, configData: ConfigData): Promise<SaveConfigResponse> => {
    let validationResult = validateUrl(configData.rpcEndpointUrl);
    if (!validationResult.isValid)
      return { success: false, error: validationResult.error };

    validationResult = validatePrivateKey(configData.botWalletPrivateKey);
    if (!validationResult.isValid)
      return { success: false, error: validationResult.error };

    configData.copyTradeAmountSol = parseFloat(
      String(configData.copyTradeAmountSol)
    );
    configData.slippagePercentage = parseFloat(
      String(configData.slippagePercentage)
    );

    validationResult = validateSolAmount(configData.copyTradeAmountSol);
    if (!validationResult.isValid)
      return { success: false, error: validationResult.error };

    validationResult = validateNonNegativeNumber(
      configData.slippagePercentage,
      "Slippage Percentage"
    );
    if (!validationResult.isValid)
      return { success: false, error: validationResult.error };

    validationResult = validateWalletAddressesString(
      configData.monitoredWalletAddresses
    );
    if (!validationResult.isValid)
      return { success: false, error: validationResult.error };

    if (configData.manageWithSltp) {
      configData.takeProfitPercentage = parseFloat(
        String(configData.takeProfitPercentage)
      );
      configData.stopLossPercentage = parseFloat(
        String(configData.stopLossPercentage)
      );
      configData.priceCheckIntervalSeconds = parseInt(
        String(configData.priceCheckIntervalSeconds),
        10
      );

      validationResult = validatePositiveNumber(
        configData.takeProfitPercentage,
        "Take Profit Percentage"
      );
      if (!validationResult.isValid)
        return { success: false, error: validationResult.error };

      validationResult = validatePositiveNumber(
        configData.stopLossPercentage,
        "Stop Loss Percentage"
      );
      if (!validationResult.isValid)
        return { success: false, error: validationResult.error };

      validationResult = validatePositiveNumber(
        configData.priceCheckIntervalSeconds,
        "Price Check Interval (ms)"
      );
      if (!validationResult.isValid)
        return { success: false, error: validationResult.error };
    } else {
      delete configData.takeProfitPercentage;
      delete configData.stopLossPercentage;
      delete configData.priceCheckIntervalSeconds;
    }
    try {
      await fs.writeFile(
        CONFIG_FILE_PATH,
        JSON.stringify(configData, null, 2),
        "utf-8"
      );
      return { success: true, message: "Settings saved successfully!" };
    } catch (error) {
      return {
        success: false,
        error: `Failed to save settings: ${(error as Error).message}`,
      };
    }
  }
);

// Wallet monitoring setup
walletMonitor.setEventCallback((event: WalletLogEvent) => {
  // Forward wallet events to renderer process
  if (win && !win.isDestroyed()) {
    win.webContents.send("wallet:log-event", event);
  }
});

walletMonitor.setErrorCallback((error: WalletMonitoringError) => {
  // Forward wallet errors to renderer process
  if (win && !win.isDestroyed()) {
    win.webContents.send("wallet:error", error);
  }
});

walletMonitor.setCopyTradeCallback((result: CopyTradeResult) => {
  // Forward copy trade results to renderer process
  if (win && !win.isDestroyed()) {
    win.webContents.send("copy-trade:result", result);
  }
});

// Wallet monitoring IPC handlers
ipcMain.handle("wallet:start-monitoring", async (_, request: StartMonitoringRequest): Promise<WalletEventResponse> => {
  try {
    // Load current config to pass to wallet monitor for copy trading
    const config = await loadConfigFromFile();
    await walletMonitor.startMonitoring(request.rpcEndpointUrl, request.monitoredWalletAddresses, config);
    return { success: true };
  } catch (error) {
    console.error("Failed to start wallet monitoring:", error);
    return { 
      success: false, 
      error: `Failed to start monitoring: ${(error as Error).message}` 
    };
  }
});

async function loadConfigFromFile(): Promise<ConfigData | undefined> {
  try {
    await fs.access(CONFIG_FILE_PATH);
    const fileContent = await fs.readFile(CONFIG_FILE_PATH, "utf-8");
    return JSON.parse(fileContent) as ConfigData;
  } catch (error) {
    console.log("No config file found, copy trading will be disabled");
    return undefined;
  }
}

ipcMain.handle("wallet:stop-monitoring", async (): Promise<WalletEventResponse> => {
  try {
    await walletMonitor.stopMonitoring();
    return { success: true };
  } catch (error) {
    console.error("Failed to stop wallet monitoring:", error);
    return { 
      success: false, 
      error: `Failed to stop monitoring: ${(error as Error).message}` 
    };
  }
});

ipcMain.handle("wallet:get-status", () => {
  return walletMonitor.getStatus();
});

// Clean up wallet monitoring on app quit
app.on("before-quit", async () => {
  try {
    await walletMonitor.stopMonitoring();
  } catch (error) {
    console.error("Error stopping wallet monitoring on quit:", error);
  }
});

// New window example arg: new windows url
ipcMain.handle("open-win", (_, arg) => {
  const childWindow = new BrowserWindow({
    webPreferences: {
      preload,
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    childWindow.loadURL(`${VITE_DEV_SERVER_URL}#${arg}`);
  } else {
    childWindow.loadFile(indexHtml, { hash: arg });
  }
});
