// conditions/test/gamerTotalBitsInCirculationImpl.test.js
const assert = require('assert');
const { gamerTotalBitsInCirculationImpl } = require('../conditions');
const { InvalidParameterError } = require('../../cloud/cloudErrors');
const { ethers } = require('ethers');
const cnf = require('../../../config/chainConfig');
const { getBitsSupply } = require('../../contractUtil/getBitsSupply');

const provider = new ethers.providers.JsonRpcProvider(cnf.providerURL);

(async () => {
  try {
    const latestBlockNumber = await provider.getBlockNumber();
    console.log('Latest block number:', latestBlockNumber);

    // Fetch player stats to get the gamer's address
    const gamerAddress = '0x' //put your address here

    const ctx = {
      gamer: gamerAddress,
      blockNumber: latestBlockNumber
    };

    // Fetch the actual supply of bits for the gamer
    const actualSupply = await getBitsSupply(ctx.gamer, ctx.blockNumber, provider, cnf.contractAddress);
    console.log(`Actual supply fetched: ${actualSupply.toString()}`);

    // Test for a case where the test is expected to succeed
    try {
      const operator = '>';
      const amount = actualSupply.div(2).toString();  // A small enough value to ensure the test passes
      const result = await gamerTotalBitsInCirculationImpl(ctx, operator, amount);
      console.log('Test passed for expected success case');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case: ${error.message}`);
      assert.fail(`Test failed for expected success case: ${error.message}`);
    }

    // Test for a case where the test is expected to fail
    try {
      const operator = '>';
      const amount = actualSupply.mul(2).toString();  // A large value to ensure the test fails
      const result = await gamerTotalBitsInCirculationImpl(ctx, operator, amount);
      assert.strictEqual(result, false, 'Expected false but got true');
      console.log('Test passed for expected failure case');
    } catch (error) {
      console.error(`Test failed for expected failure case: ${error.message}`);
      assert.fail(`Test failed for expected failure case: ${error.message}`);
    }

    // Test for a case where the amount parameter is not an integer
    try {
      const operator = '>';
      const amount = '500000.5';  // A non-integer value to ensure the test fails
      const result = await gamerTotalBitsInCirculationImpl(ctx, operator, amount);
      console.error('Test failed for non-integer amount parameter: Expected an error but did not get one');
      assert.fail('Test failed for non-integer amount parameter: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for non-integer amount parameter');
        assert.strictEqual(error.message, 'The amount parameter must be a string representation of an integer', 'Unexpected error message');
      } else {
        console.error(`Test failed for non-integer amount parameter: Unexpected error ${error}`);
        assert.fail(`Test failed for non-integer amount parameter: Unexpected error ${error}`);
      }
    }

    // Test for a case where the ctx object is missing required fields
    try {
      const invalidCtx = { ...ctx };
      delete invalidCtx.gamer;
      const operator = '>';
      const amount = actualSupply.div(2).toString();
      const result = await gamerTotalBitsInCirculationImpl(invalidCtx, operator, amount);
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

