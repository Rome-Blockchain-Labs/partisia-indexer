import db from '../db/client';

// Cache for token decimals to avoid repeated DB queries
let cachedDecimals: number | null = null;

/**
 * Get token decimals from database
 * Cached after first fetch to avoid repeated queries
 */
export async function getTokenDecimals(): Promise<number> {
  if (cachedDecimals !== null) {
    return cachedDecimals;
  }

  try {
    const result = await db.query(`
      SELECT token_decimals
      FROM token_metadata
      ORDER BY block_number DESC
      LIMIT 1
    `);

    if (result.rows.length > 0 && result.rows[0].token_decimals !== null) {
      cachedDecimals = parseInt(result.rows[0].token_decimals);
      return cachedDecimals;
    }
  } catch (error) {
    console.warn('Failed to fetch token decimals from DB, using default 4:', error);
  }

  // Default to 4 decimals if not found
  cachedDecimals = 4;
  return cachedDecimals;
}

/**
 * Convert raw token amount to human-readable format
 * @param rawAmount - Raw amount from blockchain (BigInt or string)
 * @param decimals - Token decimals (optional, fetched from DB if not provided)
 */
export async function fromRawAmount(rawAmount: bigint | string, decimals?: number): Promise<number> {
  const amount = typeof rawAmount === 'string' ? BigInt(rawAmount) : rawAmount;
  const tokenDecimals = decimals ?? await getTokenDecimals();
  const divisor = BigInt(10 ** tokenDecimals);

  // Use BigInt division for precision
  return Number(amount / divisor) + Number(amount % divisor) / Number(divisor);
}

/**
 * Convert human-readable amount to raw token amount
 * @param amount - Human-readable amount
 * @param decimals - Token decimals (optional, fetched from DB if not provided)
 */
export async function toRawAmount(amount: number, decimals?: number): Promise<bigint> {
  const tokenDecimals = decimals ?? await getTokenDecimals();
  const multiplier = BigInt(10 ** tokenDecimals);

  return BigInt(Math.floor(amount * Number(multiplier)));
}

/**
 * Reset the decimals cache (useful for testing)
 */
export function resetDecimalsCache(): void {
  cachedDecimals = null;
}
