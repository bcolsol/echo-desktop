import { DetectedTrade } from "./dex";
import { CopyTradeResult } from "./jupiter";

export interface WalletLogEvent {
  walletAddress: string;
  signature: string;
  slot: number;
  err: any;
  logs: string[];
  timestamp: number;
  detectedTrade?: DetectedTrade;
  copyTradeResult?: CopyTradeResult;
}

export interface WalletMonitoringStatus {
  isRunning: boolean;
  monitoredWallets: string[];
  connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  lastEventTimestamp?: number;
  subscriptionIds: number[];
}

export interface WalletMonitoringConfig {
  rpcEndpointUrl: string;
  monitoredWalletAddresses: string[];
}

export interface WalletMonitoringError {
  type: 'connection' | 'subscription' | 'validation' | 'unknown';
  message: string;
  walletAddress?: string;
  timestamp: number;
}

export interface WalletEventResponse {
  success: boolean;
  error?: string;
  data?: any;
}

export interface StartMonitoringRequest {
  rpcEndpointUrl: string;
  monitoredWalletAddresses: string;
}