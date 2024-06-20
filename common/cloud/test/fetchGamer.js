// test/fetchGamer.js
const assert = require('assert');
const getPlayerStats = require('../getPlayerStats');
const {PlayerStatsError} = require('../cloudErrors');

(async () => {
  // Test for a valid wallet address
  try {
    const walletAddr = '0x'; //put your address here
    const stats = await getPlayerStats(walletAddr);
    console.log('Test passed for valid wallet address');
    console.log(stats);  // Print the returned record
    assert.strictEqual(stats.wallet, walletAddr, 'Wallet addresses do not match');
    assert.strictEqual('win_rate' in stats, true, 'win_rate field does not exist');
    assert.strictEqual('wallet_created_at' in stats, true, 'wallet_created_at field does not exist');
  } catch (error) {
    console.error(`Test failed for valid wallet address: ${error.message}`);
    assert.fail(`Test failed for valid wallet address: ${error.message}`);
  }

  // Test for an invalid wallet address
  try {
    const invalidWalletAddr = '0xe8e1268c5a724231905d0735f041fcde1b0649e9';
    await getPlayerStats(invalidWalletAddr);
    console.error('Test failed for invalid wallet address: Expected an error but did not get one');
    assert.fail('Test failed for invalid wallet address: Expected an error but did not get one');
  } catch (error) {
    if (error instanceof PlayerStatsError) {
      console.log('Test passed for invalid wallet address');
      assert.strictEqual(error.message.includes('Failed to retrieve player stats') || error.message.includes('Server error'), true, 'Unexpected error message');
    } else {
      console.error(`Test failed for invalid wallet address: Unexpected error ${error}`);
      assert.fail(`Test failed for invalid wallet address: Unexpected error ${error}`);
    }
  }
})();
