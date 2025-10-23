import axios from 'axios';
import { decodeTransactionAction } from './src/utils/rpcDecoder';
import { getLiquidStakingActionMap } from './src/utils/abiActionExtractor';

const TX_ID = 'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7';
const CONTRACT = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

async function testCleanDecoder() {
  console.log('🧪 Testing Clean RPC Decoder\n');
  console.log(`Transaction: ${TX_ID}`);
  console.log(`Contract: ${CONTRACT}\n`);

  try {
    // Fetch transaction
    const txUrl = `https://reader.partisiablockchain.com/chain/shards/Shard2/transactions/${TX_ID}`;
    const response = await axios.get(txUrl, { timeout: 15000 });
    const tx = response.data;

    console.log('📥 Transaction fetched from blockchain\n');

    // Use the clean decoder
    console.log('🔍 Decoding with clean RPC decoder...');
    const actionId = decodeTransactionAction(tx.content, CONTRACT);

    if (actionId === null) {
      console.log('❌ Failed to decode action ID\n');
      return;
    }

    console.log(`✅ Action ID decoded: 0x${actionId.toString(16).padStart(2, '0')}\n`);

    // Map to action name
    const actionMap = getLiquidStakingActionMap();
    const actionName = actionMap[actionId];

    if (actionName) {
      console.log(`✅ Action Name: ${actionName}\n`);

      // Verify it matches blockchain browser
      console.log('📊 Verification:');
      console.log(`   Blockchain shows: "Accrue rewards"`);
      console.log(`   We decoded: "${actionName}"`);
      console.log(`   Match: ${actionName === 'accrueRewards' ? '✅ YES' : '❌ NO'}\n`);
    } else {
      console.log(`❌ Unknown action ID: 0x${actionId.toString(16)}\n`);
    }

    // Show all possible actions for reference
    console.log('📋 All possible actions:');
    Object.entries(actionMap).forEach(([id, name]) => {
      const idNum = parseInt(id);
      const marker = idNum === actionId ? ' ← MATCHED' : '';
      console.log(`   0x${idNum.toString(16).padStart(2, '0')}: ${name}${marker}`);
    });

  } catch (error: any) {
    console.error('❌ Error:', error.message);
  }
}

testCleanDecoder();
