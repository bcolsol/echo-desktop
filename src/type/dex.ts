import { PublicKey } from "@solana/web3.js";
import Decimal from "decimal.js";

export const DEX_PROGRAM_IDS: Set<string> = new Set([
  "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4", // Jupiter v6
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", // Orca Whirlpools
  "PhoeNiXZ8ByJGLkxNfZRnkUfjvmuYqLR89jjFHGqdXY", // Phoenix Trade
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", // Raydium AMM V4 (CPMM)
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium AMM V4 (CLMM)
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK", // Raydium concentrated liquidity
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", // Meteora
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB", // Meteora pools program
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8", // Raydium liquidity pool v4
  "pAMMBay6oceH9fJKBRHGP5D4bD4sWpmSwMn52FMfXEA", // Pumpfun
  "SoLFiHG9TfgtdUXUjWAxi3LtvYuFyDLVhBWxdMZxyCe", // SoLFi
  "opnb2LAfJYbRMAHHvqjCwQxanZn7ReEHp1k81EohpZb", // Openbook
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P", // Pumpfun
  "obriQD1zbpyLz95G5n7nJe6a4DPjpFwa5XYPoNm113y", // Obric v2
  "2wT8Yq49kHgDzXuPxZSaeLaH1qbmGXtEyPy64bL7aD3c", // Infinity swap
  "6m2CDdhRgxpH4WjvdzxAYbGxwdGUz5MziiL5jek2kBma", // OKX DEX
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", // Raydium CPMM
]);

export const WSOL_MINT = "So11111111111111111111111111111111111111112";

export interface TokenInfo {
  mint: string;
  symbol: string;
  decimals: number;
}

export interface DetectedTrade {
  type: "buy" | "sell";
  tokenInfo: TokenInfo;
  tokenMint: string;
  currencyMint: string;
  currencySymbol: string;
  tokenAmount: string;
  currencyAmount: string;
  originalTxSignature: string;
  monitoredWallet: string;
}

export interface DetectedTradeInternal {
  type: "buy" | "sell";
  tokenInfo: TokenInfo;
  tokenMint: string;
  currencyMint: string;
  currencySymbol: string;
  tokenAmount: Decimal;
  currencyAmount: Decimal;
  originalTxSignature: string;
  monitoredWallet: PublicKey;
}

export interface TradeAnalysisResult {
  isDexTransaction: boolean;
  detectedTrade: DetectedTradeInternal | null;
}

/**
 * Converts DetectedTradeInternal to DetectedTrade for IPC serialization.
 * This function handles the conversion of non-serializable types (Decimal, PublicKey)
 * to serializable string representations.
 */
export function serializeDetectedTrade(internalTrade: DetectedTradeInternal): DetectedTrade {
  return {
    type: internalTrade.type,
    tokenInfo: internalTrade.tokenInfo,
    tokenMint: internalTrade.tokenMint,
    currencyMint: internalTrade.currencyMint,
    currencySymbol: internalTrade.currencySymbol,
    tokenAmount: internalTrade.tokenAmount.toString(),
    currencyAmount: internalTrade.currencyAmount.toString(),
    originalTxSignature: internalTrade.originalTxSignature,
    monitoredWallet: internalTrade.monitoredWallet.toBase58(),
  };
}