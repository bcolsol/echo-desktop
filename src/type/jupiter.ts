export interface JupiterQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: string;
  slippageBps: number;
  platformFee?: any;
  priceImpactPct: string;
  routePlan: RoutePlan[];
  contextSlot?: number;
  timeTaken?: number;
}

export interface RoutePlan {
  swapInfo: SwapInfo;
  percent: number;
}

export interface SwapInfo {
  ammKey: string;
  label: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  feeAmount: string;
  feeMint: string;
}

export interface JupiterSwapResponse {
  swapTransaction: string; // base64 encoded transaction
  lastValidBlockHeight?: number;
}

export interface JupiterSwapRequest {
  quoteResponse: JupiterQuoteResponse;
  userPublicKey: string;
  wrapAndUnwrapSol?: boolean;
  useSharedAccounts?: boolean;
  feeAccount?: string;
  trackingAccount?: string;
  computeUnitPriceMicroLamports?: number;
  prioritizationFeeLamports?: number;
  asLegacyTransaction?: boolean;
  useTokenLedger?: boolean;
  destinationTokenAccount?: string;
}

export interface CopyTradeResult {
  success: boolean;
  tradeType: "buy" | "sell";
  tokenMint: string;
  tokenSymbol: string;
  amount: string;
  signature?: string;
  error?: string;
  timestamp: number;
  originalTxSignature: string;
  monitoredWallet: string;
}

export interface CopyTradeConfig {
  enabled: boolean;
  jupiterQuoteApiUrl: string;
  jupiterSwapApiUrl: string;
  maxRetries: number;
  retryDelayMs: number;
}

export const DEFAULT_JUPITER_CONFIG: CopyTradeConfig = {
  enabled: true,
  jupiterQuoteApiUrl: "https://quote-api.jup.ag/v6/quote",
  jupiterSwapApiUrl: "https://quote-api.jup.ag/v6/swap",
  maxRetries: 3,
  retryDelayMs: 1000,
};
