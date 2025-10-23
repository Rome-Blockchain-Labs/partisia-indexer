/**
 * Utility to extract action IDs from the generated ABI file
 * This ensures the action map stays in sync with contract codegen
 */
import fs from 'fs';
import path from 'path';

interface ActionMapping {
  [actionId: number]: string;
}

/**
 * Extracts action ID mappings from the ABI file by parsing the serialization functions
 * @param abiFilePath Path to the generated ABI file
 * @returns Object mapping action IDs (as numbers) to action names
 */
export function extractActionMapFromABI(abiFilePath: string): ActionMapping {
  const abiContent = fs.readFileSync(abiFilePath, 'utf-8');
  const actionMap: ActionMapping = {};

  // Regex to match: export function functionName(...): Buffer {
  //   return AbiByteOutput.serializeBigEndian((_out) => {
  //     _out.writeBytes(Buffer.from("XX", "hex"));
  const functionPattern = /export function (\w+)\([^)]*\): Buffer \{[\s\S]*?_out\.writeBytes\(Buffer\.from\("([0-9a-fA-F]+)", "hex"\)\);/g;

  let match;
  while ((match = functionPattern.exec(abiContent)) !== null) {
    const functionName = match[1];
    const actionIdHex = match[2];

    // Only include action functions, skip initialization and multi-byte codes
    // Action IDs are single bytes (2 hex characters)
    if (functionName !== 'initialize' && actionIdHex.length === 2) {
      const actionId = parseInt(actionIdHex, 16);
      actionMap[actionId] = functionName;
    }
  }

  return actionMap;
}

/**
 * Gets the action map for the liquid staking contract
 * Caches the result to avoid re-parsing on every call
 */
let cachedActionMap: ActionMapping | null = null;

export function getLiquidStakingActionMap(): ActionMapping {
  if (cachedActionMap) {
    return cachedActionMap;
  }

  const abiPath = path.join(__dirname, '../abi/liquid_staking.ts');
  cachedActionMap = extractActionMapFromABI(abiPath);

  return cachedActionMap;
}

/**
 * Helper to check if an action ID is a liquid staking action (not MPC20 token action)
 */
export function isLiquidStakingAction(actionId: number): boolean {
  // MPC20 token actions are 0x01-0x05
  // Liquid staking actions are 0x10-0x19
  return actionId >= 0x10 && actionId <= 0x19;
}
