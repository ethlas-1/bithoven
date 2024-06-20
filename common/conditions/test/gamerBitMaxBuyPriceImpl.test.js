// conditions/test/gamerBitWithinMaxBuyPriceImpl.test.js
const assert = require('assert');
const { gamerBitWithinMaxBuyPriceImpl } = require('../conditions');
const { InvalidParameterError } = require('../../cloud/cloudErrors');
const { ethers } = require('ethers');
const cnf = require('../../../config/chainConfig');
const abi = require('../../../abi/GambitBitsV3ABI.json');

const provider = new ethers.providers.JsonRpcProvider(cnf.providerURL);

const ctx = {
  gamer: '0x' //put your address here
};

(async () => {
  try {
    const latestBlockNumber = await provider.getBlockNumber();
    console.log('Latest block number:', latestBlockNumber);

    ctx.blockNumber = latestBlockNumber;

    const contract = new ethers.Contract(cnf.contractAddress, abi, provider);

    // Fetch the actual buy price dynamically
    const actualBuyPrice = await contract.getBuyPrice(ctx.gamer, 1, { blockTag: latestBlockNumber });
    console.log(`Actual buy price fetched: ${actualBuyPrice.toString()}`);

    // Test for a case where the test is expected to succeed
    try {
      const price = ethers.utils.formatEther(actualBuyPrice.add(ethers.utils.parseEther('0.1')));  // Slightly more than the actual price
      const result = await gamerBitWithinMaxBuyPriceImpl(ctx, price);
      console.log('Test passed for expected success case');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case: ${error.message}`);
      assert.fail(`Test failed for expected success case: ${error.message}`);
    }

    // Test for a case where the test is expected to fail
    try {
      const price = ethers.utils.formatEther(actualBuyPrice.sub(ethers.utils.parseEther('0.1')));  // Slightly less than the actual price
      const result = await gamerBitWithinMaxBuyPriceImpl(ctx, price);
      assert.strictEqual(result, false, 'Expected false but got true');
      console.log('Test passed for expected failure case');
    } catch (error) {
      console.error(`Test failed for expected failure case: ${error.message}`);
      assert.fail(`Test failed for expected failure case: ${error.message}`);
    }

    // Test for a case where the price parameter is not a number
    try {
      const price = 'abc';  // A non-numeric value to ensure the test fails
      const result = await gamerBitWithinMaxBuyPriceImpl(ctx, price);
      console.error('Test failed for non-numeric price parameter: Expected an error but did not get one');
      assert.fail('Test failed for non-numeric price parameter: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for non-numeric price parameter');
        assert.strictEqual(error.message, 'The price parameter must be a string representation of a number', 'Unexpected error message');
      } else {
        console.error(`Test failed for non-numeric price parameter: Unexpected error ${error}`);
        assert.fail(`Test failed for non-numeric price parameter: Unexpected error ${error}`);
      }
    }

    // Test for a case where the ctx object is missing required fields
    try {
      const invalidCtx = { ...ctx };
      delete invalidCtx.gamer;
      const price = '1';
      const result = await gamerBitWithinMaxBuyPriceImpl(invalidCtx, price);
      console.error('Test failed for missing ctx.gamer field: Expected an error but did not get one');
      assert.fail('Test failed for missing ctx.gamer field: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for missing ctx.gamer field');
        assert.strictEqual(error.message, 'The ctx object must have gamer and blockNumber fields', 'Unexpected error message');
      } else {
        console.error(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
        assert.fail(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
})();
