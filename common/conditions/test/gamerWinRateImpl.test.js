// conditions/test/gamerWinRateImpl.test.js
const assert = require('assert');
const { gamerWinRateImpl } = require('../conditions');
const { InvalidParameterError, PlayerStatsError } = require('../../cloud/cloudErrors');
const { ethers } = require('ethers');
const cnf = require('../../../config/chainConfig');

const provider = new ethers.providers.JsonRpcProvider(cnf.providerURL);

const ctx = {
  gamer: '0x' //put your address here
};

(async () => {
  try {
    const latestBlockNumber = await provider.getBlockNumber();
    console.log('Latest block number:', latestBlockNumber);

    // Setting up a context with win_rate
    const ctxWithWinRate = {
      ...ctx,
      win_rate: 50 // Example win rate
    };

    // Test for a case where the test is expected to succeed using ctx.win_rate
    try {
      const operator = '>';
      const winRate = '25';  // A small enough value to ensure the test passes
      const result = await gamerWinRateImpl(ctxWithWinRate, operator, winRate);
      console.log('Test passed for expected success case with ctx.win_rate');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case with ctx.win_rate: ${error.message}`);
      assert.fail(`Test failed for expected success case with ctx.win_rate: ${error.message}`);
    }

    // Test for a case where the test is expected to fail using ctx.win_rate
    try {
      const operator = '>';
      const winRate = '75';  // A large value to ensure the test fails
      const result = await gamerWinRateImpl(ctxWithWinRate, operator, winRate);
      assert.strictEqual(result, false, 'Expected false but got true');
      console.log('Test passed for expected failure case with ctx.win_rate');
    } catch (error) {
      console.error(`Test failed for expected failure case with ctx.win_rate: ${error.message}`);
      assert.fail(`Test failed for expected failure case with ctx.win_rate: ${error.message}`);
    }

    // Test for a case where the test is expected to succeed using API call
    try {
      const operator = '>';
      const winRate = '25';  // A small enough value to ensure the test passes
      const result = await gamerWinRateImpl(ctx, operator, winRate);
      console.log('Test passed for expected success case using API call');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case using API call: ${error.message}`);
      assert.fail(`Test failed for expected success case using API call: ${error.message}`);
    }

    // Test for a case where the test is expected to fail using API call
    try {
      const operator = '>';
      const winRate = '75';  // A large value to ensure the test fails
      const result = await gamerWinRateImpl(ctx, operator, winRate);
      assert.strictEqual(result, false, 'Expected false but got true');
      console.log('Test passed for expected failure case using API call');
    } catch (error) {
      console.error(`Test failed for expected failure case using API call: ${error.message}`);
      assert.fail(`Test failed for expected failure case using API call: ${error.message}`);
    }

    // Test for a case where the winRate parameter is not an integer
    try {
      const operator = '>';
      const winRate = '50.5';  // A non-integer value to ensure the test fails
      const result = await gamerWinRateImpl(ctx, operator, winRate);
      console.error('Test failed for non-integer winRate parameter: Expected an error but did not get one');
      assert.fail('Test failed for non-integer winRate parameter: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for non-integer winRate parameter');
        assert.strictEqual(error.message, 'The winRate parameter must be a string representation of an integer', 'Unexpected error message');
      } else {
        console.error(`Test failed for non-integer winRate parameter: Unexpected error ${error}`);
        assert.fail(`Test failed for non-integer winRate parameter: Unexpected error ${error}`);
      }
    }

    // Test for a case where the ctx object is missing required fields
    try {
      const invalidCtx = { ...ctx };
      delete invalidCtx.gamer;
      const operator = '>';
      const winRate = '25';
      const result = await gamerWinRateImpl(invalidCtx, operator, winRate);
      console.error('Test failed for missing ctx.gamer field: Expected an error but did not get one');
      assert.fail('Test failed for missing ctx.gamer field: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for missing ctx.gamer field');
        assert.strictEqual(error.message, 'The ctx object must have a gamer field', 'Unexpected error message');
      } else {
        console.error(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
        assert.fail(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
      }
    }

    // Test for a case where the ctx object does not have win_rate
    try {
      const operator = '>';
      const winRate = '0';  // A small enough value to ensure the test passes
      const result = await gamerWinRateImpl(ctx, operator, winRate);
      console.log('Test passed for expected success case without ctx.win_rate');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case without ctx.win_rate: ${error.message}`);
      assert.fail(`Test failed for expected success case without ctx.win_rate: ${error.message}`);
    }

    // Test for a case where the ctx object does not have win_rate and test is expected to fail
    try {
      const operator = '>';
      const winRate = '100';  // A large value to ensure the test fails
      const result = await gamerWinRateImpl(ctx, operator, winRate);
      assert.strictEqual(result, false, 'Expected false but got true');
      console.log('Test passed for expected failure case without ctx.win_rate');
    } catch (error) {
      console.error(`Test failed for expected failure case without ctx.win_rate: ${error.message}`);
      assert.fail(`Test failed for expected failure case without ctx.win_rate: ${error.message}`);
    }

  } catch (error) {
    console.error('Unexpected error:', error);
  }
})();
