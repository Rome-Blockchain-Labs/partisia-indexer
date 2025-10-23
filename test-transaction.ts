import axios from 'axios';

const TX_ID = 'aaa7919f199cc2c1a8b63dac2a4a5591e7c9e0b553f70794ffb5a83e4fe9b2b7';
const BLOCK_ID = 'f4cd376bb2ec5ad359c3257dec6b4031878d62c979ebc925c53a748d65dd16c5';
const CONTRACT = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';
const ADMIN = '000016e01e04096e52e0a6021e877f01760552abfb';

async function testTransaction() {
  console.log('🧪 Testing transaction indexing logic...\n');

  // Fetch transaction
  console.log(`📥 Fetching transaction: ${TX_ID}`);
  const txUrl = `https://reader.partisiablockchain.com/chain/shards/Shard2/transactions/${TX_ID}`;

  try {
    const txResponse = await axios.get(txUrl, { timeout: 15000 });
    const tx = txResponse.data;

    console.log(`✅ Transaction fetched`);
    console.log(`   Sender: ${tx.sender || 'N/A'}`);
    console.log(`   Block: ${tx.blockIdentifier || 'N/A'}`);
    console.log(`   Content length: ${(tx.content || '').length} bytes\n`);

    // Test relevance detection
    console.log('🔍 Testing relevance detection...');
    const content = tx.content || '';

    const contractBytes = Buffer.from(CONTRACT.replace(/^0x/, ''), 'hex');
    const adminBytes = Buffer.from(ADMIN.replace(/^0x/, ''), 'hex');

    let contentBuffer: Buffer;
    try {
      contentBuffer = Buffer.from(content, 'base64');
    } catch (e) {
      contentBuffer = Buffer.alloc(0);
    }

    const hasContractInContent = contentBuffer.includes(contractBytes);
    const hasAdminInContent = contentBuffer.includes(adminBytes);

    console.log(`   Contract in content: ${hasContractInContent}`);
    console.log(`   Admin in content: ${hasAdminInContent}`);
    console.log(`   Is relevant: ${hasContractInContent || hasAdminInContent}\n`);

    if (!hasContractInContent && !hasAdminInContent) {
      console.log('❌ Transaction would NOT be indexed (not relevant)');
      console.log('   This might be a payout transaction or wrong contract\n');

      // Check events
      const events = tx.executionStatus?.events || [];
      const eventsStr = JSON.stringify(events);
      console.log(`   Contract in events: ${eventsStr.includes(CONTRACT)}`);
      console.log(`   Admin in events: ${eventsStr.includes(ADMIN)}`);
      return;
    }

    console.log('✅ Transaction would be indexed\n');

    // Test action identification
    console.log('🔍 Testing action identification...');
    const contractIndex = contentBuffer.indexOf(contractBytes);
    console.log(`   Contract address found at byte: ${contractIndex}`);

    if (contractIndex > 0) {
      // Search wider range for action ID
      console.log(`   Searching for action ID 0x12 (accrue_rewards)...\n`);

      // Strategy 1: Check 5-15 bytes before contract
      const searchStart1 = Math.max(0, contractIndex - 15);
      const searchEnd1 = contractIndex - 5;

      console.log(`   Strategy 1: bytes ${searchStart1}-${searchEnd1}:`);
      for (let i = searchEnd1; i >= searchStart1; i--) {
        const byte = contentBuffer[i];
        if (byte === 0x12) {
          console.log(`   ✅ Found 0x12 at byte ${i}\n`);
          return;
        }
      }
      console.log(`   ❌ Not found in strategy 1\n`);

      // Strategy 2: Check 0-5 bytes before contract
      const searchStart2 = Math.max(0, contractIndex - 5);
      const searchEnd2 = contractIndex - 1;

      console.log(`   Strategy 2: bytes ${searchStart2}-${searchEnd2}:`);
      for (let i = searchEnd2; i >= searchStart2; i--) {
        const byte = contentBuffer[i];
        console.log(`   Byte[${i}]: 0x${byte.toString(16).padStart(2, '0')}`);
        if (byte === 0x12) {
          console.log(`   ✅ Found 0x12 at byte ${i}\n`);
          return;
        }
      }
      console.log(`   ❌ Not found in strategy 2\n`);

      // Strategy 3: Check common offsets
      const commonOffsets = [72, 78, 79, 80];
      console.log(`   Strategy 3: common offsets ${commonOffsets}:`);
      for (const offset of commonOffsets) {
        if (offset < contentBuffer.length) {
          const byte = contentBuffer[offset];
          console.log(`   Byte[${offset}]: 0x${byte.toString(16).padStart(2, '0')}`);
          if (byte === 0x12) {
            console.log(`   ✅ Found 0x12 at byte ${offset}\n`);
            return;
          }
        }
      }
      console.log(`   ❌ Not found in strategy 3\n`);

      // Strategy 4: Scan entire buffer for all action codes
      console.log(`   Strategy 4: scanning entire buffer (${contentBuffer.length} bytes)...`);
      const actionCodes = [0x11, 0x12, 0x13, 0x14, 0x15, 0x16, 0x17, 0x18, 0x19];
      for (let i = 0; i < contentBuffer.length; i++) {
        if (actionCodes.includes(contentBuffer[i])) {
          console.log(`   Found 0x${contentBuffer[i].toString(16).padStart(2, '0')} at byte ${i}`);
          console.log(`   Context: ${contentBuffer.slice(Math.max(0, i-10), i+10).toString('hex')}`);
        }
      }

      // Dump bytes 105-120 to see the area after contract
      console.log(`\n   Bytes 105-120 (contract ends at 109):`);
      for (let i = 105; i <= 120 && i < contentBuffer.length; i++) {
        console.log(`     [${i}]: 0x${contentBuffer[i].toString(16).padStart(2, '0')}`);
      }
    }

    console.log('\n✅ Test complete');

  } catch (error: any) {
    console.error('❌ Error fetching transaction:', error.message);

    if (error.response) {
      console.error('   Status:', error.response.status);
      console.error('   Data:', error.response.data);
    }
  }
}

testTransaction();
