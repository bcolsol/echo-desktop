import { Connection, PublicKey, Logs, Context } from "@solana/web3.js";
import { WalletLogEvent, WalletMonitoringStatus, WalletMonitoringError } from "../../src/type/wallet";

export class WalletMonitor {
  private connection: Connection | null = null;
  private subscriptionIds: Map<string, number> = new Map();
  private isRunning = false;
  private monitoredWallets: string[] = [];
  private eventCallback: ((event: WalletLogEvent) => void) | null = null;
  private errorCallback: ((error: WalletMonitoringError) => void) | null = null;

  /**
   * Creates a Solana connection with the specified RPC URL
   * @param rpcUrl - The Solana RPC endpoint URL
   * @returns Connection instance
   */
  createSolanaConnection(rpcUrl: string): Connection {
    return new Connection(rpcUrl, {
      commitment: "confirmed",
      wsEndpoint: rpcUrl.replace("https://", "wss://").replace("http://", "ws://"),
    });
  }

  /**
   * Parses comma-separated wallet addresses string into array
   * @param addressesString - Comma-separated wallet addresses
   * @returns Array of wallet addresses
   */
  parseWalletAddresses(addressesString: string): string[] {
    if (!addressesString || addressesString.trim() === "") {
      return [];
    }
    
    return addressesString
      .split(",")
      .map((addr) => addr.trim())
      .filter((addr) => addr.length > 0);
  }

  /**
   * Validates a Solana wallet address
   * @param address - Wallet address to validate
   * @returns True if valid, false otherwise
   */
  validateWalletAddress(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Subscribes to logs for a specific wallet address
   * @param connection - Solana connection instance
   * @param address - Wallet address to monitor
   * @returns Subscription ID or null if failed
   */
  async subscribeToWallet(connection: Connection, address: string): Promise<number | null> {
    try {
      if (!this.validateWalletAddress(address)) {
        throw new Error(`Invalid wallet address: ${address}`);
      }

      const publicKey = new PublicKey(address);
      const subscriptionId = connection.onLogs(
        publicKey,
        (logs: Logs, context) => {
          this.handleLogEvent(address, logs, context);
        },
        "confirmed"
      );

      console.log(`Subscribed to wallet ${address} with subscription ID: ${subscriptionId}`);
      return subscriptionId;
    } catch (error) {
      console.error(`Failed to subscribe to wallet ${address}:`, error);
      this.handleError({
        type: "subscription",
        message: `Failed to subscribe to wallet: ${(error as Error).message}`,
        walletAddress: address,
        timestamp: Date.now(),
      });
      return null;
    }
  }

  /**
   * Unsubscribes from wallet logs
   * @param connection - Solana connection instance
   * @param subscriptionId - Subscription ID to cancel
   */
  async unsubscribeFromWallet(connection: Connection, subscriptionId: number): Promise<void> {
    try {
      await connection.removeOnLogsListener(subscriptionId);
      console.log(`Unsubscribed from subscription ID: ${subscriptionId}`);
    } catch (error) {
      console.error(`Failed to unsubscribe from subscription ${subscriptionId}:`, error);
    }
  }

  /**
   * Handles incoming log events from Solana
   * @param walletAddress - Address of the wallet that generated the log
   * @param logs - Log data from Solana
   * @param context - Context information
   */
  private handleLogEvent(walletAddress: string, logs: Logs, context: Context): void {
    try {
      const event: WalletLogEvent = {
        walletAddress,
        signature: logs.signature,
        slot: context.slot,
        err: logs.err,
        logs: logs.logs,
        timestamp: Date.now(),
      };

      console.log(`Log event received for wallet ${walletAddress}:`, {
        signature: event.signature,
        logsCount: event.logs.length,
        slot: event.slot,
      });

      // Forward event to callback
      if (this.eventCallback) {
        this.eventCallback(event);
      }
    } catch (error) {
      console.error("Error handling log event:", error);
      this.handleError({
        type: "unknown",
        message: `Error processing log event: ${(error as Error).message}`,
        walletAddress,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Handles errors and forwards them to error callback
   * @param error - Error information
   */
  private handleError(error: WalletMonitoringError): void {
    console.error("Wallet monitoring error:", error);
    if (this.errorCallback) {
      this.errorCallback(error);
    }
  }

  /**
   * Sets the callback function for wallet events
   * @param callback - Function to call when wallet events occur
   */
  setEventCallback(callback: (event: WalletLogEvent) => void): void {
    this.eventCallback = callback;
  }

  /**
   * Sets the callback function for errors
   * @param callback - Function to call when errors occur
   */
  setErrorCallback(callback: (error: WalletMonitoringError) => void): void {
    this.errorCallback = callback;
  }

  /**
   * Starts monitoring wallets with the provided configuration
   * @param rpcUrl - Solana RPC endpoint URL
   * @param walletAddressesString - Comma-separated wallet addresses
   */
  async startMonitoring(rpcUrl: string, walletAddressesString: string): Promise<void> {
    try {
      // Stop any existing monitoring
      if (this.isRunning) {
        await this.stopMonitoring();
      }

      // Parse wallet addresses
      const walletAddresses = this.parseWalletAddresses(walletAddressesString);
      if (walletAddresses.length === 0) {
        throw new Error("No valid wallet addresses provided");
      }

      // Create connection
      this.connection = this.createSolanaConnection(rpcUrl);
      
      // Test connection
      try {
        await this.connection.getVersion();
        console.log("Successfully connected to Solana RPC");
      } catch (error) {
        throw new Error(`Failed to connect to Solana RPC: ${(error as Error).message}`);
      }

      // Subscribe to each wallet
      this.monitoredWallets = walletAddresses;
      this.subscriptionIds.clear();

      for (const address of walletAddresses) {
        const subscriptionId = await this.subscribeToWallet(this.connection, address);
        if (subscriptionId !== null) {
          this.subscriptionIds.set(address, subscriptionId);
        }
      }

      if (this.subscriptionIds.size === 0) {
        throw new Error("Failed to subscribe to any wallets");
      }

      this.isRunning = true;
      console.log(`Wallet monitoring started for ${this.subscriptionIds.size} wallets`);
    } catch (error) {
      console.error("Failed to start wallet monitoring:", error);
      this.handleError({
        type: "connection",
        message: `Failed to start monitoring: ${(error as Error).message}`,
        timestamp: Date.now(),
      });
      
      // Clean up on failure
      await this.stopMonitoring();
      throw error;
    }
  }

  /**
   * Stops wallet monitoring and cleans up subscriptions
   */
  async stopMonitoring(): Promise<void> {
    try {
      console.log("Stopping wallet monitoring...");

      // Unsubscribe from all wallets
      if (this.connection && this.subscriptionIds.size > 0) {
        for (const [address, subscriptionId] of this.subscriptionIds) {
          await this.unsubscribeFromWallet(this.connection, subscriptionId);
        }
      }

      // Clean up state
      this.subscriptionIds.clear();
      this.monitoredWallets = [];
      this.connection = null;
      this.isRunning = false;

      console.log("Wallet monitoring stopped");
    } catch (error) {
      console.error("Error stopping wallet monitoring:", error);
      this.handleError({
        type: "unknown",
        message: `Error stopping monitoring: ${(error as Error).message}`,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Gets the current monitoring status
   * @returns Current status information
   */
  getStatus(): WalletMonitoringStatus {
    return {
      isRunning: this.isRunning,
      monitoredWallets: [...this.monitoredWallets],
      connectionStatus: this.connection ? "connected" : "disconnected",
      subscriptionIds: Array.from(this.subscriptionIds.values()),
    };
  }
}

// Export singleton instance
export const walletMonitor = new WalletMonitor();