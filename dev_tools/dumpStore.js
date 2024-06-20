/**
 * @fileoverview Script to retrieve and log the full store and transaction history from JSON files.
 * 
 * This script initializes a JSONStore instance, retrieves the full store,
 * ensures the transactions directory exists, reads all files in the transactions directory,
 * and processes each file to get its last transaction, logging the results to the console.
 */
const fs = require('fs-extra');
const path = require('path');
const { JSONStore } = require('../store/JSONStore');

const transactionsDir = path.join(__dirname, '..', 'data', 'transactions');

(async () => {
  const store = new JSONStore();
  try {
    const fullStore = await store.getFullStore();
    console.log(JSON.stringify(fullStore, null, 2));
  } catch (error) {
    console.error('Error dumping store:', error);
  }

  try {
    // Ensure the transactions directory exists
    await fs.ensureDir(transactionsDir);
    
    // Read all files in the transactions directory
    const files = await fs.readdir(transactionsDir);

    // Process each file to get its last transaction
    const transactions = {};
    for (const file of files) {
      const gamerAddress = path.basename(file, '.json');
      const lastTransaction = await store.getLastTransaction(gamerAddress);
      if (lastTransaction) {
        transactions[gamerAddress] = lastTransaction;
      }
    }

    console.log(JSON.stringify(transactions, null, 2));
  } catch (error) {
    console.error('Error dumping store:', error);
  }
})();
