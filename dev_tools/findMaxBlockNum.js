/**
 * @fileoverview Script to find and log the largest block number from JSON store.
 * 
 * This script initializes a JSONStore instance, ensures the store is initialized,
 * retrieves the largest block number from the store, and logs the result to the console.
 */
const path = require('path');
const { JSONStore } = require('../store/JSONStore');

(async () => {
  try {
    const store = new JSONStore();
    await store.init(); // Ensure the store is initialized
    const maxBlockNum = await store.getLatestBlockNum();
    console.log(`The largest block number found is: ${maxBlockNum}`);
  } catch (error) {
    console.error(`Error finding the largest block number: ${error.message}`);
  }
})();
