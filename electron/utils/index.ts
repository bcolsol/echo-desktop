//import type { ConfigData } from '../../src/types/config';

export const validateUrl = (
  url: string
): { isValid: boolean; error?: string } => {
  if (!/^https?:\/\/[^\s$.?#].[^\s]*$/.test(url))
    return { isValid: false, error: "Invalid RPC Endpoint URL." };
  return { isValid: true };
};

export const validatePrivateKey = (
  key: string
): { isValid: boolean; error?: string } => {
  if (!key || key.trim() === "")
    return { isValid: false, error: "Bot Wallet Private Key is required." };
  // Add more specific validation for Solana private keys if needed
  return { isValid: true };
};

export const validateSolAmount = (
  amount: number
): { isValid: boolean; error?: string } => {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0)
    return {
      isValid: false,
      error: "Copy Trade Amount (SOL) must be a positive number.",
    };
  return { isValid: true };
};

export const validatePositiveNumber = (
  num: number | undefined,
  fieldName: string
): { isValid: boolean; error?: string } => {
  if (typeof num !== "number" || isNaN(num) || num <= 0)
    return { isValid: false, error: `${fieldName} must be a positive number.` };
  return { isValid: true };
};

export const validateNonNegativeNumber = (
  num: number | undefined,
  fieldName: string
): { isValid: boolean; error?: string } => {
  if (typeof num !== "number" || isNaN(num) || num < 0)
    return {
      isValid: false,
      error: `${fieldName} must be a non-negative number.`,
    };
  return { isValid: true };
};

export const validateWalletAddressesString = (
  addresses: string
): { isValid: boolean; error?: string } => {
  if (addresses.trim() === "") return { isValid: true }; // Allow empty
  const parts = addresses.split(",").map((s) => s.trim());
  const solanaAddressRegex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
  for (const addr of parts) {
    if (!solanaAddressRegex.test(addr))
      return {
        isValid: false,
        error: `Invalid monitored wallet address: ${addr}. Ensure addresses are comma-separated.`,
      };
  }
  return { isValid: true };
};
