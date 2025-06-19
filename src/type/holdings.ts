export interface BotHolding {
  tokenMint: string;                // Token mint address
  amountLamports: string;          // Total tokens held (smallest units, stored as string for precision)
  solSpentLamports: string;        // Total SOL spent (lamports, stored as string)
  buyTxSignature: string;          // Latest buy transaction signature
  monitoredWallet: string;         // Latest monitored wallet that triggered buy
  timestamp: number;               // Latest buy timestamp
  tokenSymbol: string;             // Token symbol for display
  tokenDecimals: number;           // Token decimals for calculations
}

export interface BotHoldingResponse {
  success: boolean;
  holdings?: BotHolding[];
  error?: string;
}

export interface ClearHoldingsResponse {
  success: boolean;
  error?: string;
}