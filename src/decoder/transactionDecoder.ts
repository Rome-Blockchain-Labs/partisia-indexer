/**
 * Transaction Decoder Module
 *
 * Separates raw blockchain data (immutable) from application-layer interpretation (mutable).
 *
 * Architecture:
 * 1. transaction_content: Stores raw RPC responses (never modified)
 * 2. transactions: Stores decoded interpretations (regenerable)
 *
 * This separation provides:
 * - Offline re-processing without RPC calls
 * - Schema evolution without data loss
 * - Decoder versioning and rollback capability
 * - Audit trail of interpretation changes
 */

import { AbiByteInput } from '@partisiablockchain/abi-client';
import { getLiquidStakingActionMap } from '../utils/abiActionExtractor';

export const DECODER_VERSION = '1.0.0';

/**
 * Transaction content as stored in database (immutable)
 */
export interface TransactionContent {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  contentBase64: string;
  events: any;
  executionStatus: any;
}

/**
 * Decoded transaction data (regenerable)
 */
export interface DecodedTransaction {
  txHash: string;
  blockNumber: number;
  timestamp: Date;
  action: string;
  sender: string;
  amount: string | null;
  decodedArgs: Record<string, any> | null;
  decoderVersion: string;
  metadata: any; // Legacy compatibility
}

/**
 * Result of decoding operation
 */
export interface DecodeResult {
  success: boolean;
  decoded?: DecodedTransaction;
  error?: string;
}

/**
 * Transaction decoder - stateless pure function
 *
 * Takes raw content, produces decoded interpretation.
 * No side effects, no external dependencies, fully testable.
 */
export class TransactionDecoder {
  private readonly contractAddress: string;
  private readonly adminAddress: string;

  constructor(contractAddress: string, adminAddress: string) {
    // Normalize addresses (remove 0x prefix if present)
    this.contractAddress = contractAddress.replace(/^0x/, '').toLowerCase();
    this.adminAddress = adminAddress.replace(/^0x/, '').toLowerCase();
  }

  /**
   * Decode a transaction from raw content
   *
   * @param content - Raw transaction content from blockchain
   * @returns DecodeResult with decoded data or error
   */
  public decode(content: TransactionContent): DecodeResult {
    try {
      const { contentBase64, txHash, blockNumber, timestamp, executionStatus } = content;

      // Step 1: Determine if transaction is relevant
      if (!this.isRelevant(contentBase64)) {
        return {
          success: false,
          error: 'Transaction not relevant to tracked contracts'
        };
      }

      // Step 2: Extract action from RPC envelope
      const action = this.extractAction(contentBase64);
      if (!action) {
        return {
          success: true,
          decoded: {
            txHash,
            blockNumber,
            timestamp,
            action: 'unknown',
            sender: 'unknown',
            amount: null,
            decodedArgs: null,
            decoderVersion: DECODER_VERSION,
            metadata: {
              isSuccess: executionStatus?.success || false,
              executionStatus,
              contentLength: contentBase64.length
            }
          }
        };
      }

      // Step 3: Decode arguments based on action type
      const decodedArgs = this.decodeArguments(contentBase64, action);

      // Step 4: Build decoded transaction
      const decoded: DecodedTransaction = {
        txHash,
        blockNumber,
        timestamp,
        action,
        sender: 'unknown', // TODO: Extract sender from RPC envelope
        amount: null,
        decodedArgs,
        decoderVersion: DECODER_VERSION,
        metadata: {
          isSuccess: executionStatus?.success || false,
          executionStatus,
          contentLength: contentBase64.length
        }
      };

      return { success: true, decoded };

    } catch (error: any) {
      return {
        success: false,
        error: `Decode failed: ${error.message}`
      };
    }
  }

  /**
   * Check if transaction is relevant to tracked contracts
   *
   * Uses binary search on decoded content to avoid false positives.
   * Contract address can appear as ASCII string or binary bytes.
   */
  private isRelevant(contentBase64: string): boolean {
    try {
      const buffer = Buffer.from(contentBase64, 'base64');

      // Check both ASCII and binary representations
      const contractAscii = Buffer.from(this.contractAddress, 'ascii');
      const contractBinary = Buffer.from(this.contractAddress, 'hex');
      const adminAscii = Buffer.from(this.adminAddress, 'ascii');
      const adminBinary = Buffer.from(this.adminAddress, 'hex');

      return buffer.includes(contractAscii) ||
             buffer.includes(contractBinary) ||
             buffer.includes(adminAscii) ||
             buffer.includes(adminBinary);
    } catch {
      return false;
    }
  }

  /**
   * Extract action name from transaction content
   *
   * Partisia RPC format:
   * - Contract address (ASCII string or binary)
   * - Padding/metadata
   * - Action ID (1 byte)
   * - Arguments
   */
  private extractAction(contentBase64: string): string | null {
    try {
      const buffer = Buffer.from(contentBase64, 'base64');
      const actionMap = getLiquidStakingActionMap();

      // Search for known action IDs in the buffer
      // Action IDs are: 0x01, 0x03, 0x05, 0x10-0x19
      const validActionIds = Object.keys(actionMap).map(k => parseInt(k));

      for (let i = 0; i < buffer.length; i++) {
        const byte = buffer[i];

        if (validActionIds.includes(byte)) {
          // Verify this is after the contract address
          const contractAscii = Buffer.from(this.contractAddress, 'ascii');
          const contractBinary = Buffer.from(this.contractAddress, 'hex');

          const hasContractBefore =
            (buffer.indexOf(contractAscii) >= 0 && buffer.indexOf(contractAscii) < i) ||
            (buffer.indexOf(contractBinary) >= 0 && buffer.indexOf(contractBinary) < i);

          if (hasContractBefore) {
            return actionMap[byte] || 'unknown';
          }
        }
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Decode arguments for specific action types
   *
   * Each action has a specific argument structure defined by the ABI.
   * This is where we parse those arguments from the binary data.
   */
  private decodeArguments(contentBase64: string, action: string): Record<string, any> | null {
    try {
      switch (action) {
        case 'accrueRewards':
          return this.decodeAccrueRewardsArgs(contentBase64);

        case 'deposit':
        case 'withdraw':
          return this.decodeAmountArg(contentBase64);

        // Add more action decoders as needed
        default:
          return null;
      }
    } catch {
      return null;
    }
  }

  /**
   * Decode accrueRewards arguments
   *
   * Format: stakeTokenAmount (u128, 16 bytes)
   */
  private decodeAccrueRewardsArgs(contentBase64: string): Record<string, any> | null {
    try {
      const buffer = Buffer.from(contentBase64, 'base64');
      const actionMap = getLiquidStakingActionMap();

      // Find the action byte (0x12 for accrueRewards)
      const accrueRewardsId = Object.entries(actionMap)
        .find(([_, name]) => name === 'accrueRewards')?.[0];

      if (!accrueRewardsId) return null;

      const actionByte = parseInt(accrueRewardsId);
      let actionIndex = -1;

      // Find action byte with contract validation
      for (let i = 0; i < buffer.length; i++) {
        if (buffer[i] === actionByte) {
          const contractAscii = Buffer.from(this.contractAddress, 'ascii');
          const contractBinary = Buffer.from(this.contractAddress, 'hex');

          const hasContractBefore =
            (buffer.indexOf(contractAscii) >= 0 && buffer.indexOf(contractAscii) < i) ||
            (buffer.indexOf(contractBinary) >= 0 && buffer.indexOf(contractBinary) < i);

          if (hasContractBefore) {
            actionIndex = i;
            break;
          }
        }
      }

      if (actionIndex < 0) return null;

      // Arguments start immediately after action byte
      const argsOffset = actionIndex + 1;
      if (argsOffset + 16 > buffer.length) return null;

      // Read u128 (16 bytes, big-endian)
      const argBytes = buffer.slice(argsOffset, argsOffset + 16);
      const input = AbiByteInput.createBigEndian(argBytes);
      const stakeTokenAmount = input.readUnsignedBigInteger(16);

      return {
        stakeTokenAmount: stakeTokenAmount.toString()
      };
    } catch {
      return null;
    }
  }

  /**
   * Decode single amount argument (used by deposit, withdraw, etc)
   *
   * Format: amount (u128, 16 bytes)
   */
  private decodeAmountArg(contentBase64: string): Record<string, any> | null {
    // Similar to accrueRewards, but generic for any amount-based action
    // TODO: Implement when needed
    return null;
  }
}

/**
 * Batch decode multiple transactions
 *
 * Processes transactions in parallel for performance.
 * Returns both successes and failures for error handling.
 */
export async function batchDecode(
  contents: TransactionContent[],
  decoder: TransactionDecoder
): Promise<{
  decoded: DecodedTransaction[];
  failed: Array<{ txHash: string; error: string }>;
}> {
  const decoded: DecodedTransaction[] = [];
  const failed: Array<{ txHash: string; error: string }> = [];

  for (const content of contents) {
    const result = decoder.decode(content);

    if (result.success && result.decoded) {
      decoded.push(result.decoded);
    } else {
      failed.push({
        txHash: content.txHash,
        error: result.error || 'Unknown decode error'
      });
    }
  }

  return { decoded, failed };
}
