
// conditions/test/gamerWithinMaxAgeImpl.test.js
const assert = require('assert');
const { gamerWithinMaxAgeImpl } = require('../conditions');
const { PlayerStatsError, InvalidParameterError } = require('../../cloud/cloudErrors');

const referenceGamerCreationTime = "2024-06-07T09:01:48.907Z";
const ctx = {
  gamer: '0x' //put your address here
};

(async () => {
  const referenceTime = new Date(referenceGamerCreationTime);
  const currentTime = new Date();

  // Calculate the difference in minutes
  const differenceInMinutes = Math.floor((currentTime - referenceTime) / 1000 / 60);

  // Test for a case where the test is expected to succeed
  try {
    const minutes = (differenceInMinutes + 1).toString();  // A value slightly larger to ensure the test passes
    const result = await gamerWithinMaxAgeImpl(ctx, minutes);
    console.log('Test passed for expected success case');
    console.log('Result:', result);
    assert.strictEqual(result, true, 'Expected true but got false');
  } catch (error) {
    console.error(`Test failed for expected success case: ${error.message}`);
    assert.fail(`Test failed for expected success case: ${error.message}`);
  }

  // Test for a case where the test is expected to fail
  try {
    const minutes = (differenceInMinutes - 1).toString();  // A value slightly smaller to ensure the test fails
    const result = await gamerWithinMaxAgeImpl(ctx, minutes);
    assert.strictEqual(result, false, 'Expected false but got true');
    console.log('Test passed for expected failure case');
  } catch (error) {
    console.error(`Test failed for expected failure case: ${error.message}`);
    assert.fail(`Test failed for expected failure case: ${error.message}`);
  }

})();
