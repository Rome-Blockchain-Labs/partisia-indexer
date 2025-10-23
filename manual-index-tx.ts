import axios from 'axios';
import db from './src/db/client';
import { getLiquidStakingActionMap, isLiquidStakingAction } from './src/utils/abiActionExtractor';

const TX_ID = 'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7';
const BLOCK_ID = 'f4cd376bb2ec5ad359c3257dec6b4031878d62c979ebc925c53a748d65dd16c5';
const CONTRACT = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

async function identifyTransactionAction(tx: any): Promise<string | null> {
  const content = tx.content || '';
  if (!content) return 'unknown';

  try {
    const contentBuffer = Buffer.from(content, 'base64');
    const actionMap = getLiquidStakingActionMap();
    const contractBytes = Buffer.from(CONTRACT.replace(/^0x/, ''), 'hex');
    const contractIndex = contentBuffer.indexOf(contractBytes);

    console.log('Action identification:');
    console.log(`  Contract index: ${contractIndex}`);
    console.log(`  Buffer length: ${contentBuffer.length}`);

    // Strategy 4: Check specific offset after contract (contractEnd + 4)
    if (contractIndex >= 0) {
      const contractEnd = contractIndex + contractBytes.length;
      const actionOffset = contractEnd + 4;

      console.log(`  Strategy 4: Checking offset ${actionOffset} (contractEnd + 4)`);

      if (actionOffset < contentBuffer.length) {
        const byte = contentBuffer[actionOffset];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          console.log(`  ✅ Found ${actionMap[byte]} (0x${byte.toString(16)}) at byte ${actionOffset}`);
          return actionMap[byte];
        }
        console.log(`  Byte at ${actionOffset}: 0x${byte.toString(16)} (not LS action)`);
      }
    }

    // Strategy 5: Search broadly (fallback)
    if (contractIndex >= 0) {
      const searchStart = Math.max(0, contractIndex - 30);
      const contractEnd = contractIndex + contractBytes.length;
      const searchEnd = Math.min(contentBuffer.length, contractEnd + 40);
      const actionOffset = contractEnd + 4;

      console.log(`  Strategy 5: Fallback search ${searchStart}-${searchEnd} (skipping contract and offset)`);

      // Search BEFORE the contract address
      for (let i = searchStart; i < contractIndex; i++) {
        const byte = contentBuffer[i];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          console.log(`  ✅ Found ${actionMap[byte]} (0x${byte.toString(16)}) at byte ${i} (before contract)`);
          return actionMap[byte];
        }
      }

      // Search AFTER the contract address
      for (let i = contractEnd; i < searchEnd; i++) {
        if (i === actionOffset) continue;
        const byte = contentBuffer[i];
        if (isLiquidStakingAction(byte) && actionMap[byte]) {
          console.log(`  ✅ Found ${actionMap[byte]} (0x${byte.toString(16)}) at byte ${i} (after contract)`);
          return actionMap[byte];
        }
      }
    }

    // Last resort: scan entire buffer
    console.log(`  Strategy 5: Scanning entire buffer`);
    for (let i = 0; i < contentBuffer.length; i++) {
      const byte = contentBuffer[i];
      if (actionMap[byte]) {
        console.log(`  ✅ Found ${actionMap[byte]} (0x${byte.toString(16)}) at byte ${i}`);
        return actionMap[byte];
      }
    }

    return 'unknown';
  } catch (error) {
    console.warn('Error decoding transaction action:', error);
    return 'unknown';
  }
}

async function manualIndex() {
  console.log('🧪 Manually indexing transaction...\n');

  // 1. Fetch block to get block number and timestamp
  console.log(`📥 Fetching block: ${BLOCK_ID}`);
  const blockUrl = `https://reader.partisiablockchain.com/chain/shards/Shard2/blocks/${BLOCK_ID}`;

  try {
    const blockResponse = await axios.get(blockUrl, { timeout: 15000 });
    const block = blockResponse.data;

    const blockNumber = block.blockTime;
    const blockTimestamp = new Date(block.productionTime);

    console.log(`✅ Block fetched`);
    console.log(`   Block number: ${blockNumber}`);
    console.log(`   Timestamp: ${blockTimestamp.toISOString()}\n`);

    // 2. Fetch transaction
    console.log(`📥 Fetching transaction: ${TX_ID}`);
    const txUrl = `https://reader.partisiablockchain.com/chain/shards/Shard2/transactions/${TX_ID}`;
    const txResponse = await axios.get(txUrl, { timeout: 15000 });
    const tx = txResponse.data;

    console.log(`✅ Transaction fetched\n`);

    // 3. Identify action
    console.log(`🔍 Identifying action...`);
    const action = await identifyTransactionAction(tx) || 'unknown';
    console.log(`   Action: ${action}\n`);

    // 4. Store in database
    console.log(`💾 Storing in database...`);
    await db.query(
      `INSERT INTO transactions (tx_hash, block_number, timestamp, action, sender, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (tx_hash) DO UPDATE SET
         action = EXCLUDED.action,
         metadata = EXCLUDED.metadata`,
      [
        TX_ID,
        blockNumber,
        blockTimestamp,
        action,
        'unknown',
        JSON.stringify({
          isSuccess: tx.executionStatus?.success || false,
          executionStatus: tx.executionStatus,
          isEvent: tx.isEvent || false,
          contentLength: (tx.content || '').length,
          manuallyIndexed: true
        })
      ]
    );

    console.log(`✅ Transaction stored successfully!\n`);

    // 5. Verify
    const result = await db.query(
      'SELECT tx_hash, action, block_number, timestamp FROM transactions WHERE tx_hash = $1',
      [TX_ID]
    );

    console.log(`✅ Verification:`);
    console.log(`   Found in DB: ${result.rows.length > 0}`);
    if (result.rows.length > 0) {
      const row = result.rows[0];
      console.log(`   Action: ${row.action}`);
      console.log(`   Block: ${row.block_number}`);
      console.log(`   Timestamp: ${row.timestamp}`);
    }

    await db.end();

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.status);
    }
    await db.end();
    process.exit(1);
  }
}

manualIndex();
