const axios = require('axios');
const abi = require('./src/abi/liquid_staking');

async function test() {
  const response = await axios.get('http://95.216.235.72:18080/chain/contracts/02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6?blockTime=10683000');
  const serialized = response.data.serializedContract;
  console.log('Has serialized data:', !!serialized);
  
  if (serialized) {
    const state = abi.deserializeState(Buffer.from(serialized, 'base64'));
    console.log('\nDeserialized state:');
    console.log('totalPoolStakeToken:', state.totalPoolStakeToken?.toString());
    console.log('totalPoolLiquid:', state.totalPoolLiquid?.toString());
    console.log('stakeTokenBalance:', state.stakeTokenBalance?.toString());
    console.log('buyInPercentage:', state.buyInPercentage?.toString());
    console.log('buyInEnabled:', state.buyInEnabled);
    
    const stakeAmount = BigInt(state.totalPoolStakeToken?.toString() || '0');
    const liquidAmount = BigInt(state.totalPoolLiquid?.toString() || '0');
    const stakeBalance = BigInt(state.stakeTokenBalance?.toString() || '0');
    console.log('\nConverted to BigInt:');
    console.log('stakeAmount:', stakeAmount.toString());
    console.log('liquidAmount:', liquidAmount.toString());
    console.log('stakeBalance:', stakeBalance.toString());
    console.log('All zero?', stakeAmount === 0n && liquidAmount === 0n && stakeBalance === 0n);
  }
}

test().catch(console.error);
