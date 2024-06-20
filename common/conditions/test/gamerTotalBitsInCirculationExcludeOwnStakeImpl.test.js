// conditions/test/gamerTotalBitsInCirculationExcludeOwnStakeImpl.test.js
const assert = require('assert');
const { gamerTotalBitsInCirculationExcludeOwnStakeImpl } = require('../conditions');
const { InvalidParameterError } = require('../../cloud/cloudErrors');
const { ethers } = require('ethers');
const cnf = require('../../../config/chainConfig');
const { getBitsSupply } = require('../../contractUtil/getBitsSupply');
const KeyFleet = require('../../../fleet/keyFleet');
const TradeUtil = require('../../trade/tradeUtil');

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
    const actualSupply = await getBitsSupply(ctx.gamer, provider, cnf.contractAddress);
    console.log(`Actual supply fetched: ${actualSupply.toString()}`);

    // Mock data for key fleet
    const keyFleet = new KeyFleet();
    const holderAddresses = keyFleet.getAllAddresses();
    let totalBitBalanceInKeyFleet = ethers.BigNumber.from(0);

    for (const holderAddress of holderAddresses) {
      const bitBalance = await TradeUtil.getBitBalanceInStore(holderAddress, gamerAddress);
      totalBitBalanceInKeyFleet = totalBitBalanceInKeyFleet.add(ethers.BigNumber.from(bitBalance));
    }

    // Calculate adjusted supply
    let adjustedSupply = actualSupply.sub(totalBitBalanceInKeyFleet);
    if (adjustedSupply.isNegative()) {
      adjustedSupply = ethers.BigNumber.from(0);
    }

    // Test for a case where the test is expected to succeed
    try {
      const operator = '<';
      const amount = adjustedSupply.div(2).toString();  // A small enough value to ensure the test passes
      const result = await gamerTotalBitsInCirculationExcludeOwnStakeImpl(ctx, operator, "2");
      console.log('Test passed for expected success case!');
      console.log('Result:', result);
      assert.strictEqual(result, true, 'Expected true but got false');
    } catch (error) {
      console.error(`Test failed for expected success case: ${error.message}`);
      assert.fail(`Test failed for expected success case: ${error.message}`);
    }

    // Test for a case where the test is expected to fail
    try {
      const operator = '>';
      const amount = adjustedSupply.mul(2).toString();  // A large value to ensure the test fails
      const result = await gamerTotalBitsInCirculationExcludeOwnStakeImpl(ctx, operator, amount);
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
      const result = await gamerTotalBitsInCirculationExcludeOwnStakeImpl(ctx, operator, amount);
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
      const amount = adjustedSupply.div(2).toString();
      const result = await gamerTotalBitsInCirculationExcludeOwnStakeImpl(invalidCtx, operator, amount);
      console.error('Test failed for missing ctx.gamer field: Expected an error but did not get one');
      assert.fail('Test failed for missing ctx.gamer field: Expected an error but did not get one');
    } catch (error) {
      if (error instanceof InvalidParameterError) {
        console.log('Test passed for missing ctx.gamer field');
        assert.strictEqual(error.message, 'The ctx object must have gamer field', 'Unexpected error message');
      } else {
        console.error(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
        assert.fail(`Test failed for missing ctx.gamer field: Unexpected error ${error}`);
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
})();
