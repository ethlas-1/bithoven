/**
 * @file sellGofer.js
 * @description This module is responsible for managing the selling process of bits. It handles the proposal, validation, 
 * and execution of sell orders, ensuring that all conditions are met and that transactions are properly recorded and monitored. 
 * The SellGofer class provides functions to propose sell orders, validate sell conditions, execute sell transactions, 
 * and handle any errors that may occur during the selling process.
 * 
 * 
 */
const fs = require('fs-extra');
const path = require('path');
const ethers = require('ethers');
const TxGofer = require('../../fleet/txGofer');
const Logger = require('../../common/logger');
const { sellBits } = require('../../common/contractUtil/sell');
const { getBitsBalance } = require('../../common/contractUtil/getBitsBalance');
const { providerURL, simulation, contractAddress, sellGasLimit} = require('../../config/chainConfig');
const { staleSellOrderMinutes, warningLogIntervalMinutes, preSelectSlotSleepMilliseconds, lowBalCacheTTLMinutes } = require('../../config/jobsConfig');

const ORDERS_PATH = path.join(__dirname, '../../data/orders');

class SellGofer {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(providerURL);
    this.logger = new Logger();
    this.txGofer = new TxGofer(this.provider, TxGofer.ROLE_CONSUMER);
    this.lastHaultLogTime = 0;
    this.lowBalCache = {};
    this.alerts = {};
  }
  /**
   * Dummy function for simulating sell operations.
   * @param {Object} orderData - The data of the order to be processed.
   * @param {string} gamerAddress - The address of the gamer.
   */
  async dummySellFunction(orderData, gamerAddress) {
    console.log('Executing dummy sell function with order data:', orderData);
    this.logger.logInfo({ msg: `Executed dummy sell function. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}, Holder: ${orderData.holderAddress}` }, 'DUMMY_SELL_FUNCTION');
  }
  /**
   * Processes sell alerts and handles the sell operations.
   */
  async processSellAlerts() {
    console.log('Processing sell alerts...');
    const alertDir = path.join(ORDERS_PATH, 'proposedOrders/sellAlerts');
    await fs.ensureDir(alertDir);

    const sellDir = path.join(ORDERS_PATH, 'proposedOrders/sell');
    await fs.ensureDir(sellDir);

    const haultSellFilePath = path.join(ORDERS_PATH, 'haultSell');

    try {
      const alertFiles = await fs.readdir(alertDir);
      for (const alertFile of alertFiles) {
        const [_, gamerAddress, timestamp] = alertFile.split('_');
        this.alerts[gamerAddress] = alertFile;
      }

      for (const gamerAddress in this.alerts) {
        const alertFilePath = path.join(alertDir, this.alerts[gamerAddress]);
        const currentAlertFileName = this.alerts[gamerAddress];

        if (await fs.pathExists(alertFilePath)) {
          await fs.remove(alertFilePath);
        }

        const proposedOrderDir = path.join(ORDERS_PATH, `proposedOrders/sell/${gamerAddress}`);
        if (!(await fs.pathExists(proposedOrderDir))) {
          if (this.alerts[gamerAddress]) {
            delete this.alerts[gamerAddress];
          }
          continue;
        }

        const proposedOrderFiles = await fs.readdir(proposedOrderDir);

        for (const proposedOrderFile of proposedOrderFiles) {
          if (await fs.pathExists(haultSellFilePath)) {
            const currentTime = Date.now();
            if (currentTime - this.lastHaultLogTime > warningLogIntervalMinutes * 60 * 1000) {
              this.logger.logWarning({ msg: 'Selling is currently halted.' }, 'SELLING_HAULTED');
              this.lastHaultLogTime = currentTime;
            }
            return; // Exit both loops
          }

          const proposedOrderFilePath = path.join(proposedOrderDir, proposedOrderFile);
          const orderData = await fs.readJson(proposedOrderFilePath);

          const orderTimestamp = new Date(proposedOrderFile.replace('.json', ''));
          const now = new Date();
          const orderAgeMinutes = (now - orderTimestamp) / (1000 * 60);

          if (orderAgeMinutes > staleSellOrderMinutes) {
            await fs.remove(proposedOrderFilePath);
            if (this.alerts[gamerAddress]) {
              delete this.alerts[gamerAddress];
            }
            this.logger.logWarning({ msg: `Stale proposed order removed. Order: ${JSON.stringify(orderData)}, Holder: ${orderData.holderAddress}, Gamer: ${gamerAddress}` }, 'STALE_PROPOSED_ORDER');
            continue;
          }

          const holderAddress = orderData.holderAddress;
          const pendingOrderFilePath = path.join(ORDERS_PATH, `${holderAddress}/pendingOrder.json`);

          if (await fs.pathExists(pendingOrderFilePath)) {
            await this.txGofer.refreshPendingOrder(holderAddress);
            if (await fs.pathExists(pendingOrderFilePath)) {
              continue;
            }
          }

          const cacheEntry = this.lowBalCache[holderAddress];
          if (cacheEntry && (Date.now() - cacheEntry.timestamp < lowBalCacheTTLMinutes * 60 * 1000)) {
            continue;
          }

          await new Promise(resolve => setTimeout(resolve, preSelectSlotSleepMilliseconds));

          if (await fs.pathExists(alertFilePath)) {
            await fs.remove(alertFilePath);
          }

          if (await fs.pathExists(proposedOrderFilePath)) {
            await fs.remove(proposedOrderFilePath);
          }

          const hasEnoughGas = await this.txGofer.keyFleet.meetMinimumGasFeesBalanceUsingCurrentGasPrice(holderAddress, sellGasLimit);
          if (!hasEnoughGas) {
            this.lowBalCache[holderAddress] = { timestamp: Date.now() };
            this.logger.logWarning({ msg: `Holder address ${holderAddress} does not meet minimum gas balance requirement. Order will not be executed. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}` }, 'INSUFFICIENT_GAS_BALANCE');
            continue;
          }

           // Call getBitsBalance
           const bitsBalance = await getBitsBalance(gamerAddress, holderAddress, this.provider, contractAddress);
           
           //console.log("@@@@@@@@@@@@@@@@@@@@@@ contract bitsBalance:  " + bitsBalance);

           if (bitsBalance.isZero()) {
             this.logger.logWarning({
               msg: `Actual bit balance from the contract is 0. Order will not be executed. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}, Holder: ${holderAddress}`
             }, 'ZERO_BITS_BALANCE');
             continue;
           }
 
           if (bitsBalance.lt(orderData.quantity)) {
             this.logger.logWarning({
               msg: `Actual bit balance from the contract is less than the order quantity. Adjusting order quantity. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}, Holder: ${holderAddress}`
             }, 'LOWER_BITS_BALANCE');
             orderData.quantity = bitsBalance;
           }

          if (simulation) {
            await this.dummySellFunction(orderData, gamerAddress);
            await this.txGofer.recordPendingOrder(gamerAddress, 'SELL', orderData.quantity, holderAddress, "0x");
          } else {
            let ptr = this;
            await sellBits(this.provider, orderData.quantity, gamerAddress, holderAddress,
              // stores it beofre its mined, the file is stored so keyfleet slot is blocked until trade event is emmited
              // and in turn the pending file is marked as completed/ok to be deleted.
              async function(txHash) {
                await ptr.txGofer.recordPendingOrder(gamerAddress, 'SELL', orderData.quantity, holderAddress, txHash);
              });
          }

        
        }

        const alertTimestamp = new Date(currentAlertFileName.split('_')[2]);
        const currentTime = Date.now();
        if (currentTime - alertTimestamp > staleSellOrderMinutes * 60 * 1000) {
          if (this.alerts[gamerAddress]) {
            delete this.alerts[gamerAddress];
          }
        }
      }
    } catch (error) {
      this.logger.logError({ msg: error.message }, 'SELL_GOFER_ERROR');
      console.error('Error processing sell alerts:', error);
    }
  }
}

module.exports = SellGofer;
