// conditions/test/gamerBitsWithinMaxIdleTimeImpl.test.js
const assert = require('assert');
const { gamerBitsWithinMaxIdleTimeImpl } = require('../conditions');
const { InvalidParameterError} = require('../../cloud/cloudErrors');
const { JSONStore} = require('../../../store/JSONStore'); // Add the JSONStore import
const { JSONStoreError, JSONStoreTxHistoryError} = require('../../../store/storeErrors');


const ctx = {
  gamer: '0x' //put your address here
};

(async () => {
  const store = new JSONStore();

  // Setup: Ensure there is a transaction for the gamer
  await store.updateTransactionFile(ctx.gamer, 'holderAddress', Math.floor(Date.now() / 1000) - 2* 3600, true); // 2 hours ago

  // Test for a case where the test is expected to succeed
  try {
    const hours = '3'; // 3 hours, should not exceed
    const result = await gamerBitsWithinMaxIdleTimeImpl(ctx, hours);
    console.log('Test passed for expected success case');
    console.log('Result:', result);
    assert.strictEqual(result, true, 'Expected true but got false');
  } catch (error) {
    console.error(`Test failed for expected success case: ${error.message}`);
    assert.fail(`Test failed for expected success case: ${error.message}`);
  }

  // Test for a case where the test is expected to fail
  try {
    
    const hours = '1'; // 1 hours, should exceed
    const result = await gamerBitsWithinMaxIdleTimeImpl(ctx, hours); 
    assert.strictEqual(result, false, 'Expected false but got true');
  } catch (error) {
    if (error instanceof JSONStoreTxHistoryError) {
      console.log('Test passed for expected failure case');
    } else {
      console.error(`Test failed for expected failure case: Unexpected error ${error}`);
      assert.fail(`Test failed for expected failure case: Unexpected error ${error}`);
    }
  }

})();
