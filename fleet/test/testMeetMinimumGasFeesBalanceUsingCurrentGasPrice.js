// fleet/test/testMeetMinimumGasFeesBalanceUsingCurrentGasPrice.js
const KeyFleet = require('../keyFleet');
const assert = require('assert');
const { sellGasLimit } = require('../../config/chainConfig');

(async () => {
  const keyFleet = new KeyFleet();

  console.log('Testing KeyFleet - meetMinimumGasFeesBalanceUsingCurrentGasPrice...');

  // Test case: sufficient balance
  try {
    const fleetAddress = '0xYourFleetAddressWithSufficientBalance';

    const result = await keyFleet.meetMinimumGasFeesBalanceUsingCurrentGasPrice(fleetAddress, sellGasLimit);
    assert.strictEqual(result, true, 'Expected the balance to be sufficient to cover gas fees');
    console.log('Test passed: sufficient balance');
  } catch (error) {
    console.error('Test failed: sufficient balance', error);
  }

  // Test case: insufficient balance
  try {
    const fleetAddress = '0xYourFleetAddressWithInsufficientBalance';

    const result = await keyFleet.meetMinimumGasFeesBalanceUsingCurrentGasPrice(fleetAddress, sellGasLimit);
    assert.strictEqual(result, false, 'Expected the balance to be insufficient to cover gas fees');
    console.log('Test passed: insufficient balance');
  } catch (error) {
    console.error('Test failed: insufficient balance', error);
  }
})();
