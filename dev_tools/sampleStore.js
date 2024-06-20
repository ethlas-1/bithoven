/**
 * @fileoverview Script to test JSONStore functionality.
 * 
 * This script initializes a JSONStore instance, performs various operations such as adding holders,
 * adding gamer batches, and updating gamer batches, and performs assertions to verify the correct behavior.
 */
const assert = require('assert');
const fs = require('fs-extra');
const BigNumber = require('bignumber.js');
const { JSONStore, JSONStoreError } = require('../store/JSONStore');

const store = new JSONStore();

(async () => {
  const holderAddress = '0x5F4Cd212FFFFFFfB986567FEB709fF54235FB018';
  const gamerAddress1 = '0xF1234567890abcdef1234567890abcdef1234567';
  const gamerAddress2 = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd';

  // Remove the holder directory for a fresh run of this script.
  // Normally, this would not be done on the actual data store.
  try {
    const holderPath = store.getHolderPath(holderAddress);
    await fs.remove(holderPath);
  } catch (error) {
    console.error('Failed to remove holder directory:', error);
    assert.fail('Removing holder directory failed');
  }

  try {
    await store.addHolder(holderAddress);
  } catch (error) {
    console.error('Failed to add holder:', error);
    assert.fail('Adding holder failed');
  }

  const batch1Gamer1 = {
    InitialBatchAmount: 12,
    remainingBatchAmount: 12,
    purchasePrice: '1200',  // in wei units
    BlockNumOnWhichBitsWereBought: 45435,
  };

  try {
    await store.addGamerBatch(holderAddress, gamerAddress1, batch1Gamer1);
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
      assert.fail(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  const batch2Gamer1 = {
    InitialBatchAmount: 15,
    remainingBatchAmount: 15,
    purchasePrice: '1800',  // in wei units (price per bit is 120, which is equal to the first batch)
    BlockNumOnWhichBitsWereBought: 45440,
  };

  try {
    await store.addGamerBatch(holderAddress, gamerAddress1, batch2Gamer1);
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
      assert.fail(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  const batch1Gamer2 = {
    InitialBatchAmount: 10,
    remainingBatchAmount: 10,
    purchasePrice: '1000',  // in wei units (price per bit is 100)
    BlockNumOnWhichBitsWereBought: 45430,
  };

  try {
    await store.addGamerBatch(holderAddress, gamerAddress2, batch1Gamer2);
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
      assert.fail(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  const batch2Gamer2 = {
    InitialBatchAmount: 20,
    remainingBatchAmount: 20,
    purchasePrice: '2400',  // in wei units (price per bit is 120, which is greater than the first batch for gamer 2)
    BlockNumOnWhichBitsWereBought: 45450,
  };

  try {
    await store.addGamerBatch(holderAddress, gamerAddress2, batch2Gamer2);
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
      assert.fail(`Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  try {
    await store.updateGamerBatch(holderAddress, gamerAddress1, 1, 1, 45430); // Invalid BlockNumberOnWhichBitsWereSold
    assert.fail('Expected error not thrown for invalid BlockNumberOnWhichBitsWereSold');
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Update Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  try {
    await store.updateGamerBatch(holderAddress, gamerAddress1, 1, 20, 45554); // More bits to deduct than available
    assert.fail('Expected error not thrown for insufficient bits');
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Update Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  try {
    await store.updateGamerBatch(holderAddress, gamerAddress1, 1, 1, 45554); // Valid update
  } catch (error) {
    if (error instanceof JSONStoreError) {
      console.error(`Update Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
      assert.fail(`Update Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
    } else {
      console.error(`Unexpected Error: ${error.message}`);
      assert.fail(`Unexpected Error: ${error.message}`);
    }
  }

  try {
    const maxPricePerBit = new BigNumber(120); // Price per bit
    const filesByPriceGamer1 = await store.getBatchFilesByMaxPrice(holderAddress, gamerAddress1, maxPricePerBit);
    console.log('Files for gamerAddress1 with purchase price per bit <= maxPricePerBit:', filesByPriceGamer1);
    assert.strictEqual(filesByPriceGamer1.length, 2, 'Expected two files for gamerAddress1 with purchase price per bit <= maxPricePerBit');
  } catch (error) {
    console.error('Error fetching files by price for gamerAddress1:', error);
    assert.fail(`Error fetching files by price for gamerAddress1: ${error.message}`);
  }

  try {
    const filesByBlockNumGamer1 = await store.getBatchFilesByMaxBlockNum(holderAddress, gamerAddress1, 45450);
    console.log('Files for gamerAddress1 with BlockNumOnWhichBitsWereBought <= 45450:', filesByBlockNumGamer1);
    assert.strictEqual(filesByBlockNumGamer1.length, 2, 'Expected two files for gamerAddress1 with BlockNumOnWhichBitsWereBought <= 45450');
  } catch (error) {
    console.error('Error fetching files by block number for gamerAddress1:', error);
    assert.fail(`Error fetching files by block number for gamerAddress1: ${error.message}`);
  }

  try {
    const maxPricePerBit = new BigNumber(120); // Price per bit
    const filesByPriceGamer2 = await store.getBatchFilesByMaxPrice(holderAddress, gamerAddress2, maxPricePerBit);
    console.log('Files for gamerAddress2 with purchase price per bit <= maxPricePerBit:', filesByPriceGamer2);
    assert.strictEqual(filesByPriceGamer2.length, 2, 'Expected two files for gamerAddress2 with purchase price per bit <= maxPricePerBit');
  } catch (error) {
    console.error('Error fetching files by price for gamerAddress2:', error);
    assert.fail(`Error fetching files by price for gamerAddress2: ${error.message}`);
  }

  try {
    const filesByBlockNumGamer2 = await store.getBatchFilesByMaxBlockNum(holderAddress, gamerAddress2, 45450);
    console.log('Files for gamerAddress2 with BlockNumOnWhichBitsWereBought <= 45450:', filesByBlockNumGamer2);
    assert.strictEqual(filesByBlockNumGamer2.length, 2, 'Expected two files for gamerAddress2 with BlockNumOnWhichBitsWereBought <= 45450');
  } catch (error) {
    console.error('Error fetching files by block number for gamerAddress2:', error);
    assert.fail(`Error fetching files by block number for gamerAddress2: ${error.message}`);
  }
})();
