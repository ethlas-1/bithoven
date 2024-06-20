/**
 * @file TradeGofer.js
 * @description This module manages the execution of buy and sell trades using BuyGofer and SellGofer modules.
 * The TradeGofer class executes trades at specified intervals, processing buy and sell alerts continuously.
 * 
 */
const BuyGofer = require('./buyGofer');
const SellGofer = require('./sellGofer');
const { tradeGoferIntervalSeconds } = require('../../config/jobsConfig');

class TradeGofer {
  /**
   * Creates an instance of TradeGofer.
   * Initializes BuyGofer and SellGofer instances.
   */
  constructor() {
    this.buyGofer = new BuyGofer();
    this.sellGofer = new SellGofer();
  }
  /**
   * Executes buy and sell trades in a continuous loop.
   * Processes buy and sell alerts at intervals specified by tradeGoferIntervalSeconds.
   *
   * @async
   * @throws {Error} Throws an error if trade execution fails.
   */
  async executeTrades() {
    console.log('Starting trade execution...');
    while (true) {
      await this.buyGofer.processBuyAlerts();

      await this.sellGofer.processSellAlerts();

      await new Promise(resolve => setTimeout(resolve, tradeGoferIntervalSeconds * 1000));
    }
  }
}

// Start the trade execution process
const tradeGofer = new TradeGofer();
tradeGofer.executeTrades().catch(error => {
  console.error('Error executing trades:', error);
});
