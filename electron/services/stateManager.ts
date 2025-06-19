import * as fs from "fs/promises";
import * as path from "path";
import { app } from "electron";
import { BotHolding } from "../../src/type/holdings";

type HoldingsMap = Map<string, BotHolding>;

export class StateManager {
  private holdings: HoldingsMap = new Map();
  private readonly holdingsFilePath: string;

  constructor() {
    this.holdingsFilePath = path.join(
      app.getPath("userData"),
      "echo-bot-holdings.json"
    );
  }

  /**
   * Loads holdings from the JSON file
   */
  async loadHoldings(): Promise<void> {
    try {
      await fs.access(this.holdingsFilePath);
      const fileContent = await fs.readFile(this.holdingsFilePath, "utf-8");
      
      if (!fileContent.trim()) {
        console.log("[StateManager] Holdings file is empty. Starting with empty holdings.");
        this.holdings = new Map();
        return;
      }

      const parsedData: Record<string, BotHolding> = JSON.parse(fileContent);
      const loadedHoldings = new Map<string, BotHolding>();
      let invalidCount = 0;

      for (const [tokenMint, holding] of Object.entries(parsedData)) {
        try {
          if (!this.validateHolding(holding)) {
            console.warn(`[StateManager] Skipping invalid holding for mint ${tokenMint}`);
            invalidCount++;
            continue;
          }
          loadedHoldings.set(tokenMint, holding);
        } catch (error) {
          console.warn(`[StateManager] Skipping corrupted holding for mint ${tokenMint}:`, error);
          invalidCount++;
        }
      }

      this.holdings = loadedHoldings;
      console.log(`[StateManager] Loaded ${this.holdings.size} holdings from file`);
      
      if (invalidCount > 0) {
        console.warn(`[StateManager] Skipped ${invalidCount} invalid holdings during load`);
      }
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        console.log("[StateManager] Holdings file not found. Starting with empty holdings.");
        this.holdings = new Map();
      } else {
        console.error(`[StateManager] Error loading holdings file: ${error.message}`);
        console.warn("[StateManager] Starting with empty holdings due to load error.");
        this.holdings = new Map();
      }
    }
  }

  /**
   * Saves holdings to the JSON file
   */
  async saveHoldings(): Promise<void> {
    try {
      const holdingsObject: Record<string, BotHolding> = {};
      for (const [tokenMint, holding] of this.holdings.entries()) {
        holdingsObject[tokenMint] = holding;
      }

      const jsonString = JSON.stringify(holdingsObject, null, 2);
      await fs.writeFile(this.holdingsFilePath, jsonString, "utf-8");
      console.log(`[StateManager] Successfully saved ${this.holdings.size} holdings to file`);
    } catch (error: any) {
      console.error(`[StateManager] Error saving holdings file: ${error.message}`);
      throw error;
    }
  }

  /**
   * Validates a holding object
   */
  private validateHolding(holding: any): holding is BotHolding {
    return (
      holding &&
      typeof holding.tokenMint === 'string' &&
      typeof holding.amountLamports === 'string' &&
      typeof holding.solSpentLamports === 'string' &&
      typeof holding.buyTxSignature === 'string' &&
      typeof holding.monitoredWallet === 'string' &&
      typeof holding.timestamp === 'number' &&
      typeof holding.tokenSymbol === 'string' &&
      typeof holding.tokenDecimals === 'number'
    );
  }

  /**
   * Gets a specific holding by token mint
   */
  getHolding(tokenMint: string): BotHolding | undefined {
    return this.holdings.get(tokenMint);
  }

  /**
   * Gets all current holdings
   */
  getAllHoldings(): BotHolding[] {
    return Array.from(this.holdings.values());
  }

  /**
   * Adds or updates a holding. If the token already exists, accumulates amounts.
   */
  async addOrUpdateHolding(
    tokenMint: string,
    amountBoughtLamports: string,
    solSpentLamports: string,
    buyTxSignature: string,
    monitoredWallet: string,
    tokenSymbol: string,
    tokenDecimals: number
  ): Promise<void> {
    const existingHolding = this.holdings.get(tokenMint);
    
    if (existingHolding) {
      // Accumulate amounts for existing holding
      const newTotalAmount = (BigInt(existingHolding.amountLamports) + BigInt(amountBoughtLamports)).toString();
      const newTotalSolSpent = (BigInt(existingHolding.solSpentLamports) + BigInt(solSpentLamports)).toString();
      
      const updatedHolding: BotHolding = {
        ...existingHolding,
        amountLamports: newTotalAmount,
        solSpentLamports: newTotalSolSpent,
        buyTxSignature, // Update to latest
        monitoredWallet, // Update to latest
        timestamp: Date.now(), // Update to latest
      };
      
      this.holdings.set(tokenMint, updatedHolding);
      console.log(`[StateManager] Updated holding for ${tokenSymbol}. New amount: ${newTotalAmount}`);
    } else {
      // Create new holding
      const newHolding: BotHolding = {
        tokenMint,
        amountLamports: amountBoughtLamports,
        solSpentLamports,
        buyTxSignature,
        monitoredWallet,
        timestamp: Date.now(),
        tokenSymbol,
        tokenDecimals,
      };
      
      this.holdings.set(tokenMint, newHolding);
      console.log(`[StateManager] Added new holding for ${tokenSymbol}. Amount: ${amountBoughtLamports}`);
    }
    
    await this.saveHoldings();
  }

  /**
   * Removes a holding completely
   */
  async removeHolding(tokenMint: string): Promise<void> {
    if (this.holdings.has(tokenMint)) {
      const holding = this.holdings.get(tokenMint)!;
      this.holdings.delete(tokenMint);
      console.log(`[StateManager] Removed holding for ${holding.tokenSymbol}`);
      await this.saveHoldings();
    } else {
      console.warn(`[StateManager] Attempted to remove holding for ${tokenMint}, but it was not found`);
    }
  }

  /**
   * Clears all holdings (for testing/development)
   */
  async clearAllHoldings(): Promise<void> {
    this.holdings.clear();
    await this.saveHoldings();
    console.log("[StateManager] Cleared all holdings");
  }

  /**
   * Gets the current number of holdings
   */
  getHoldingsCount(): number {
    return this.holdings.size;
  }
}

// Export singleton instance
export const stateManager = new StateManager();