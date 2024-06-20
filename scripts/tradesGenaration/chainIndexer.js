/**
 * @file ChainIndexer.js
 * @description This module manages the indexing of chain events and processes buy rules.
 * It reads and stores event details, processes holder and gamer events, and continuously fetches events at specified intervals.
 * 
 */
// scripts/tradesGeneration/ChainIndexer.js
const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const config = require('../../config/chainConfig');
const { JSONStore } = require('../../store/JSONStore'); // Add the JSONStore import
const { JSONStoreError } = require('../../store/storeErrors'); // Add the JSONStore import
const { processJsonBuyRules, evaluateAndInvokeBuy, processJsonSellRules, evaluateAndInvokeSell } = require('../../common/rulesEngineLib');
const KeyFleet = require('../../fleet/keyFleet');
const TxGofer = require('../../fleet/txGofer');
const Logger = require('../../common/logger');
const logger = new Logger();

class ChainIndexer {
  constructor() {
    this.invokedBy = "chainIndexer";
    this.schemaFilePath = path.resolve(__dirname, '../../schema/tradeSchema.json');
    this.buyRulesFilePath = path.resolve(__dirname, '../../rules/buy/buyRules.json');
    this.sellRulesFilePath = path.resolve(__dirname, '../../rules/sell/sellRules.json');
    this.schema = JSON.parse(fs.readFileSync(this.schemaFilePath, 'utf-8'));
    this.buyRules = this.processBuyRules();
    this.sellRules = this.processSellRules();
    this.indexingCaughtUp = false;
    this.provider = new ethers.providers.JsonRpcProvider(config.providerURL);
    this.abiPath = path.join(__dirname, '../..', 'abi', 'GambitBitsV3ABI.json');
    this.contractABI = JSON.parse(fs.readFileSync(this.abiPath, 'utf-8'));
    this.contract = new ethers.Contract(config.contractAddress, this.contractABI, this.provider);
    this.store = new JSONStore();
    this.keyFleet = new KeyFleet();
    this.txGofer = new TxGofer(this.provider, TxGofer.ROLE_PRODUCER);
  }
  /**
   * Processes the buy rules from the JSON document.
   *
   * @returns {Object} The processed buy rules.
   */
  processBuyRules() {
    const jsonDocument = JSON.parse(fs.readFileSync(this.buyRulesFilePath, 'utf-8'));
    return processJsonBuyRules(jsonDocument, this.schema, this.invokedBy);
  }
    /**
   * Processes the sell rules from the JSON document.
   *
   * @returns {Object} The processed sell rules.
   */
    processSellRules() {
      const jsonDocument = JSON.parse(fs.readFileSync(this.sellRulesFilePath, 'utf-8'));
      return processJsonSellRules(jsonDocument, this.schema, this.invokedBy);
    }
  /**
   * Extracts trade event details from the event log.
   *
   * @param {Object} event - The event log object.
   * @returns {Object} The extracted trade event details.
   */
  extractTradeEventDetails(event) {
    const { trader, gamer, isBuy, bitAmount, ethAmount, protocolEthAmount, gamerEthAmount, supply } = event.args;
    return {
      trader,
      gamer,
      isBuy,
      bitAmount: ethers.BigNumber.from(bitAmount).toString(),
      ethAmount: ethers.BigNumber.from(ethAmount).toString(),
      protocolEthAmount: ethers.BigNumber.from(protocolEthAmount).toString(),
      gamerEthAmount: ethers.BigNumber.from(gamerEthAmount).toString(),
      supply: ethers.BigNumber.from(supply).toString(),
      blockNumber: event.blockNumber,
      txHash: event.transactionHash
    };
  }
  /**
   * Stores event details in the JSON store.
   *
   * @param {Object} eventDetails - The trade event details.
   * @throws {Error} Throws an error if storing event details fails.
   */
  async storeEventDetails(eventDetails) {
    const holderAddress = eventDetails.trader;
    const gamerAddress = eventDetails.gamer;
    const bitAmount = ethers.BigNumber.from(eventDetails.bitAmount).toNumber();
    const blockNumber = eventDetails.blockNumber;

    if (bitAmount === 0) {
      console.log(`[ChainIndexer] Skipping batch for gamer ${gamerAddress} under holder ${holderAddress} due to bitAmount being zero.`);
      return;
    }

    try {
      await this.store.addHolder(holderAddress);
    } catch (error) {
      console.error(`[ChainIndexer] Failed to add holder ${holderAddress}:`, error);
      throw error;
    }

    if (eventDetails.isBuy) {
      const peakSupply = eventDetails.supply;
      const purchasePrice = ethers.BigNumber.from(eventDetails.ethAmount)
        .add(ethers.BigNumber.from(eventDetails.protocolEthAmount))
        .add(ethers.BigNumber.from(eventDetails.gamerEthAmount))
        .toString();

      const newBatch = {
        InitialBatchAmount: bitAmount,
        remainingBatchAmount: bitAmount,
        purchasePrice: purchasePrice,
        BlockNumOnWhichBitsWereBought: blockNumber,
        peakSupply: peakSupply
      };

      try {
        await this.store.addGamerBatch(holderAddress, gamerAddress, newBatch);
        console.log(`[ChainIndexer] Added new batch for gamer ${gamerAddress} under holder ${holderAddress}`);
      } catch (error) {
        if (error instanceof JSONStoreError) {
          console.error(`[ChainIndexer] Add Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
          throw error;
        } else {
          console.error(`[ChainIndexer] Unexpected Error: ${error.message}`);
          throw error;
        }
      }
    } else {
      let bitsToDeduct = bitAmount;
      const sellPrice = ethers.BigNumber.from(eventDetails.ethAmount).toString();

      try {
        const batchFiles = await this.store.getBatchFilesInAscendingOrder(holderAddress, gamerAddress);
        for (const batchFile of batchFiles) {
          const batchNumber = parseInt(batchFile.match(/^batch_(\d+)\.json$/)[1], 10);
          const batch = await this.store.getBatchFile(holderAddress, gamerAddress, batchNumber);

          if (batch.remainingBatchAmount >= bitsToDeduct) {
            await this.store.updateGamerBatch(holderAddress, gamerAddress, batchNumber, bitsToDeduct, blockNumber, sellPrice);
            console.log(`Updated batch ${batchNumber} for gamer ${gamerAddress} under holder ${holderAddress}`);
            bitsToDeduct = 0;
            break;
          } else {
            bitsToDeduct -= batch.remainingBatchAmount;
            await this.store.updateGamerBatch(holderAddress, gamerAddress, batchNumber, batch.remainingBatchAmount, blockNumber, sellPrice);
            console.log(`[ChainIndexer] Updated batch ${batchNumber} for gamer ${gamerAddress} under holder ${holderAddress}, bits remaining to deduct: ${bitsToDeduct}`);
          }
        }

        if (bitsToDeduct > 0) {
          console.error(`[ChainIndexer] Not enough bits to deduct for gamer ${gamerAddress} under holder ${holderAddress}`);
          throw new JSONStoreError('Not enough bits to deduct.', 'INSUFFICIENT_BITS');
        }

      } catch (error) {
        if (error instanceof JSONStoreError) {
          console.error(`[ChainIndexer] Update Gamer Batch Error - Code: ${error.code}, Message: ${error.message}`);
          throw error;
        } else {
          console.error(`[ChainIndexer] Unexpected Error: ${error.message}`);
          throw error;
        }
      }
    }

    if (this.keyFleet.getAllAddresses().includes(holderAddress)) {
      await this.txGofer.markMinedOrder(holderAddress, eventDetails.txHash);
    }

    if (this.indexingCaughtUp) {
      let ctx = {
        invokedBy: this.invokedBy,
        holder: holderAddress,
        gamer: gamerAddress,
        bitAmount: bitAmount,
        isBuy: eventDetails.isBuy
      };
      if (this.buyRules) {
        console.log("[ChainIndexer] calling evaluateAndInvokeBuy");
        await evaluateAndInvokeBuy(ctx, this.buyRules);
      }
      if (this.sellRules) {
        console.log("[ChainIndexer] calling evaluateAndInvokeSell");
        await evaluateAndInvokeSell(ctx, this.sellRules);
      }
    }
  }
 /**
   * Fetches events from the blockchain within a specified block range.
   *
   * @param {number} startBlock - The starting block number.
   * @param {number} endBlock - The ending block number.
   * @param {number} batchSize - The number of blocks to fetch in each batch.
   * @throws {Error} Throws an error if fetching events fails.
   */
  async fetchEvents(startBlock, endBlock, batchSize) {
    for (let i = startBlock; i <= endBlock; i += batchSize) {
      const fromBlock = i;
      const toBlock = Math.min(i + batchSize - 1, endBlock);

      console.log(`[ChainIndexer] Fetching events from block ${fromBlock} to ${toBlock}`);
      try {
        const eventLogs = await this.contract.queryFilter(this.contract.filters.Trade(), fromBlock, toBlock);
        for (const event of eventLogs) {
          const eventDetails = this.extractTradeEventDetails(event);
          //console.log('[ChainIndexer] Event Details:', eventDetails);
          await this.storeEventDetails(eventDetails);
        }

      } catch (error) {
        console.error(`[ChainIndexer] Error fetching events from block ${fromBlock} to ${toBlock}:`, error);
        throw error;
      }
    }

    console.log('[ChainIndexer] Finished fetching all events.');
  }
  /**
   * Catches up the indexer by fetching and processing all past events.
   *
   * @returns {number} The latest block number processed.
   * @throws {Error} Throws an error if catching up fails.
   */
  async catchupIndex() {
    try {
      let startBlock = config.startBlock;
      let endBlock = await this.provider.getBlockNumber();

      const latestIndexedBlockNum = await this.store.getLatestBlockNum();

      if (latestIndexedBlockNum > 0) {
        startBlock = latestIndexedBlockNum + 1;
        console.log(`[ChainIndexer] Starting from last indexed Block: ${startBlock} (contract deployed at block ${config.startBlock}) Network: ${config.network}`);
      } else {
        console.log(`[ChainIndexer] Starting from contract deployment block ${config.startBlock}) Network: ${config.network}`);
      }

      await this.fetchEvents(startBlock, endBlock, config.batchSize);
      return endBlock;
    } catch (error) {
      console.error(`[ChainIndexer] Error determining start block:`, error);
      logger.logError({ msg: `[ChainIndexer] Error determining start block: ${error.message}` }, 'CHAIN_INDEXER_ERROR');
      throw error;
    }
  }
  /**
   * Fetches events from the blockchain periodically and processes them.
   *
   * @param {Function} cb - A callback function to be called when indexing is caught up.
   * @throws {Error} Throws an error if fetching events fails.
   */
  async fetchEventsPeriodically(cb) {
    let lastEndBlock = await this.catchupIndex();
  
    const fetch = async () => {
      try {
        const startBlock = lastEndBlock + 1;
        const endBlock = await this.provider.getBlockNumber();
  
        if (startBlock <= endBlock) {
          await this.fetchEvents(startBlock, endBlock, config.batchSize);
  
          if (endBlock - startBlock < config.catchUpDelta) {
            this.indexingCaughtUp = true;
            console.log("[ChainIndexer] Process Rules Green lit");
          }
          lastEndBlock = endBlock;
        } else {
          console.log('[ChainIndexer] No new blocks to process, waiting for new blocks...');
          this.indexingCaughtUp = true;
          console.log("[ChainIndexer] Process Rules Green lit");
        }
        if (cb && this.indexingCaughtUp) {
          cb();
        }
      } catch (error) {
        console.error('[ChainIndexer] Error fetching events in periodic call:', error);
        logger.logError({ msg: `[ChainIndexer] Error fetching events from the blockchain: ${error.message}. Investor.js will restart in ${config.restartDelaySeconds} seconds If you have it under pm2 control. It will then automatically start indexing from the last successfuly saved event block.` }, 'CHAIN_INDEXER_ERROR');
        console.log(`[ChainIndexer] Restarting investor.js in ${config.restartDelaySeconds} seconds...`);
        await new Promise(resolve => setTimeout(resolve, config.restartDelaySeconds * 1000));
        process.exit(1); // Restart the process
      } finally {
        setTimeout(fetch, config.blockFetchFrequency);
      }
    };
    fetch();
  }
  
}

module.exports = ChainIndexer;
