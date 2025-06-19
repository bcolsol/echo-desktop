import {
  Connection,
  PublicKey,
  Keypair,
  VersionedTransaction,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import { getAssociatedTokenAddress, getAccount } from "@solana/spl-token";
import bs58 from "bs58";
import { DetectedTradeInternal } from "../../src/type/dex";
import { ConfigData } from "../../src/type/config";
import {
  CopyTradeResult,
  DEFAULT_JUPITER_CONFIG,
} from "../../src/type/jupiter";
import { getJupiterQuote, getJupiterSwap } from "./jupiterApi";
import { WSOL_MINT } from "../../src/type/dex";
import { stateManager } from "./stateManager";

export class CopyTradingEngine {
  private connection: Connection;

  constructor(connection: Connection) {
    this.connection = connection;
  }

  /**
   * Main function to process a detected trade and execute copy trade if valid
   */
  async processCopyTrade(
    detectedTrade: DetectedTradeInternal,
    config: ConfigData
  ): Promise<CopyTradeResult> {
    const timestamp = Date.now();

    try {
      // Validate trade before execution
      const validation = this.validateTrade(detectedTrade, config);
      if (!validation.isValid) {
        return {
          success: false,
          tradeType: detectedTrade.type,
          tokenMint: detectedTrade.tokenMint,
          tokenSymbol: detectedTrade.tokenInfo.symbol,
          amount: "0",
          error: validation.error,
          timestamp,
          originalTxSignature: detectedTrade.originalTxSignature,
          monitoredWallet: detectedTrade.monitoredWallet.toBase58(),
        };
      }

      // Load bot wallet
      const botWallet = this.loadBotWallet(config.botWalletPrivateKey);

      // Execute the appropriate trade type
      if (detectedTrade.type === "buy") {
        return await this.executeBuyTrade(
          detectedTrade,
          config,
          botWallet,
          timestamp
        );
      } else {
        return await this.executeSellTrade(
          detectedTrade,
          config,
          botWallet,
          timestamp
        );
      }
    } catch (error: any) {
      console.error(`[CopyTrading] Error processing copy trade:`, error);
      return {
        success: false,
        tradeType: detectedTrade.type,
        tokenMint: detectedTrade.tokenMint,
        tokenSymbol: detectedTrade.tokenInfo.symbol,
        amount: "0",
        error: `Copy trade failed: ${error.message}`,
        timestamp,
        originalTxSignature: detectedTrade.originalTxSignature,
        monitoredWallet: detectedTrade.monitoredWallet.toBase58(),
      };
    }
  }

  /**
   * Validates a trade before execution
   */
  private validateTrade(
    detectedTrade: DetectedTradeInternal,
    config: ConfigData
  ): { isValid: boolean; error?: string } {
    // Check if copy trading is enabled (we'll add this to config later)
    // For now, assume it's always enabled since this is MVP

    // Check if trade type is valid
    if (detectedTrade.type !== "buy" && detectedTrade.type !== "sell") {
      return { isValid: false, error: "Invalid trade type" };
    }

    // Check if amounts are reasonable
    if (detectedTrade.tokenAmount.lte(0)) {
      return { isValid: false, error: "Invalid token amount" };
    }

    if (detectedTrade.currencyAmount.lte(0)) {
      return { isValid: false, error: "Invalid currency amount" };
    }

    // Check if we have required config values
    if (
      !config.botWalletPrivateKey ||
      config.botWalletPrivateKey.trim() === ""
    ) {
      return { isValid: false, error: "Bot wallet private key not configured" };
    }

    if (detectedTrade.type === "buy" && config.copyTradeAmountSol <= 0) {
      return {
        isValid: false,
        error: "Copy trade amount must be greater than 0",
      };
    }

    return { isValid: true };
  }

  /**
   * Loads bot wallet from private key
   */
  private loadBotWallet(privateKey: string): Keypair {
    try {
      // Support different private key formats
      let secretKey: Uint8Array;

      if (privateKey.startsWith("[")) {
        // JSON array format
        secretKey = new Uint8Array(JSON.parse(privateKey));
      } else if (privateKey.includes(",")) {
        // Comma-separated format
        secretKey = new Uint8Array(
          privateKey.split(",").map((n) => parseInt(n.trim()))
        );
      } else {
        // Base58 format
        secretKey = bs58.decode(privateKey);
      }

      return Keypair.fromSecretKey(secretKey);
    } catch (error: any) {
      throw new Error(`Failed to load bot wallet: ${error.message}`);
    }
  }

  /**
   * Execute a buy trade using fixed SOL amount from config
   */
  private async executeBuyTrade(
    detectedTrade: DetectedTradeInternal,
    config: ConfigData,
    botWallet: Keypair,
    timestamp: number
  ): Promise<CopyTradeResult> {
    const inputMint = WSOL_MINT; // Always buying with SOL
    const outputMint = detectedTrade.tokenMint;
    const amountInLamports = Math.floor(
      config.copyTradeAmountSol * LAMPORTS_PER_SOL
    );
    const slippageBps = Math.floor(config.slippagePercentage * 100); // Convert percentage to basis points

    console.log(
      `[CopyTrading] Executing buy: ${config.copyTradeAmountSol} SOL -> ${detectedTrade.tokenInfo.symbol}`
    );

    try {
      // Get quote from Jupiter
      const quote = await getJupiterQuote(
        DEFAULT_JUPITER_CONFIG.jupiterQuoteApiUrl,
        inputMint,
        outputMint,
        amountInLamports,
        slippageBps
      );

      if (!quote) {
        throw new Error("Failed to get Jupiter quote");
      }

      // Get swap transaction
      const swapResponse = await getJupiterSwap(
        DEFAULT_JUPITER_CONFIG.jupiterSwapApiUrl,
        botWallet.publicKey,
        quote
      );

      if (!swapResponse) {
        throw new Error("Failed to get Jupiter swap transaction");
      }

      // Execute transaction
      const signature = await this.executeTransaction(
        swapResponse.swapTransaction,
        botWallet
      );

      // Update holdings after successful buy trade
      try {
        await stateManager.addOrUpdateHolding(
          outputMint,
          quote.outAmount,
          amountInLamports.toString(),
          signature,
          detectedTrade.monitoredWallet.toBase58(),
          detectedTrade.tokenInfo.symbol,
          detectedTrade.tokenInfo.decimals
        );
      } catch (error: any) {
        console.error(
          `[CopyTrading] Failed to update holdings after buy: ${error.message}`
        );
        // Continue with the trade result even if holdings update fails for now
        // Add retry logic here
      }

      return {
        success: true,
        tradeType: "buy",
        tokenMint: outputMint,
        tokenSymbol: detectedTrade.tokenInfo.symbol,
        amount: config.copyTradeAmountSol.toString(),
        signature,
        timestamp,
        originalTxSignature: detectedTrade.originalTxSignature,
        monitoredWallet: detectedTrade.monitoredWallet.toBase58(),
      };
    } catch (error: any) {
      throw new Error(`Buy trade execution failed: ${error.message}`);
    }
  }

  /**
   * Execute a sell trade using 100% of token balance
   */
  private async executeSellTrade(
    detectedTrade: DetectedTradeInternal,
    config: ConfigData,
    botWallet: Keypair,
    timestamp: number
  ): Promise<CopyTradeResult> {
    const inputMint = detectedTrade.tokenMint;
    const outputMint = WSOL_MINT; // Always selling for SOL
    const slippageBps = Math.floor(config.slippagePercentage * 100);

    // Check if we actually hold this token before attempting to sell
    const existingHolding = stateManager.getHolding(inputMint);
    if (!existingHolding) {
      console.log(
        `[CopyTrading] Skipping sell of ${detectedTrade.tokenInfo.symbol} - no holding found`
      );
      return {
        success: false,
        tradeType: "sell",
        tokenMint: inputMint,
        tokenSymbol: detectedTrade.tokenInfo.symbol,
        amount: "0",
        error: `No holding found for ${detectedTrade.tokenInfo.symbol}. Cannot sell token we don't own.`,
        timestamp,
        originalTxSignature: detectedTrade.originalTxSignature,
        monitoredWallet: detectedTrade.monitoredWallet.toBase58(),
      };
    }

    console.log(
      `[CopyTrading] Executing sell: 100% of ${detectedTrade.tokenInfo.symbol} -> SOL`
    );

    try {
      // Get current token balance (raw units)
      const tokenBalanceRaw = await this.getTokenBalance(
        botWallet.publicKey,
        inputMint
      );

      if (tokenBalanceRaw <= 0) {
        throw new Error(`No ${detectedTrade.tokenInfo.symbol} balance to sell`);
      }

      // Convert to UI amount for display
      const tokenBalanceUI =
        tokenBalanceRaw / Math.pow(10, detectedTrade.tokenInfo.decimals);

      console.log(
        `[CopyTrading] Selling ${tokenBalanceUI} ${detectedTrade.tokenInfo.symbol}`
      );

      // Get quote from Jupiter (use raw amount)
      const quote = await getJupiterQuote(
        DEFAULT_JUPITER_CONFIG.jupiterQuoteApiUrl,
        inputMint,
        outputMint,
        tokenBalanceRaw,
        slippageBps
      );

      if (!quote) {
        throw new Error("Failed to get Jupiter quote");
      }

      // Get swap transaction
      const swapResponse = await getJupiterSwap(
        DEFAULT_JUPITER_CONFIG.jupiterSwapApiUrl,
        botWallet.publicKey,
        quote
      );

      if (!swapResponse) {
        throw new Error("Failed to get Jupiter swap transaction");
      }

      // Execute transaction
      const signature = await this.executeTransaction(
        swapResponse.swapTransaction,
        botWallet
      );

      // Update holdings after successful sell trade (remove holding since we sold 100%)
      try {
        await stateManager.removeHolding(inputMint);
      } catch (error: any) {
        console.error(
          `[CopyTrading] Failed to update holdings after sell: ${error.message}`
        );
        // Continue with the trade result even if holdings update fails
        // Add retry logic here
      }

      return {
        success: true,
        tradeType: "sell",
        tokenMint: inputMint,
        tokenSymbol: detectedTrade.tokenInfo.symbol,
        amount: tokenBalanceUI.toString(), // Display UI amount
        signature,
        timestamp,
        originalTxSignature: detectedTrade.originalTxSignature,
        monitoredWallet: detectedTrade.monitoredWallet.toBase58(),
      };
    } catch (error: any) {
      throw new Error(`Sell trade execution failed: ${error.message}`);
    }
  }

  /**
   * Get token balance for a specific mint
   */
  private async getTokenBalance(
    walletPubkey: PublicKey,
    tokenMint: string
  ): Promise<number> {
    try {
      const mintPubkey = new PublicKey(tokenMint);
      const associatedTokenAddress = await getAssociatedTokenAddress(
        mintPubkey,
        walletPubkey
      );

      const tokenAccount = await getAccount(
        this.connection,
        associatedTokenAddress
      );
      return Number(tokenAccount.amount);
    } catch (error) {
      // Token account might not exist yet
      return 0;
    }
  }

  /**
   * Execute a Jupiter V6 swap transaction (versioned transaction)
   */
  private async executeTransaction(
    base64Transaction: string,
    signer: Keypair
  ): Promise<string> {
    try {
      // Jupiter V6 always returns versioned transactions
      const transactionBuffer = Buffer.from(base64Transaction, "base64");
      const transaction = VersionedTransaction.deserialize(transactionBuffer);

      // Sign the versioned transaction (Jupiter already set the correct blockhash)
      transaction.sign([signer]);

      // Send versioned transaction
      const signature = await this.connection.sendTransaction(transaction, {
        maxRetries: 3,
        preflightCommitment: "confirmed",
      });

      // Wait for confirmation using simple signature confirmation
      await this.connection.confirmTransaction(signature, "confirmed");

      console.log(
        `[CopyTrading] Transaction executed successfully: ${signature}`
      );
      return signature;
    } catch (error: any) {
      throw new Error(`Transaction execution failed: ${error.message}`);
    }
  }

  /**
   * Updates the connection used by this engine
   */
  updateConnection(connection: Connection): void {
    this.connection = connection;
  }
}
