import { getLiquidStakingActionMap } from './src/utils/abiActionExtractor';

const txContent = 'AQAAAAIAAAADAAAAAQAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAAVAAAAcGFydGlzaWEtYnVpbHQtaW4tcnBjAAAAFQAAAHBhcnRpc2lhLWJ1aWx0LWluLXJwYwAAAA8AAAB1bmtub3duLWZvcm1hdAAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAECAAAAAQAAAAFHAAAAAgAAABUAAABwYXJ0aXNpYS1idWlsdC1pbi1ycGMAAAABAAAAAQAAAAEAAAAVAAAAMDJmYzgyYWJmODFjYmIzNmFjZmUxOTZmYWExYWQ0OWRkZmE3YWJkZGE2AAAAAgAAAAMAAABjYWwAAAABAAAAAQAAAAEAAABZAgBQCgAAABIAAAAAAAAAAAAAAAAAAAABAAAAAQ==';
const contract = '02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6';

const buffer = Buffer.from(txContent, 'base64');
const contractAscii = Buffer.from(contract, 'ascii');
const actionMap = getLiquidStakingActionMap();

console.log('Action map:');
console.log(actionMap);
console.log('');

console.log('Looking for contract (ASCII):', contract);
console.log('Contract found at:', buffer.indexOf(contractAscii));
console.log('');

console.log('Searching for action bytes...');
const validActionIds = Object.keys(actionMap).map(k => parseInt(k));
console.log('Valid action IDs:', validActionIds.map(id => `0x${id.toString(16)}`).join(', '));
console.log('');

const contractIdx = buffer.indexOf(contractAscii);

for (let i = 0; i < buffer.length; i++) {
  const byte = buffer[i];

  if (validActionIds.includes(byte)) {
    const isAfterContract = contractIdx >= 0 && contractIdx < i;
    const action = actionMap[byte];
    console.log(`Found 0x${byte.toString(16).padStart(2, '0')} at index ${i} (${action}) - after contract: ${isAfterContract}`);
  }
}

// Specifically look for 0x12 (accrueRewards)
console.log('');
console.log('Looking specifically for 0x12 (accrueRewards)...');
for (let i = 0; i < buffer.length; i++) {
  if (buffer[i] === 0x12) {
    console.log(`Found 0x12 at index ${i}`);
    console.log('Context:');
    for (let j = Math.max(0, i - 5); j < Math.min(buffer.length, i + 20); j++) {
      const marker = j === i ? ' <-- 0x12' : '';
      console.log(`  [${j}]: 0x${buffer[j].toString(16).padStart(2, '0')}${marker}`);
    }
  }
}
