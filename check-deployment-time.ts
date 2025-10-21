const axios = require('axios');

async function getBlockTime() {
  try {
    const response = await axios.get('http://95.216.235.72:18080/blockchain/blocks/Shard2/10682802');
    const blockTime = response.data.blockTime;
    const date = new Date(blockTime);
    console.log('Block time (Unix ms):', blockTime);
    console.log('Block time (ISO):', date.toISOString());
    console.log('Block time (readable):', date.toString());
  } catch (error) {
    console.error('Error:', error.message);
  }
}

getBlockTime();
