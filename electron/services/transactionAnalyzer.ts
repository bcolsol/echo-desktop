import {
  ParsedTransactionWithMeta,
  PublicKey,
  TokenBalance,
  LAMPORTS_PER_SOL,
  Connection,
} from "@solana/web3.js";
import { getMint } from "@solana/spl-token";
import Decimal from "decimal.js";
import { DEX_PROGRAM_IDS, WSOL_MINT, TokenInfo, DetectedTradeInternal, TradeAnalysisResult } from "../../src/type/dex";

export class TransactionAnalyzer {
  private connection: Connection;
  private tokenCache: Map<string, TokenInfo> = new Map();

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Checks if a transaction involves interaction with known DEX program IDs.
   * Looks at both top-level and inner instructions.
   */
  isDexInteraction(transaction: ParsedTransactionWithMeta | null): boolean {
    if (
      !transaction ||
      !transaction.meta ||
      !transaction.transaction.message.instructions
    ) {
      return false;
    }

    // Check top-level instructions
    for (const instruction of transaction.transaction.message.instructions) {
      if (
        "programId" in instruction &&
        DEX_PROGRAM_IDS.has(instruction.programId.toBase58())
      ) {
        return true;
      }
    }

    // Check inner instructions
    if (transaction.meta.innerInstructions) {
      for (const innerInstructionSet of transaction.meta.innerInstructions) {
        for (const instruction of innerInstructionSet.instructions) {
          if (
            "programId" in instruction &&
            DEX_PROGRAM_IDS.has(instruction.programId.toBase58())
          ) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Gets basic token information from the SPL Token program
   */
  async getTokenInfo(mintAddress: string): Promise<TokenInfo> {
    // Check cache first
    if (this.tokenCache.has(mintAddress)) {
      return this.tokenCache.get(mintAddress)!;
    }

    try {
      const mintPubkey = new PublicKey(mintAddress);
      const mintInfo = await getMint(this.connection, mintPubkey);
      
      const tokenInfo: TokenInfo = {
        mint: mintAddress,
        symbol: mintAddress.slice(0, 8), // Use shortened mint as symbol for now
        decimals: mintInfo.decimals,
      };

      // Cache the result
      this.tokenCache.set(mintAddress, tokenInfo);
      return tokenInfo;
    } catch (error) {
      console.error(`Failed to get token info for ${mintAddress}:`, error);
      
      // Fallback token info
      const fallbackInfo: TokenInfo = {
        mint: mintAddress,
        symbol: mintAddress.slice(0, 8),
        decimals: 6, // Common default
      };
      
      this.tokenCache.set(mintAddress, fallbackInfo);
      return fallbackInfo;
    }
  }

  /**
   * Converts lamports to SOL using Decimal for precision
   */
  private lamportsToSol(lamports: number): Decimal {
    return new Decimal(lamports).div(LAMPORTS_PER_SOL);
  }

  /**
   * Converts token amount to UI amount using Decimal for precision
   */
  private tokenAmountToUi(amount: number, decimals: number): Decimal {
    return new Decimal(amount).div(new Decimal(10).pow(decimals));
  }

  /**
   * Analyzes a transaction's token balance changes to detect a potential buy or sell
   * involving SOL/WSOL for a specific monitored wallet.
   */
  async analyzeTrade(
    transaction: ParsedTransactionWithMeta | null,
    monitoredWalletPubKey: PublicKey
  ): Promise<DetectedTradeInternal | null> {
    const monitoredWalletAddress = monitoredWalletPubKey.toBase58();
    const txSignature = transaction?.transaction.signatures[0];

    if (
      !transaction?.meta?.preTokenBalances ||
      !transaction.meta.postTokenBalances ||
      !transaction.meta.preBalances ||
      !transaction.meta.postBalances ||
      !transaction.transaction?.message?.accountKeys ||
      !txSignature
    ) {
      return null;
    }

    const { preTokenBalances, postTokenBalances, preBalances, postBalances } = transaction.meta;
    const accountKeys = transaction.transaction.message.accountKeys;

    // Calculate native SOL change
    let nativeSolChange = new Decimal(0);
    const walletAccountIndex = accountKeys.findIndex((key) =>
      key.pubkey.equals(monitoredWalletPubKey)
    );
    
    if (walletAccountIndex !== -1) {
      const preBalance = new Decimal(preBalances[walletAccountIndex]);
      const postBalance = new Decimal(postBalances[walletAccountIndex]);
      nativeSolChange = this.lamportsToSol(postBalance.minus(preBalance).toNumber());
    }

    // Create balance maps for token balances
    const createBalanceMap = (balances: TokenBalance[]): Map<string, TokenBalance> => {
      const map = new Map<string, TokenBalance>();
      for (const b of balances) {
        if (
          b.owner === monitoredWalletAddress &&
          b.uiTokenAmount?.uiAmount !== null &&
          b.uiTokenAmount?.uiAmount !== undefined
        ) {
          map.set(b.mint, b);
        }
      }
      return map;
    };

    const preTokenBalanceMap = createBalanceMap(preTokenBalances);
    const postTokenBalanceMap = createBalanceMap(postTokenBalances);

    // Calculate WSOL token change
    const preWsol = preTokenBalanceMap.get(WSOL_MINT);
    const postWsol = postTokenBalanceMap.get(WSOL_MINT);
    const wsolTokenChange = new Decimal(postWsol?.uiTokenAmount.uiAmount ?? 0)
      .minus(new Decimal(preWsol?.uiTokenAmount.uiAmount ?? 0));

    // Determine which SOL change to use (native or wrapped)
    const solThreshold = new Decimal(0.00001);
    const solChangeToUse = nativeSolChange.abs().gt(solThreshold) ? nativeSolChange : wsolTokenChange;
    const solSymbolToUse = nativeSolChange.abs().gt(solThreshold) ? "SOL" : "WSOL";
    const solMintToUse = WSOL_MINT;

    if (solChangeToUse.abs().lt(solThreshold)) {
      return null;
    }

    // Check all token mints for changes
    const allMints = new Set([...preTokenBalanceMap.keys(), ...postTokenBalanceMap.keys()]);

    for (const mint of allMints) {
      if (mint === WSOL_MINT) continue;

      const preBalance = preTokenBalanceMap.get(mint);
      const postBalance = postTokenBalanceMap.get(mint);

      const tokenChange = new Decimal(postBalance?.uiTokenAmount.uiAmount ?? 0)
        .minus(new Decimal(preBalance?.uiTokenAmount.uiAmount ?? 0));

      if (tokenChange.abs().gt(new Decimal(0.000001))) {
        const tokenInfo = await this.getTokenInfo(mint);

        const isBuy = tokenChange.gt(0) && solChangeToUse.lt(solThreshold.neg());
        const isSell = tokenChange.lt(0) && solChangeToUse.gt(solThreshold);

        if (isBuy || isSell) {
          const tradeType = isBuy ? "buy" : "sell";

          return {
            type: tradeType,
            tokenInfo: tokenInfo,
            tokenMint: mint,
            currencyMint: solMintToUse,
            currencySymbol: solSymbolToUse,
            tokenAmount: tokenChange.abs(),
            currencyAmount: solChangeToUse.abs(),
            originalTxSignature: txSignature,
            monitoredWallet: monitoredWalletPubKey,
          };
        }
      }
    }

    return null;
  }

  /**
   * Analyzes a transaction for DEX interaction and potential trades
   */
  async analyzeTransaction(
    transaction: ParsedTransactionWithMeta | null,
    monitoredWalletPubKey: PublicKey
  ): Promise<TradeAnalysisResult> {
    const isDexTransaction = this.isDexInteraction(transaction);
    
    if (!isDexTransaction) {
      return {
        isDexTransaction: false,
        detectedTrade: null,
      };
    }

    const detectedTrade = await this.analyzeTrade(transaction, monitoredWalletPubKey);

    return {
      isDexTransaction: true,
      detectedTrade,
    };
  }

  /**
   * Updates the connection used by this analyzer
   */
  updateConnection(connection: Connection): void {
    this.connection = connection;
  }

  /**
   * Clears the token info cache
   */
  clearTokenCache(): void {
    this.tokenCache.clear();
  }
}