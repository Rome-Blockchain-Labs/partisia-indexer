// Sept 1, 2025 accrueRewards transaction
const txContent = 'AQAAAAIAAAADAAAAAQAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAAAAFQAAAHBhcnRpc2lhLWJ1aWx0LWluLXJwYwAAAA8AAAB1bmtub3duLWZvcm1hdAAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAECAAAAAQAAAAFHAAAAAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAEAAAAVAAAAMDJmYzgyYWJmODFjYmIzNmFjZmUxOTZmYWExYWQ0OWRkZmE3YWJkZGE2AAAAAgAAAAMAAABjYWwAAAABAAAAAQAAAAEAAABZAgBQCgAAABIAAAAAAAAAAAAAAAAAAAABAAAAAQ==';

const contract = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

const contentBuffer = Buffer.from(txContent, 'base64');
const contractBytes = Buffer.from(contract.replace(/^0x/, ''), 'hex');

console.log('Content buffer length:', contentBuffer.length);
console.log('Contract bytes:', contractBytes.toString('hex'));

// Find contract address
const contractIndex = contentBuffer.indexOf(contractBytes);
console.log('Contract found at index:', contractIndex);

if (contractIndex >= 0) {
  const contractEnd = contractIndex + contractBytes.length;
  console.log('Contract ends at:', contractEnd);

  // Show bytes around action ID location
  const actionOffset = contractEnd + 4;
  console.log('Action offset:', actionOffset);

  if (actionOffset < contentBuffer.length) {
    console.log('\nBytes around action:');
    for (let i = Math.max(0, contractEnd - 2); i < Math.min(contentBuffer.length, actionOffset + 20); i++) {
      const marker = i === actionOffset ? ' <-- ACTION' : (i === actionOffset + 1 ? ' <-- ARGS START' : '');
      console.log(`  [${i}]: 0x${contentBuffer[i].toString(16).padStart(2, '0')}${marker}`);
    }

    const actionId = contentBuffer[actionOffset];
    console.log(`\nAction ID: 0x${actionId.toString(16)} (expected 0x12 for accrueRewards)`);

    // Try to read the argument
    const argsOffset = actionOffset + 1;
    if (argsOffset + 16 <= contentBuffer.length) {
      const argBytes = contentBuffer.slice(argsOffset, argsOffset + 16);
      console.log('\nArgument bytes (16 bytes for u128):');
      console.log('  Hex:', argBytes.toString('hex'));

      // Try parsing as BigInt
      const { AbiByteInput } = require('@partisiablockchain/abi-client');
      const input = AbiByteInput.createBigEndian(argBytes);
      const value = input.readUnsignedBigInteger(16);
      console.log('  Value:', value.toString());
      console.log('  Human readable:', (Number(value) / 10000).toFixed(4), 'MPC');
    } else {
      console.log('\n❌ Not enough bytes for u128 argument');
    }
  }
}
