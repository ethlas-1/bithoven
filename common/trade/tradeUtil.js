/**
 * @file tradeUtil.js
 * @description This module provides utility functions for trading operations, including balance checking, order management, and profit and loss calculations. 
 * The functions defined include getBitBalanceInStore for retrieving bit balance, getProposedSum for calculating proposed order sums, 
 * getAmountPending for checking pending amounts, adjustSellTargetAmount and adjustBuyTargetAmount for adjusting target amounts, 
 * and computePandL for computing profit and loss.
 * @module TradeUtil
 */
const { ethers } = require('ethers');
const fs = require('fs-extra');
const path = require('path');
const KeyFleet = require('../../fleet/keyFleet');
const TxGofer = require('../../fleet/txGofer');
const BigNumber = require('bignumber.js');

class TradeUtil {
    /**
   * Retrieves the bit balance in store for a specified holder and gamer.
   *
   * @param {string} holderAddress - The address of the holder.
   * @param {string} gamerAddress - The address of the gamer.
   * @returns {Promise<number>} A promise that resolves to the total balance.
   */
  static async getBitBalanceInStore(holderAddress, gamerAddress) {
    const gamerPath = path.join(__dirname, '../../data/holders', holderAddress, gamerAddress);
    if (!(await fs.pathExists(gamerPath))) {
      return 0;
    }

    const batchFiles = (await fs.readdir(gamerPath)).filter(file => file.startsWith('batch_'));
    let totalBalance = 0;

    for (const file of batchFiles) {
      const batch = await fs.readJson(path.join(gamerPath, file));
      totalBalance += batch.remainingBatchAmount;
    }

    return totalBalance;
  }

/**
 * Finds the key fleet address that owns the most bits for a specified gamer.
 *
 * @param {string} gamerAddress - The address of the gamer.
 * @returns {Promise<string|null>} A promise that resolves to the address that owns the most bits, or null if no addresses own any bits.
 */
static async getLargestKeyFleetOwnerOfGamer(gamerAddress) {
  const keyFleet = new KeyFleet();
  const holderAddresses = keyFleet.getAllAddresses();
  let largestOwnerAddress = null;
  let maxBalance = ethers.BigNumber.from(0);

  for (const holderAddress of holderAddresses) {
    const bitBalance = ethers.BigNumber.from(await this.getBitBalanceInStore(holderAddress, gamerAddress));

    if (bitBalance.gt(maxBalance)) {
      maxBalance = bitBalance;
      largestOwnerAddress = holderAddress;
    }
  }

  return largestOwnerAddress;
}

    /**
   * Retrieves the proposed sum of orders for a gamer.
   *
   * @param {string} gamerAddress - The address of the gamer.
   * @param {string} tradeType - The type of trade (e.g., 'BUY' or 'SELL').
   * @param {string} [holderAddress=null] - The address of the holder (optional).
   * @returns {Promise<number>} A promise that resolves to the total quantity of proposed orders.
   */
  static async getProposedSum(gamerAddress, tradeType, holderAddress = null) {
    const proposedOrdersDir = path.join(__dirname, `../../data/orders/proposedOrders/${tradeType.toLowerCase()}`, gamerAddress);
    if (!(await fs.pathExists(proposedOrdersDir))) {
      return 0;
    }

    const orderFiles = (await fs.readdir(proposedOrdersDir)).filter(file => file.endsWith('.json'));
    let totalQuantity = 0;

    for (const file of orderFiles) {
      const order = await fs.readJson(path.join(proposedOrdersDir, file));
      if (!holderAddress || order.holderAddress === holderAddress) {
        totalQuantity += order.quantity;
      }
    }

    return totalQuantity;
  }
  /**
   * Retrieves the amount pending for a gamer from a holder.
   *
   * @param {string} gamerAddress - The address of the gamer.
   * @param {string} holderAddress - The address of the holder.
   * @param {string} tradeType - The type of trade (e.g., 'BUY' or 'SELL').
   * @returns {Promise<number>} A promise that resolves to the amount pending.
   */
  static async getAmountPending(gamerAddress, holderAddress, tradeType) {
    const orderFilePath = path.join(__dirname, '../../data/orders', holderAddress, 'pendingOrder.json');

    if (!(await fs.pathExists(orderFilePath))) {
      return 0;
    }

    if (await TxGofer.isPendingOrderComplete(holderAddress)){
      //console.log(`${orderFilePath} marked for deletion`);
      return 0;
    }

    const pendingOrder = await fs.readJson(orderFilePath);

    if (pendingOrder.gamerAddress === gamerAddress && pendingOrder.orderType === tradeType) {
      return pendingOrder.numberOfBits;
    }

    return 0;
  }
  /**
   * Adjusts the target amount of bits to sell for a gamer.
   *
   * @param {string} gamerAddress - The address of the gamer.
   * @param {string} holderAddress - The address of the holder.
   * @param {number} maxBitsToSell - The maximum bits to sell.
   * @returns {Promise<number>} A promise that resolves to the adjusted sell target amount.
   */
  static async adjustSellTargetAmount(gamerAddress, holderAddress, maxBitsToSell) {
    const bitBalance = await this.getBitBalanceInStore(holderAddress, gamerAddress);
    const amountPending = await this.getAmountPending(gamerAddress, holderAddress, 'SELL');
    const proposedSum = await this.getProposedSum(gamerAddress, 'SELL', holderAddress);

    if ((amountPending + proposedSum) >= bitBalance) {
      return 0;
    }

    let remainingAvailableBalance = bitBalance - (amountPending + proposedSum);
    return Math.min(maxBitsToSell, remainingAvailableBalance);
  }
  /**
   * Adjusts the target amount of bits to buy for a gamer.
   *
   * @param {string} gamerAddress - The address of the gamer.
   * @param {number} maxBitsToOwn - The maximum bits to own.
   * @returns {Promise<number>} A promise that resolves to the adjusted buy target amount.
   */
  static async adjustBuyTargetAmount(gamerAddress, maxBitsToOwn) {
    const keyFleet = new KeyFleet();
    const holderAddresses = keyFleet.getAllAddresses();
    let totalBitBalance = 0;
    let totalAmountPending = 0;

    for (const holderAddress of holderAddresses) {
      const bitBalance = await this.getBitBalanceInStore(holderAddress, gamerAddress);
      totalBitBalance += bitBalance;
      if (totalBitBalance >= maxBitsToOwn) {
        return 0;
      }

      const amountPending = await this.getAmountPending(gamerAddress, holderAddress, 'BUY');
      totalAmountPending += amountPending;
      if (totalBitBalance + totalAmountPending >= maxBitsToOwn) {
        return 0;
      }
    }

    const proposedSum = await this.getProposedSum(gamerAddress, 'BUY');

    if (totalBitBalance + totalAmountPending + proposedSum >= maxBitsToOwn) {
      return 0;
    }

    return maxBitsToOwn - (totalBitBalance + totalAmountPending + proposedSum);
  }

/**
 * Computes the profit and loss (P&L) for the store.
 *
 * @param {Object} store - The store object containing holder and archive data.
 * @param {number} [startStrategyBlockNumber] - The block number when the current trade strategy started (optional).
 * This parameter represents the point in time when the current trade strategy started and the profits and losses should be computed from that point. 
 * Any batch with BlockNumOnWhichBitsWereBought less than the startStrategyBlockNumber will be omitted from the computation.
 * @returns {Promise<Object>} A promise that resolves to the P&L result.
 */
static async computePandL(store, startStrategyBlockNumber) {
    const result = {
      holders: {},
      total: {
        absoluteProfit: new BigNumber(0),
        totalAdjustedInitialInvestment: new BigNumber(0)
      }
    };

    const processBatches = (batches) => {
      let cumulativeProfitDelta = new BigNumber(0);
      let totalAdjustedInitialInvestment = new BigNumber(0);

      for (const gamerAddress in batches) {
        const batchFiles = batches[gamerAddress];
        for (const batchFile in batchFiles) {
          const batch = batchFiles[batchFile];

          if (startStrategyBlockNumber && batch.BlockNumOnWhichBitsWereBought < startStrategyBlockNumber) {
            continue;
          }
          
          const purchasePrice = new BigNumber(batch.purchasePrice);
          const initialBatchAmount = new BigNumber(batch.InitialBatchAmount);
          const remainingBatchAmount = new BigNumber(batch.remainingBatchAmount);

          if (!batch.sellPrice) {
            continue;
          }

          const sellPrice = new BigNumber(batch.sellPrice);
          const sellAmount = initialBatchAmount.minus(remainingBatchAmount);

          if (initialBatchAmount.isZero() || sellAmount.isZero()) {
            continue;
          }

          const adjustedInitialInvestment = purchasePrice.dividedBy(initialBatchAmount).multipliedBy(sellAmount);
          const profitDelta = sellPrice.minus(adjustedInitialInvestment);

          cumulativeProfitDelta = cumulativeProfitDelta.plus(profitDelta);
          totalAdjustedInitialInvestment = totalAdjustedInitialInvestment.plus(adjustedInitialInvestment);
        }
      }

      return {
        cumulativeProfitDelta,
        totalAdjustedInitialInvestment
      };
    };

    for (const holderAddress in store.holders) {
      const holderBatches = store.holders[holderAddress];
      const archiveBatches = store.archive[holderAddress] || {};

      const holderResult = processBatches(holderBatches);
      const archiveResult = processBatches(archiveBatches);

      const totalProfitDelta = holderResult.cumulativeProfitDelta.plus(archiveResult.cumulativeProfitDelta);
      const totalInitialInvestment = holderResult.totalAdjustedInitialInvestment.plus(archiveResult.totalAdjustedInitialInvestment);

      const absoluteProfitEth = totalProfitDelta.dividedBy(new BigNumber(10).pow(18)).toFixed(4);
      const percentProfit = totalInitialInvestment.isZero() ? '0' : totalProfitDelta.dividedBy(totalInitialInvestment).multipliedBy(100).toFixed(4);
      const adjustedInitialInvestmentEth = totalInitialInvestment.dividedBy(new BigNumber(10).pow(18)).toFixed(4);

      result.holders[holderAddress] = {
        absoluteProfit: absoluteProfitEth,
        percentProfit: percentProfit,
        adjustedInitialInvestment: adjustedInitialInvestmentEth
      };

      result.total.absoluteProfit = result.total.absoluteProfit.plus(totalProfitDelta.dividedBy(new BigNumber(10).pow(18)));
      result.total.totalAdjustedInitialInvestment = result.total.totalAdjustedInitialInvestment.plus(totalInitialInvestment);
    }

    const totalPercentProfit = result.total.totalAdjustedInitialInvestment.isZero() ? '0' : result.total.absoluteProfit.dividedBy(result.total.totalAdjustedInitialInvestment.dividedBy(new BigNumber(10).pow(18))).multipliedBy(100).toFixed(4);

    result.total.percentProfit = totalPercentProfit;
    result.total.absoluteProfit = result.total.absoluteProfit.toFixed(4);
    //result.total.totalAdjustedInitialInvestment = result.total.totalAdjustedInitialInvestment.dividedBy(new BigNumber(10).pow(18)).toFixed(4);

    delete result.total.totalAdjustedInitialInvestment;
    return result;
  }
}

module.exports = TradeUtil;



