export interface ConfigData {
  rpcEndpointUrl: string;
  botWalletPrivateKey: string;
  copyTradeAmountSol: number;
  slippagePercentage: number;
  monitoredWalletAddresses: string; // Comma-separated string
  manageWithSltp: boolean;
  takeProfitPercentage?: number;
  stopLossPercentage?: number;
  priceCheckIntervalSeconds?: number;
}

export const defaultSetupValues: ConfigData = {
  rpcEndpointUrl: "https://api.mainnet-beta.solana.com",
  botWalletPrivateKey: "",
  copyTradeAmountSol: 0.1,
  slippagePercentage: 30,
  monitoredWalletAddresses: "",
  manageWithSltp: true,
  takeProfitPercentage: 20,
  stopLossPercentage: 10,
  priceCheckIntervalSeconds: 5,
};

export interface SaveConfigResponse {
  success: boolean;
  message?: string;
  error?: string;
}
