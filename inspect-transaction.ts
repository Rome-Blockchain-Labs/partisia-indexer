import axios from 'axios';
import { decodeTransactionAction } from './src/utils/rpcDecoder';
import { getLiquidStakingActionMap } from './src/utils/abiActionExtractor';

const TX_ID = 'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7';
const CONTRACT = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

async function inspectTransaction() {
  console.log('🔍 Deep Inspection of Transaction\n');
  console.log(`TX ID: ${TX_ID}\n`);

  try {
    // Fetch transaction
    const txUrl = `https://reader.partisiablockchain.com/chain/shards/Shard2/transactions/${TX_ID}`;
    const response = await axios.get(txUrl, { timeout: 15000 });
    const tx = response.data;

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 TRANSACTION METADATA');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    console.log(`Identifier: ${tx.identifier || 'N/A'}`);
    console.log(`Block ID: ${tx.blockIdentifier || 'N/A'}`);
    console.log(`Is Event: ${tx.isEvent || false}`);
    console.log(`Content Length: ${tx.content ? tx.content.length : 0} bytes (base64)\n`);

    // Execution status
    if (tx.executionStatus) {
      const status = tx.executionStatus;
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('⚡ EXECUTION STATUS');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

      console.log(`Success: ${status.success ? '✅ YES' : '❌ NO'}`);
      console.log(`Finalized: ${status.finalized || false}\n`);

      if (status.transactionCost) {
        const cost = status.transactionCost;
        console.log('💰 Gas Costs:');
        console.log(`   CPU: ${cost.cpu || 0}`);
        console.log(`   Remaining: ${cost.remaining || 0}`);
        console.log(`   Allocated for Events: ${cost.allocatedForEvents || 0}`);
        console.log(`   Paid by Contract: ${cost.paidByContract || 0}`);

        if (cost.networkFees) {
          console.log(`\n   Network Fees:`);
          Object.entries(cost.networkFees).forEach(([id, fee]) => {
            console.log(`      ${id.substring(0, 10)}...: ${fee}`);
          });
        }
        console.log();
      }

      if (status.events && status.events.length > 0) {
        console.log(`📤 Events Generated: ${status.events.length}`);
        status.events.forEach((event: any, i: number) => {
          console.log(`   Event ${i + 1}:`);
          console.log(`      Identifier: ${event.identifier || 'N/A'}`);
          console.log(`      Destination Shard: ${event.destinationShardId || 'N/A'}`);
        });
        console.log();
      }
    }

    // Decode content
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📦 TRANSACTION CONTENT');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    const contentBuffer = Buffer.from(tx.content, 'base64');
    console.log(`Raw Content (hex):`);
    console.log(`   ${contentBuffer.toString('hex')}\n`);

    // Find contract address
    const contractBytes = Buffer.from(CONTRACT, 'hex');
    const contractIndex = contentBuffer.indexOf(contractBytes);

    if (contractIndex >= 0) {
      console.log(`Contract Address Found:`);
      console.log(`   Position: byte ${contractIndex}`);
      console.log(`   Address: ${CONTRACT}\n`);
    }

    // Decode action
    const actionId = decodeTransactionAction(tx.content, CONTRACT);
    const actionMap = getLiquidStakingActionMap();
    const actionName = actionId ? actionMap[actionId] : null;

    if (actionId) {
      console.log(`Action Decoded:`);
      console.log(`   ID: 0x${actionId.toString(16).padStart(2, '0')}`);
      console.log(`   Name: ${actionName || 'unknown'}\n`);
    }

    // Try to find sender/caller in the content
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('👤 SENDER INFORMATION');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Known addresses to check
    const adminAddress = '000016e01e04096e52e0a6021e877f01760552abfb';
    const adminBytes = Buffer.from(adminAddress, 'hex');
    const adminIndex = contentBuffer.indexOf(adminBytes);

    if (adminIndex >= 0) {
      console.log(`✅ Admin Address Found:`);
      console.log(`   Position: byte ${adminIndex}`);
      console.log(`   Address: ${adminAddress}`);
      console.log(`   This is the staking responsible (admin)\n`);
    } else {
      console.log(`ℹ️  Admin address not found in transaction content\n`);
    }

    // Look for other addresses (21-byte sequences starting with 0x00 or 0x02)
    console.log('🔍 Other Addresses in Content:');
    const addressPattern = /^(00|02)[0-9a-f]{40}$/;
    for (let i = 0; i < contentBuffer.length - 20; i++) {
      const possibleAddress = contentBuffer.slice(i, i + 21).toString('hex');
      if (addressPattern.test(possibleAddress)) {
        if (possibleAddress !== CONTRACT && possibleAddress !== adminAddress) {
          console.log(`   Found at byte ${i}: ${possibleAddress}`);
        }
      }
    }

    // Decode arguments (the data after action ID)
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📊 ARGUMENTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    if (contractIndex >= 0 && actionId) {
      const contractEnd = contractIndex + 21;
      const actionOffset = contractEnd + 4;
      const argsStart = actionOffset + 1;

      if (argsStart < contentBuffer.length) {
        const argsBuffer = contentBuffer.slice(argsStart);
        console.log(`Arguments (hex): ${argsBuffer.toString('hex')}`);
        console.log(`Arguments (length): ${argsBuffer.length} bytes\n`);

        // For accrueRewards, the argument is stake_token_amount (u128)
        if (actionName === 'accrueRewards') {
          // Try to decode u128 (16 bytes big-endian)
          if (argsBuffer.length >= 16) {
            // Read as big-endian u128
            const high = argsBuffer.readBigUInt64BE(0);
            const low = argsBuffer.readBigUInt64BE(8);
            const amount = (high * BigInt('18446744073709551616')) + low;

            console.log(`Decoded stake_token_amount:`);
            console.log(`   Raw (wei): ${amount.toString()}`);
            console.log(`   Decimal: ${(Number(amount) / 1e18).toFixed(6)} MPC`);
            console.log(`   (Hex bytes: ${argsBuffer.slice(0, 16).toString('hex')})\n`);
          }
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
    }
  }
}

inspectTransaction();
