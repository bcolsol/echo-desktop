import { ConfigData } from "./config";
import { StartMonitoringRequest, WalletLogEvent, WalletMonitoringError, WalletMonitoringStatus } from "./wallet";

declare global {
  interface Window {
    electronAPI: {
      // Config API
      loadConfig: () => Promise<ConfigData | null>;
      saveConfig: (configData: ConfigData) => Promise<any>;
      
      // Wallet monitoring API
      startWalletMonitoring: (request: StartMonitoringRequest) => Promise<any>;
      stopWalletMonitoring: () => Promise<any>;
      getWalletMonitoringStatus: () => Promise<WalletMonitoringStatus>;
      
      // Wallet event listeners
      onWalletLogEvent: (callback: (event: WalletLogEvent) => void) => () => void;
      onWalletError: (callback: (error: WalletMonitoringError) => void) => () => void;
    };
    
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void;
      off: (channel: string, listener?: (event: any, ...args: any[]) => void) => void;
      send: (channel: string, ...args: any[]) => void;
      invoke: (channel: string, ...args: any[]) => Promise<any>;
    };
  }
}