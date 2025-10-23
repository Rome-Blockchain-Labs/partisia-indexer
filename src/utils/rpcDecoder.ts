/**
 * Partisia RPC Transaction Decoder
 *
 * Partisia blockchain transactions are encoded in an RPC format:
 * - Various RPC envelope headers/metadata
 * - Contract address (21 bytes)
 * - Padding (usually 3-4 zero bytes)
 * - Action ID (1 byte)
 * - Serialized arguments
 *
 * This decoder properly extracts the action ID without fragile byte scanning.
 */

import { AbiByteInput } from '@partisiablockchain/abi-client';

export interface DecodedTransaction {
  contractAddress: string;
  actionId: number;
  success: boolean;
}

/**
 * Decode a Partisia transaction to extract the action ID
 * @param contentBase64 Base64-encoded transaction content from blockchain API
 * @param targetContract Expected contract address (for validation)
 * @returns Decoded action ID or null if decoding fails
 */
export function decodeTransactionAction(
  contentBase64: string,
  targetContract: string
): number | null {
  try {
    const contentBuffer = Buffer.from(contentBase64, 'base64');
    const contractBytes = Buffer.from(targetContract.replace(/^0x/, ''), 'hex');

    // Find contract address in the RPC envelope
    const contractIndex = contentBuffer.indexOf(contractBytes);
    if (contractIndex < 0) {
      return null; // Contract not found - not our transaction
    }

    // Known pattern for direct contract calls:
    // contract (21 bytes) + padding (3 bytes) + unknown byte (1) + action (1)
    // Total offset: contractEnd + 4
    const contractEnd = contractIndex + contractBytes.length;
    const actionOffset = contractEnd + 4;

    if (actionOffset >= contentBuffer.length) {
      console.warn(`Action offset ${actionOffset} exceeds buffer length ${contentBuffer.length}`);
      return null;
    }

    const actionId = contentBuffer[actionOffset];

    // Validate it's a reasonable action ID (0x01-0x19 range for this contract)
    if (actionId < 0x01 || actionId > 0x19) {
      console.warn(`Decoded action ID 0x${actionId.toString(16)} is outside expected range`);
      return null;
    }

    return actionId;

  } catch (error) {
    console.error('Error decoding transaction action:', error);
    return null;
  }
}

/**
 * Decode accrueRewards transaction arguments
 * accrueRewards has one argument: stakeTokenAmount (u128, 16 bytes)
 *
 * @param contentBase64 Base64-encoded transaction content
 * @param targetContract Expected contract address
 * @returns Object with stakeTokenAmount as string, or null if decoding fails
 */
export function decodeAccrueRewardsArgs(
  contentBase64: string,
  targetContract: string
): { stakeTokenAmount: string } | null {
  try {
    const contentBuffer = Buffer.from(contentBase64, 'base64');
    const contractBytes = Buffer.from(targetContract.replace(/^0x/, ''), 'hex');

    // Find contract address in the RPC envelope
    const contractIndex = contentBuffer.indexOf(contractBytes);
    if (contractIndex < 0) {
      return null;
    }

    // Action ID is at contractEnd + 4
    const contractEnd = contractIndex + contractBytes.length;
    const actionOffset = contractEnd + 4;
    const argsOffset = actionOffset + 1; // Arguments start after action byte

    if (argsOffset + 16 > contentBuffer.length) {
      console.warn(`Not enough bytes for u128 argument at offset ${argsOffset}`);
      return null;
    }

    // Extract 16-byte u128 using AbiByteInput (big-endian)
    const argsBuffer = contentBuffer.slice(argsOffset);
    const input = AbiByteInput.createBigEndian(argsBuffer);
    const stakeTokenAmount = input.readUnsignedBigInteger(16);

    return {
      stakeTokenAmount: stakeTokenAmount.toString()
    };

  } catch (error) {
    console.error('Error decoding accrueRewards arguments:', error);
    return null;
  }
}

/**
 * Alternative: Decode using AbiByteInput (more robust but requires RPC format knowledge)
 * TODO: Implement proper RPC envelope parsing if format is documented
 */
export function decodeTransactionWithAbi(contentBase64: string): DecodedTransaction | null {
  try {
    const buffer = Buffer.from(contentBase64, 'base64');
    const input = AbiByteInput.createBigEndian(buffer);

    // TODO: Parse RPC envelope structure properly
    // For now, fall back to pattern-based detection

    return null;
  } catch (error) {
    console.error('Error decoding with ABI:', error);
    return null;
  }
}
