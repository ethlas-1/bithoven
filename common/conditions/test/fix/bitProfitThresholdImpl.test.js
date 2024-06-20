const fs = require('fs-extra');
const assert = require('assert');
const sinon = require('sinon');
const { bitProfitThresholdImpl } = require('../conditions');
const { InvalidParameterError } = require('../../cloud/cloudErrors');
const { JSONStore } = require('../../../store/JSONStore');
const { ethers } = require('ethers');
const config = require('../../../config/chainConfig');

const provider = new ethers.providers.JsonRpcProvider(config.providerURL);

const ctx = {
  gamer: '0x', //put your address here
  holder: '0xholderAddress',
  blockNumber: null
};

(async () => {
  const store = new JSONStore();
  const holderPath = store.getHolderPath(ctx.holder);
  const archivePath = store.getArchivePath(ctx.holder, ctx.gamer);
  const transactionsPath = store.getTransactionFilePath(ctx.gamer);

  // Delete mock holder's directory from holders and archive directory
  await fs.remove(holderPath);
  await fs.remove(archivePath);
  await fs.remove(transactionsPath);

  // Fetch the latest block number
  const latestBlock = await provider.getBlock('latest');
  ctx.blockNumber = latestBlock.number;

  // Fetch the block for the mock data
  const mockBlockNumber = ctx.blockNumber - 1000;
  const mockBlock = await provider.getBlock(mockBlockNumber);

  const currentTime = Math.floor(Date.now() / 1000);
  const blockAgeInHours = (currentTime - mockBlock.timestamp) / 3600;

  // Create mock data with the block number
  const batch = {
    BlockNumOnWhichBitsWereBought: mockBlockNumber,
    InitialBatchAmount: 100,
    remainingBatchAmount: 50,
    purchasePrice: '5000000000000000000' // 5 ETH
  };

  await store.addHolder(ctx.holder);
  await store.addGamerBatch(ctx.holder, ctx.gamer, batch);

  // Mock getSellPrice to return a specific value for testing
  const mockSellPrice = ethers.BigNumber.from('60000000000000000'); // 6 ETH div by 100
  const getSellPrice = require('../../contractUtil/getSellPrice').getSellPrice;
  const getSellPriceStub = sinon.stub(require('../../contractUtil/getSellPrice'), 'getSellPrice').callsFake(async () => mockSellPrice);

  // Test for a case where the test is expected to succeed
  try {
    const percent = '10'; // 10% profit threshold
    const result = await bitProfitThresholdImpl(ctx, percent);
    console.log('Test passed for expected success case');
    console.log('Result:', result);
    assert.strictEqual(result, 50, 'Expected 50 but got different value');
  } catch (error) {
    console.error(`Test failed for expected success case: ${error.message}`);
    assert.fail(`Test failed for expected success case: ${error.message}`);
  }

  // Test for a case where the test is expected to fail
  try {
    const percent = '50'; // 50% profit threshold
    const result = await bitProfitThresholdImpl(ctx, percent);
    console.log('Test passed for expected failure case');
    console.log('Result:', result);
    assert.strictEqual(result, 0, 'Expected 0 but got different value');
  } catch (error) {
    console.error(`Test failed for expected failure case: ${error.message}`);
    assert.fail(`Test failed for expected failure case: ${error.message}`);
  }

  // Test for a case where the percent parameter is not an integer
  try {
    const percent = '24.5';  // A non-integer value to ensure the test fails
    const result = await bitProfitThresholdImpl(ctx, percent);
    console.error('Test failed for non-integer percent parameter: Expected an error but did not get one');
    assert.fail('Test failed for non-integer percent parameter: Expected an error but did not get one');
  } catch (error) {
    if (error instanceof InvalidParameterError) {
      console.log('Test passed for non-integer percent parameter');
      assert.strictEqual(error.message, 'The percent parameter must be a string representation of an integer', 'Unexpected error message');
    } else {
      console.error(`Test failed for non-integer percent parameter: Unexpected error ${error}`);
      assert.fail(`Test failed for non-integer percent parameter: Unexpected error ${error}`);
    }
  }

  // Restore original getSellPrice function
  getSellPriceStub.restore();
})();
