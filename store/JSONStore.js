/**
 * @file jsonStore.js
 * @description This module defines the JSONStore class for managing JSON data files related to holders, gamers, and transactions. 
 * It includes methods for initializing directories, adding and updating gamer batches, pruning transaction files, 
 * and retrieving batch and transaction data.
 */
const fs = require('fs-extra');
const path = require('path');
const BigNumber = require('bignumber.js');
const { ethers } = require('ethers');
const { JSONStoreTxHistoryError } = require('./storeErrors');
const config = require('../config/chainConfig');

const dataDir = path.join(__dirname, '..', 'data');
const holdersDir = path.join(dataDir, 'holders');
const archiveDir = path.join(dataDir, 'archive');
const transactionsDir = path.join(dataDir, 'transactions');
const ordersDir = path.join(dataDir, 'orders');
const proposedOrdersDir = path.join(ordersDir, 'proposedOrders');

const provider = new ethers.providers.JsonRpcProvider(config.providerURL);

class JSONStore {
  constructor() {
    this.init();
  }
    /**
   * Initializes the JSONStore by ensuring all required directories exist.
   * @async
   */
  async init() {
    await fs.ensureDir(dataDir);
    await fs.ensureDir(ordersDir);
    await fs.ensureDir(proposedOrdersDir);
    await fs.ensureDir(holdersDir);
    await fs.ensureDir(archiveDir);
    await fs.ensureDir(transactionsDir);
  }
  /**
   * Prunes a transaction file if it is older than the configured maximum age.
   * @async
   * @param {string} transactionFilePath - The path to the transaction file to prune.
   * @throws {JSONStoreTxHistoryError} If the file cannot be pruned.
   */
  async pruneTransactionFile(transactionFilePath) {
    if (!(await fs.pathExists(transactionFilePath))) {
      return;
    }

    const ageOfOldestTxInHours = config.ageOfOldestTxInHours;
    const now = Date.now();
    const maxAge = ageOfOldestTxInHours * 60 * 60 * 1000;

    try {
      const stats = await fs.stat(transactionFilePath);

      if (stats.isFile() && transactionFilePath.endsWith('.json')) {
        const transaction = await fs.readJson(transactionFilePath);
        const txDate = new Date(transaction.last_tx_date).getTime();

        if (now - txDate > maxAge) {
          await fs.remove(transactionFilePath);
          console.log(`Pruned old transaction file: ${transactionFilePath}`);
        }
      }
    } catch (error) {
      console.error('Failed to prune transaction file:', error);
      throw new JSONStoreTxHistoryError('Failed to prune transaction file.', 'PRUNE_TX_FAILED');
    }
  }
  /**
   * Adds a holder by creating the necessary directory.
   * @async
   * @param {string} holderAddress - The address of the holder to add.
   * @throws {Error} If the holder directory cannot be created.
   */
  async addHolder(holderAddress) {
    const holderPath = this.getHolderPath(holderAddress);
    try {
      await fs.ensureDir(holderPath);
      console.log(`Holder ${holderAddress} added.`);
    } catch (error) {
      console.error(`Failed to add holder ${holderAddress}:`, error);
      throw error;
    }
  }
  /**
   * Adds a gamer batch by validating and storing the batch information.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @param {Object} batch - The batch data to add.
   * @throws {JSONStoreTxHistoryError} If the batch cannot be added.
   */
  async addGamerBatch(holderAddress, gamerAddress, batch) {
    const gamerPath = this.getGamerPath(holderAddress, gamerAddress);
    await fs.ensureDir(gamerPath);
    
    // Get all batch files and determine the next batch number
    const files = await fs.readdir(gamerPath);
    const batchNumbers = files
      .map(file => {
        const match = file.match(/^batch_(\d+)\.json$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => num > 0);

    const batchNumber = batchNumbers.length > 0 ? Math.max(...batchNumbers) + 1 : 1;
    const batchFilePath = this.getBatchFilePath(holderAddress, gamerAddress, batchNumber);
    const tempFilePath = batchFilePath + '.tmp';

    // Validate the new batch against the last batch
    if (batchNumbers.length > 0) {
      const lastBatchNumber = Math.max(...batchNumbers);
      const lastBatchFilePath = this.getBatchFilePath(holderAddress, gamerAddress, lastBatchNumber);
      const lastBatch = await fs.readJson(lastBatchFilePath);

      if (batch.BlockNumOnWhichBitsWereBought < lastBatch.BlockNumOnWhichBitsWereBought) {
        throw new JSONStoreTxHistoryError('BlockNumOnWhichBitsWereBought in the new batch must be greater than or equal to that in the previous batch.', 'INVALID_BLOCK_NUMBER');
      }
    }

    try {
      // Write the new batch to a temporary file
      await fs.writeJson(tempFilePath, batch, { spaces: 2 });

      // Atomically move the temporary file to the target location
      await fs.move(tempFilePath, batchFilePath, { overwrite: true });
      console.log(`Batch ${batchNumber} added for gamer ${gamerAddress} under holder ${holderAddress}.`);

      // Update the transaction file
      const blockTimestamp = await this.getBlockTimestamp(batch.BlockNumOnWhichBitsWereBought);
      await this.updateTransactionFile(gamerAddress, holderAddress, blockTimestamp, batch.BlockNumOnWhichBitsWereBought, true);
    } catch (error) {
      // Clean up the temporary file in case of error
      if (await fs.pathExists(tempFilePath)) {
        await fs.remove(tempFilePath);
      }
      console.error(`Failed to add gamer batch for ${gamerAddress} under holder ${holderAddress}:`, error);
      throw new JSONStoreTxHistoryError('Failed to add gamer batch.', 'ADD_BATCH_FAILED');
    }
  }
  /**
   * Updates a gamer batch with the given data.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @param {number} batchNumber - The batch number to update.
   * @param {number} bitsToDeduct - The number of bits to deduct.
   * @param {number} blockNumberOnWhichBitsWereSold - The block number on which bits were sold.
   * @param {string} [sellPrice="0"] - The sell price.
   * @throws {JSONStoreTxHistoryError} If the batch cannot be updated.
   */
  async updateGamerBatch(holderAddress, gamerAddress, batchNumber, bitsToDeduct, blockNumberOnWhichBitsWereSold, sellPrice = "0") {
    const batchFilePath = this.getBatchFilePath(holderAddress, gamerAddress, batchNumber);
    if (!await fs.pathExists(batchFilePath)) {
      throw new JSONStoreTxHistoryError(`Batch file ${batchFilePath} does not exist.`, 'BATCH_NOT_FOUND');
    }

    const tempFilePath = batchFilePath + '.tmp';

    try {
      const batch = await fs.readJson(batchFilePath);
      if (batch.remainingBatchAmount < bitsToDeduct) {
        throw new JSONStoreTxHistoryError('Not enough bits to deduct.', 'INSUFFICIENT_BITS');
      }
      if (batch.BlockNumOnWhichBitsWereBought > blockNumberOnWhichBitsWereSold) {
        throw new JSONStoreTxHistoryError('BlockNumberOnWhichBitsWereSold must be greater than BlockNumberOnWhichBitsWereBought.', 'INVALID_BLOCK_NUMBER');
      }
      if (batch.BlockNumberOnWhichBitsWereSold && batch.BlockNumberOnWhichBitsWereSold > blockNumberOnWhichBitsWereSold) {
        throw new JSONStoreTxHistoryError('BlockNumberOnWhichBitsWereSold must be greater than its current value.', 'BLOCK_NUMBER_NOT_INCREMENTED');
      }

      const currentSellPrice = new BigNumber(batch.sellPrice || "0");
      const additionalSellPrice = new BigNumber(sellPrice);
      batch.sellPrice = currentSellPrice.plus(additionalSellPrice).toString();

      batch.remainingBatchAmount -= bitsToDeduct;
      batch.BlockNumberOnWhichBitsWereSold = blockNumberOnWhichBitsWereSold;

      // Write the update to a temporary file
      await fs.writeJson(tempFilePath, batch, { spaces: 2 });

      if (batch.remainingBatchAmount === 0) {
        const archivePath = this.getArchivePath(holderAddress, gamerAddress);
        await fs.ensureDir(archivePath);
        await fs.move(tempFilePath, batchFilePath, { overwrite: true });
        await fs.move(batchFilePath, path.join(archivePath, `batch_${batchNumber}.json`), { overwrite: true } );
        console.log(`Batch ${batchNumber} archived for gamer ${gamerAddress} under holder ${holderAddress}.`);
      } else {
        // Atomically move the temporary file to replace the original file
        await fs.move(tempFilePath, batchFilePath, { overwrite: true });
        console.log(`Batch ${batchNumber} updated for gamer ${gamerAddress} under holder ${holderAddress}.`);
      }

      // Update the transaction file
      const blockTimestamp = await this.getBlockTimestamp(blockNumberOnWhichBitsWereSold);
      await this.updateTransactionFile(gamerAddress, holderAddress, blockTimestamp, blockNumberOnWhichBitsWereSold , false);
    } catch (error) {
      // Clean up the temporary file in case of error
      if (await fs.pathExists(tempFilePath)) {
        await fs.remove(tempFilePath);
      }
      console.error(`Failed to update gamer batch ${batchNumber} for ${gamerAddress} under holder ${holderAddress}:`, error);
      throw error;
    }
  }
  /**
   * Retrieves the last transaction for a given gamer.
   * @async
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {Object|null} The last transaction object, or null if no transaction is found.
   * @throws {JSONStoreTxHistoryError} If an error occurs while retrieving the transaction.
   */

  async getLastTransaction(gamerAddress) {
    const transactionFilePath = this.getTransactionFilePath(gamerAddress);
    try {

      if (!(await fs.pathExists(transactionFilePath))) {
        return null;
      }
      let res = await fs.readJson(transactionFilePath);
      // Prune the transaction file if it is too old
      await this.pruneTransactionFile(transactionFilePath);

      return res;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      } else {
        console.error(`Failed to get last transaction for gamer ${gamerAddress}:`, error);
        throw new JSONStoreTxHistoryError(`Failed to get last transaction for gamer ${gamerAddress}: ${error.message}`, 'GET_TX_FAILED');
      }
    }
  }

   /**
   * Gets the path for a holder's directory.
   * @param {string} holderAddress - The address of the holder.
   * @returns {string} - The path to the holder's directory.
   */
  getHolderPath(holderAddress) {
    return path.join(holdersDir, holderAddress);
  }

  /**
   * Gets the path for a gamer's directory.
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string} - The path to the gamer's directory.
   */
  getGamerPath(holderAddress, gamerAddress) {
    return path.join(this.getHolderPath(holderAddress), gamerAddress);
  }

  /**
   * Gets the path for a batch file.
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @param {number} batchNumber - The batch number.
   * @returns {string} - The path to the batch file.
   */
  getBatchFilePath(holderAddress, gamerAddress, batchNumber) {
    return path.join(this.getGamerPath(holderAddress, gamerAddress), `batch_${batchNumber}.json`);
  }
  /**
   * Gets the path for the archive directory of a gamer.
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string} - The path to the archive directory.
   */
  getArchivePath(holderAddress, gamerAddress) {
    return path.join(archiveDir, holderAddress, gamerAddress);
  }
  /**
   * Gets the path for a transaction file.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string} - The path to the transaction file.
   */
  getTransactionFilePath(gamerAddress) {
    return path.join(transactionsDir, `${gamerAddress}.json`);
  }
  /**
   * Updates the transaction file for a gamer with new transaction data.
   * @async
   * @param {string} gamerAddress - The address of the gamer.
   * @param {string} holderAddress - The address of the holder.
   * @param {number} blockTimestamp - The timestamp of the block.
   * @param {number} blockNumber - The block number.
   * @param {boolean} isBuy - Indicates if the transaction is a buy.
   * @throws {JSONStoreTxHistoryError} If the transaction file cannot be updated.
   */
  async updateTransactionFile(gamerAddress, holderAddress, blockTimestamp, blockNumber, isBuy) {
    const transactionFilePath = this.getTransactionFilePath(gamerAddress);
    const transaction = {
      last_tx_date: new Date(blockTimestamp * 1000).toISOString(),
      holder: holderAddress,
      is_buy: isBuy,
      blockNumber: blockNumber
    };

    try {
      await fs.writeJson(transactionFilePath, transaction, { spaces: 2 });
      console.log(`Transaction file updated for gamer ${gamerAddress}.`);
    } catch (error) {
      console.error(`Failed to update transaction file for gamer ${gamerAddress}:`, error);
      throw new JSONStoreTxHistoryError('Failed to update transaction file.', 'UPDATE_TX_FAILED');
    }
  }
  /**
   * Retrieves the timestamp of a block by its block number.
   * @async
   * @param {number} blockNumber - The block number.
   * @returns {number} - The timestamp of the block.
   * @throws {JSONStoreTxHistoryError} If the block timestamp cannot be retrieved.
   */
  async getBlockTimestamp(blockNumber) {
    try {
      const block = await provider.getBlock(blockNumber);
      if (block) {
        return block.timestamp;
      } else {
        throw new JSONStoreTxHistoryError(`Block number ${blockNumber} not found.`, 'BLOCK_NOT_FOUND');
      }
    } catch (error) {
      console.error(`Error fetching block number ${blockNumber}:`, error);
      throw new JSONStoreTxHistoryError(`Failed to fetch block number ${blockNumber}: ${error.message}`, 'BLOCK_FETCH_FAILED');
    }
  }
  /**
   * Retrieves the batch files in descending order of batch numbers.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string[]} - An array of batch file names in descending order.
   */
  async getBatchFilesInDescendingOrder(holderAddress, gamerAddress) {
    const gamerPath = this.getGamerPath(holderAddress, gamerAddress);
    const batchFiles = (await fs.readdir(gamerPath)).filter(file => file.startsWith('batch_'));
    return batchFiles.sort((a, b) => {
      const batchNumberA = parseInt(a.match(/^batch_(\d+)\.json$/)[1], 10);
      const batchNumberB = parseInt(b.match(/^batch_(\d+)\.json$/)[1], 10);
      return batchNumberB - batchNumberA;
    });
  }
    /**
   * Retrieves the batch files in ascending order of batch numbers.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string[]} - An array of batch file names in ascending order.
   */
  async getBatchFilesInAscendingOrder(holderAddress, gamerAddress) {
    const gamerPath = this.getGamerPath(holderAddress, gamerAddress);
    const batchFiles = (await fs.readdir(gamerPath)).filter(file => file.startsWith('batch_'));
    return batchFiles.sort((a, b) => {
      const batchNumberA = parseInt(a.match(/^batch_(\d+)\.json$/)[1], 10);
      const batchNumberB = parseInt(b.match(/^batch_(\d+)\.json$/)[1], 10);
      return batchNumberA - batchNumberB;
    });
  }
  /**
   * Retrieves all batch files for a gamer.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {string[]} - An array of batch file names.
   */
  async getBatchFiles(holderAddress, gamerAddress) {
    const gamerPath = this.getGamerPath(holderAddress, gamerAddress);
    const batchFiles = (await fs.readdir(gamerPath)).filter(file => file.startsWith('batch_'));
    return batchFiles;
  }
  /**
   * Retrieves a specific batch file for a gamer.
   * @async
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @param {number} batchNumber - The batch number.
   * @returns {Object} - The batch file data.
   * @throws {JSONStoreTxHistoryError} If the batch file cannot be read.
   */
  async getBatchFile(holderAddress, gamerAddress, batchNumber) {
    const batchFilePath = this.getBatchFilePath(holderAddress, gamerAddress, batchNumber);
    try {
      return await fs.readJson(batchFilePath);
    } catch (error) {
      console.error(`Failed to read batch file ${batchFilePath}:`, error);
      throw new JSONStoreTxHistoryError(`Failed to read batch file ${batchFilePath}: ${error.message}`, 'READ_BATCH_FAILED');
    }
  }
  /**
   * Retrieves the entire store of holder and gamer data.
   * @async
   * @param {Set<string>} [holderSet=null] - An optional set of holder addresses to limit the data retrieval.
   * @returns {Object} - The entire store data.
   */
  async getFullStore(holderSet = null) {
    const store = {};
  
    const traverseDirectory = async (dirPath, filter = null) => {
      const contents = await fs.readdir(dirPath);
      const result = {};
  
      for (const item of contents) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);
  
        if (stats.isDirectory()) {
          if (!filter || filter.includes(item)) {
            result[item] = await traverseDirectory(itemPath);
          }
        } else if (stats.isFile() && item.endsWith('.json')) {
          result[item] = await fs.readJson(itemPath);
        }
      }
  
      return result;
    };
  
    if (holderSet) {
      store.holders = {};
      store.archive = {};
  
      for (const holder of holderSet) {
        store.holders[holder] = await traverseDirectory(path.join(holdersDir, holder));
        store.archive[holder] = await traverseDirectory(path.join(archiveDir, holder));
      }
    } else {
      store.holders = await traverseDirectory(holdersDir);
      store.archive = await traverseDirectory(archiveDir);
    }
  
    return store;
  }
  /**
   * Retrieves the highest block number across all batch files.
   * @async
   * @returns {number} - The highest block number.
   */
  async getLatestBlockNum() {
    let maxBlockNum = 0;

    const updateMaxBlockNum = (batch) => {
      if (batch.BlockNumOnWhichBitsWereBought > maxBlockNum) {
        maxBlockNum = batch.BlockNumOnWhichBitsWereBought;
      }
      if (batch.BlockNumberOnWhichBitsWereSold && batch.BlockNumberOnWhichBitsWereSold > maxBlockNum) {
        maxBlockNum = batch.BlockNumberOnWhichBitsWereSold;
      }
    };

    const traverseAndFindMaxBlockNum = async (dirPath) => {
      const contents = await fs.readdir(dirPath);

      for (const item of contents) {
        const itemPath = path.join(dirPath, item);
        const stats = await fs.stat(itemPath);

        if (stats.isDirectory()) {
          await traverseAndFindMaxBlockNum(itemPath);
        } else if (stats.isFile() && item.endsWith('.json')) {
          const batch = await fs.readJson(itemPath);
          updateMaxBlockNum(batch);
        }
      }
    };

    await traverseAndFindMaxBlockNum(holdersDir);
    await traverseAndFindMaxBlockNum(archiveDir);

    return maxBlockNum;
  }
}

module.exports = { JSONStore };
