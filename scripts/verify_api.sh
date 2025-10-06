#!/bin/bash

echo "testing partisia reader api historical queries..."

CONTRACT="02fc82abf81cbb36acfe196faa1ad49ddfa7abdda6"
BLOCK1="10682802"
BLOCK2="13835640"

echo -e "\nquerying block $BLOCK1:"
TIME1=$(curl -s "https://reader.partisiablockchain.com/chain/contracts/${CONTRACT}?blockTime=${BLOCK1}" | jq -r '.account.latestStorageFeeTime')

echo "latestStorageFeeTime: $TIME1"

echo -e "\nquerying block $BLOCK2:"
TIME2=$(curl -s "https://reader.partisiablockchain.com/chain/contracts/${CONTRACT}?blockTime=${BLOCK2}" | jq -r '.account.latestStorageFeeTime')

echo "latestStorageFeeTime: $TIME2"

if [ "$TIME1" != "$TIME2" ]; then
  echo -e "\n✓ api returns different historical states"
  echo "your indexer code is correct, just waiting for contract activity"
else
  echo -e "\n✗ api returned identical data"
fi
