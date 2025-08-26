import config from "../config/default"
import { AccountInfoResponse } from "../types/apiResponses";
import logger from "./logger";

// Convert the big number value to full MPC tokens
export function bnToFullMPC(amount: bigint): number {
  return Number(amount) / 10000;
}

// Convert full MPC amount to precise value
export function fullMPCToBn(amount: bigint): bigint {
  return amount * 10000n;
}

/**
 * Converts a timestamp to a human-readable datetime string
 * @param timestamp - The timestamp to convert (in milliseconds)
 * @returns A formatted datetime string in yyyy-mm-dd 24h format
 */
export function tsToDateStr(timestamp: bigint): string {
  const date = new Date(Number(timestamp));
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

/**
 * Returns the expiration timestamp based on the configured delegation expiration period.
 * @returns {bigint} The expiration timestamp in milliseconds.
 */
export function getExpirationTimestamp(): bigint {
  const delegationExpirationPeriodMs = Number(config.intervals.delegationExpirationPeriod) * 1000;
  const expirationTimestampMs = Date.now() + delegationExpirationPeriodMs;
  const ts = BigInt(expirationTimestampMs);
  return ts;
}

/**
 * Returns the total delegation amount for given account data
 * @returns {bigint} The total value
 */
export function calcTotalDelegation(accountInfo: AccountInfoResponse): bigint {
  let total = BigInt(0);

  for (const stake of accountInfo.account.delegatedStakesToOthers) {
    try {
      const value = BigInt(stake.value);
      total += value;
    } catch (e) {
      logger.warn(`Failed to convert delegated stake value to BigInt: ${stake.value}`, e);
    }
  }
  return total;
}
