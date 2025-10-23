/**
 * Script to re-identify transactions marked as "unknown"
 * This is needed after fixing the ABI action extractor
 */
import axios from 'axios';
import db from '../src/db/client';
import config from '../src/config';
import { getLiquidStakingActionMap, isLiquidStakingAction } from '../src/utils/abiActionExtractor';

const liquidStakingContract = process.env.LS_CONTRACT || '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

async function identifyTransactionAction(txContent: string): Promise<string> {
  if (!txContent) {
    return 'unknown';
  }

  try {
    // Decode base64 content to binary
    const contentBuffer = Buffer.from(txContent, 'base64');

    // Action ID mapping extracted from the generated ABI file
    const actionMap = getLiquidStakingActionMap();

    // Liquid staking contract actions (0x10-0x19) take priority over MPC20 token actions (0x01-0x05)

    // Strategy 1: Look 5-15 bytes BEFORE the contract address for LS actions
    const contractBytes = Buffer.from(liquidStakingContract.replace(/^0x/, ''), 'hex');
    const contractIndex = contentBuffer.indexOf(contractBytes);

    if (contractIndex > 0) {
      // Search 5-15 bytes before contract address (the "sweet spot" for LS actions)
      const searchStart = Math.max(0, contractIndex - 15);
      const searchEnd = contractIndex - 5;

      for (let i = searchEnd; i >= searchStart; i--) {
        const byte = contentBuffer[i];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          return actionMap[byte];
        }
      }
    }

    // Strategy 2: Check very close to contract (0-5 bytes before) for any action
    if (contractIndex > 0) {
      const searchStart = Math.max(0, contractIndex - 5);
      const searchEnd = contractIndex - 1;

      for (let i = searchEnd; i >= searchStart; i--) {
        const byte = contentBuffer[i];
        if (actionMap[byte]) {
          return actionMap[byte];
        }
      }
    }

    // Strategy 3: Check common offsets for liquid staking actions
    const commonOffsets = [72, 78, 79, 80];
    for (const offset of commonOffsets) {
      if (offset < contentBuffer.length) {
        const byte = contentBuffer[offset];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          return actionMap[byte];
        }
      }
    }

    // Strategy 4: Search broadly around contract address for liquid staking actions
    if (contractIndex > 0) {
      const searchStart = Math.max(0, contractIndex - 30);
      const searchEnd = Math.min(contentBuffer.length, contractIndex + contractBytes.length + 50);

      for (let i = searchStart; i < searchEnd; i++) {
        const byte = contentBuffer[i];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          return actionMap[byte];
        }
      }
    }

    // Strategy 5: If no liquid staking action found, accept any valid action
    if (contractIndex > 0) {
      const searchStart = Math.max(0, contractIndex - 30);
      const searchEnd = Math.min(contentBuffer.length, contractIndex + contractBytes.length + 50);

      for (let i = searchStart; i < searchEnd; i++) {
        const byte = contentBuffer[i];
        if (actionMap[byte]) {
          return actionMap[byte];
        }
      }
    }

    // Last resort: scan entire buffer
    for (let i = 0; i < contentBuffer.length; i++) {
      const byte = contentBuffer[i];
      if (actionMap[byte]) {
        return actionMap[byte];
      }
    }

    return 'unknown';
  } catch (error) {
    console.warn('Error decoding transaction action:', error);
    return 'unknown';
  }
}

async function main() {
  console.log('🔄 Re-identifying unknown transactions...');

  // Get all unknown transactions
  const result = await db.query(`
    SELECT tx_hash, block_number
    FROM transactions
    WHERE action = 'unknown'
    ORDER BY block_number ASC
  `);

  console.log(`📊 Found ${result.rows.length} unknown transactions to re-process`);

  const actionMap = getLiquidStakingActionMap();
  console.log('📋 Available actions:', Object.keys(actionMap).map(k => `0x${parseInt(k).toString(16).padStart(2,'0')} (${actionMap[parseInt(k)]})`).join(', '));

  let updated = 0;
  let stillUnknown = 0;

  for (const row of result.rows) {
    const txHash = row.tx_hash;
    const blockNumber = row.block_number;

    try {
      // Fetch transaction from API
      const txUrl = `${config.blockchain.apiUrl}/chain/shards/${config.blockchain.shard}/transactions/${txHash}`;
      const txResponse = await axios.get(txUrl, { timeout: 10000 });

      if (!txResponse.data || !txResponse.data.content) {
        console.log(`⚠️  ${txHash}: No content available`);
        stillUnknown++;
        continue;
      }

      // Re-identify the action
      const newAction = await identifyTransactionAction(txResponse.data.content);

      if (newAction !== 'unknown') {
        // Update the database
        await db.query(`
          UPDATE transactions
          SET action = $1
          WHERE tx_hash = $2
        `, [newAction, txHash]);

        console.log(`✅ ${txHash} (block ${blockNumber}): unknown → ${newAction}`);
        updated++;
      } else {
        console.log(`❓ ${txHash} (block ${blockNumber}): still unknown`);
        stillUnknown++;
      }

      // Rate limit
      await new Promise(resolve => setTimeout(resolve, 100));

    } catch (error: any) {
      console.error(`❌ ${txHash}: ${error.message}`);
      stillUnknown++;
    }
  }

  console.log(`\n📊 Summary:`);
  console.log(`   ✅ Updated: ${updated}`);
  console.log(`   ❓ Still unknown: ${stillUnknown}`);
  console.log(`   📝 Total: ${result.rows.length}`);

  await db.end();
}

main().catch(console.error);
