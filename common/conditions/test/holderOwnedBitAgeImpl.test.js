const fs = require('fs-extra');
const assert = require('assert');
const { holderOwnedBitAgeImpl } = require('../conditions');
const { InvalidParameterError } = require('../../cloud/cloudErrors');
const { JSONStore } = require('../../../store/JSONStore');
const { ethers } = require('ethers');
const config = require('../../../config/chainConfig');

const provider = new ethers.providers.JsonRpcProvider(config.providerURL);

const ctx = {
  gamer: '0x', //put your address here
  holder: '0xholderAddress'
};

(async () => {
  const store = new JSONStore();
  const holderPath = store.getHolderPath(ctx.holder);
  const archivePath = store.getArchivePath(ctx.holder, ctx.gamer);

  // Delete mock holder's directory from holders and archive directory
  await fs.remove(holderPath);
  await fs.remove(archivePath);

  // Fetch the latest block number
  const latestBlock = await provider.getBlock('latest');
  const latestBlockNumber = latestBlock.number;

  // Fetch a block for the mock data
  const mockBlockNumber = latestBlockNumber - 5000;
  const mockBlock = await provider.getBlock(mockBlockNumber);

  const currentTime = Math.floor(Date.now() / 1000);
  const blockAgeInMinutes = (currentTime - mockBlock.timestamp) / 60;

  // Create mock data with the block number
  const batch = {
    BlockNumOnWhichBitsWereBought: mockBlockNumber,
    InitialBatchAmount: 100,
    remainingBatchAmount: 50,
    purchasePrice: '5000000000000000000' // 5 ETH
  };

  await store.addHolder(ctx.holder);
  await store.addGamerBatch(ctx.holder, ctx.gamer, batch);

  // Test for a case where the test is expected to succeed
  try {
    const operator = '>';
    const ageInMinutes = Math.floor(blockAgeInMinutes) - 1;  // Slightly less than the block age to ensure the test passes
    console.log("ageInMinutes= " + ageInMinutes)
    const result = await holderOwnedBitAgeImpl(ctx, operator, ageInMinutes.toString());
    console.log('Test passed for expected success case');
    console.log('Result:', result);
    assert.strictEqual(result, 50, 'Expected 50 but got different value');
  } catch (error) {
    console.error(`Test failed for expected success case: ${error.message}`);
    assert.fail(`Test failed for expected success case: ${error.message}`);
  }

  // Test for a case where the test is expected to fail
  try {
    const operator = '>';
    const ageInMinutes = Math.floor(blockAgeInMinutes) + 1;  // Slightly more than the block age to ensure the test fails
    const result = await holderOwnedBitAgeImpl(ctx, operator, ageInMinutes.toString());
    console.log('Test passed for expected failure case');
    console.log('Result:', result);
    assert.strictEqual(result, 0, 'Expected 0 but got different value');
  } catch (error) {
    console.error(`Test failed for expected failure case: ${error.message}`);
    assert.fail(`Test failed for expected failure case: ${error.message}`);
  }

})();
