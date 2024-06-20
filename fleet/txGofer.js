/**
 * @file txGofer.js
 * @description This module provides the TxGofer class, which manages transaction orders for a fleet of addresses. 
 * It includes methods for proposing orders, recording pending orders, marking orders as mined, and checking for completed orders.
 */
const fs = require('fs-extra');
const path = require('path');
const KeyFleet = require('./keyFleet');
const Logger = require('../common/logger');
const { maxPendingInSeconds } = require('../config/chainConfig');
const { lowBalCacheTTLMinutes } = require('../config/jobsConfig');

class TxGofer {
  static PENDING_ORDER_FILE = 'pendingOrder.json';
  static ROLE_PRODUCER = 'PRODUCER';
  static ROLE_CONSUMER = 'CONSUMER';
  static TRANSACTION_MINED_MARK = '0700';

  constructor(provider, role) {
    if (![TxGofer.ROLE_PRODUCER, TxGofer.ROLE_CONSUMER].includes(role)) {
      throw new Error('Invalid role. Must be PRODUCER or CONSUMER.');
    }

    this.provider = provider;
    this.role = role;
    this.logger = new Logger();

    this.keyFleet = new KeyFleet();
    this.fleetAddresses = this.keyFleet.getAllAddresses();
    this.lowBalanceCache = {};

    if (this.fleetAddresses.length === 0) {
      throw new Error('No fleet addresses found.');
    }

    this.lastChosenFleetAddrIndex = 0;
  }
  /**
   * Raises an alert for a specified gamer address and order type.
   * 
   * @param {string} gamerAddress - The gamer address to raise an alert for.
   * @param {string} orderType - The type of order (BUY/SELL).
   */
  async raiseAlert(gamerAddress, orderType) {
    const alertDir = path.join(__dirname, `../data/orders/proposedOrders/${orderType.toLowerCase()}Alerts`);
    await fs.ensureDir(alertDir);

    const timestamp = new Date().toISOString();
    const alertFilePath = path.join(alertDir, `alert_${gamerAddress}_${timestamp}`);
    await fs.ensureFile(alertFilePath);
  }
  /**
   * Proposes an order for a specified gamer address.
   * 
   * @param {string} gamerAddress - The gamer address to propose an order for.
   * @param {string} orderType - The type of order (BUY/SELL).
   * @param {number} quantity - The quantity of the order.
   * @param {string} ruleId - The rule ID associated with the order.
   * @param {string} invokedBy - The entity that invoked the order.
   * @param {string} [holderAddress=null] - The holder address associated with the order (optional).
   */
  async proposeOrder(gamerAddress, orderType, quantity, ruleId, invokedBy, holderAddress = null) {
    if (this.role !== TxGofer.ROLE_PRODUCER) {
      throw new Error('Invalid role. Only PRODUCER can propose orders.');
    }

    const orderDir = path.join(__dirname, `../data/orders/proposedOrders/${orderType.toLowerCase()}`, gamerAddress);
    const alertDir = path.join(__dirname, `../data/orders/proposedOrders/${orderType.toLowerCase()}Alerts`);

    await fs.ensureDir(orderDir);
    await fs.ensureDir(alertDir);

    const timestamp = new Date().toISOString();
    const orderFilePath = path.join(orderDir, `${timestamp}.json`);
    const alertFilePath = path.join(alertDir, `alert_${gamerAddress}_${timestamp}`);

    const orderData = { ruleId, invokedBy, quantity };
    if (holderAddress) {
      orderData.holderAddress = holderAddress;
    }

    await fs.writeJson(orderFilePath, orderData, { spaces: 2 });
    await fs.ensureFile(alertFilePath);
  }
  /**
   * Records a pending order for a specified gamer address.
   * 
   * @param {string} gamerAddress - The gamer address to record a pending order for.
   * @param {string} orderType - The type of order (BUY/SELL).
   * @param {number} numberOfBits - The number of bits in the order.
   * @param {string} fleetAddress - The fleet address associated with the order.
   * @param {string} txHash - The transaction hash of the order.
   */
  async recordPendingOrder(gamerAddress, orderType, numberOfBits, fleetAddress, txHash) {
    if (this.role !== TxGofer.ROLE_CONSUMER) {
      throw new Error('Invalid role. Only CONSUMER can record pending orders.');
    }

    const nonce = await this.provider.getTransactionCount(fleetAddress, 'latest');
    const timestamp = new Date().toISOString();
    const pendingOrder = {
      gamerAddress,
      orderType,
      numberOfBits,
      txHash,
      nonce,
      timestamp,
    };

    const orderDir = path.join(__dirname, '../data/orders', fleetAddress);
    await fs.ensureDir(orderDir);

    const orderFilePath = path.join(orderDir, TxGofer.PENDING_ORDER_FILE);
    await fs.writeJson(orderFilePath, pendingOrder, { spaces: 2 });
  }
  /**
   * Marks an order as mined by setting the file permissions to indicate it is ready for deletion.
   * @param {string} fleetAddress - The fleet address.
   * @param {string} txHash - The transaction hash.
   */
  async markMinedOrder(fleetAddress, txHash) {
    if (this.role !== TxGofer.ROLE_PRODUCER) {
      throw new Error('Invalid role. Only PRODUCER can mark mined orders.');
    }

    const orderFilePath = path.join(__dirname, '../data/orders', fleetAddress, TxGofer.PENDING_ORDER_FILE);

    if (!(await fs.pathExists(orderFilePath))) {
      return;
    }

    const pendingOrder = await fs.readJson(orderFilePath);

    if (pendingOrder.txHash === txHash) {
      await fs.chmod(orderFilePath, TxGofer.TRANSACTION_MINED_MARK);
    }
  }
  /**
   * Checks if the pending order for a fleet address is complete by verifying file permissions.
   * @param {string} fleetAddress - The fleet address.
   * @returns {Promise<boolean>} True if the order is complete or does not exist, otherwise false.
   */
  static async isPendingOrderComplete(fleetAddress){
    const orderFilePath = path.join(__dirname, '../data/orders', fleetAddress, TxGofer.PENDING_ORDER_FILE);

    if (!(await fs.pathExists(orderFilePath))) {
      return true;
    }

    const stats = await fs.stat(orderFilePath);
    if ((stats.mode & parseInt(TxGofer.TRANSACTION_MINED_MARK, 8)) === parseInt(TxGofer.TRANSACTION_MINED_MARK, 8)) {
     return true;
    }

    return false;
  }
  /**
   * Refreshes the pending order for a fleet address, removing it if it is expired or already mined.
   * @param {string} fleetAddress - The fleet address.
   * @returns {Promise<Object|null>} The pending order if it exists and is still valid, otherwise null.
   */
  async refreshPendingOrder(fleetAddress) {
    const orderFilePath = path.join(__dirname, '../data/orders', fleetAddress, TxGofer.PENDING_ORDER_FILE);

    if (!(await fs.pathExists(orderFilePath))) {
      return null;
    }

    const pendingOrder = await fs.readJson(orderFilePath);
    const stats = await fs.stat(orderFilePath);
    if ((stats.mode & parseInt(TxGofer.TRANSACTION_MINED_MARK, 8)) === parseInt(TxGofer.TRANSACTION_MINED_MARK, 8)) {
      this.logger.logInfo({ msg: `Pending order mined, confirmed and txHash removed: ${pendingOrder.txHash}` }, 'ORDER_MINED_CONFIRMED');
      await fs.remove(orderFilePath);
      return null;
    }

    const now = new Date();
    const orderTimestamp = new Date(pendingOrder.timestamp);

    if (now - orderTimestamp > maxPendingInSeconds * 1000) {
      await fs.remove(orderFilePath);
      this.logger.logWarning({ msg: `Pending order expired and removed ${JSON.stringify(pendingOrder, null, 2)}` }, 'ORDER_EXPIRED');
      return null;
    }

    const currentNonce = await this.provider.getTransactionCount(fleetAddress, 'latest');
    if (currentNonce > pendingOrder.nonce) {
      await fs.remove(orderFilePath);
      return null;
    }

    return pendingOrder;
  }
  /**
   * Updates a pending order based on the transaction hash.
   * @param {string} txHash - The transaction hash.
   * @param {string} fleetAddress - The fleet address.
   */
  async updatePendingOrder(txHash, fleetAddress) {
    const pendingOrder = await this.refreshPendingOrder(fleetAddress);

    if (!pendingOrder) {
      return;
    }

    if (pendingOrder.txHash === txHash) {
      const orderFilePath = path.join(__dirname, '../data/orders', fleetAddress, TxGofer.PENDING_ORDER_FILE);
      await fs.remove(orderFilePath);
    }
  }
  /**
   * Selects the next free key slot from the fleet addresses.
   * @returns {Promise<number>} The index of the next free key slot, or -1 if no free slot is found.
   */
  async selectNextFreeKeySlot() {
    const startIndex = this.lastChosenFleetAddrIndex;
    let index = startIndex;
    const now = Date.now();

    for (let i = 0; i < this.fleetAddresses.length; i++) {
      index = (index + 1) % this.fleetAddresses.length;
      const currentAddress = this.fleetAddresses[index];
      const orderFilePath = path.join(__dirname, '../data/orders', currentAddress, TxGofer.PENDING_ORDER_FILE);

      if (!(await fs.pathExists(orderFilePath))) {
        if (this.isInLowBalCache(currentAddress, now)) {
          continue;
        }

        const hasEnoughERC20 = await this.keyFleet.meetMinimumERC20Balance(currentAddress);
        const hasEnoughGas = await this.keyFleet.meetMinimumGasFeesBalance(currentAddress);

        if (hasEnoughERC20 && hasEnoughGas) {
          this.lastChosenFleetAddrIndex = index;
          return index;
        } else {
          this.cacheLowBalAddress(currentAddress, now);
          let warningMsg = `Fleet Address ${currentAddress} does not meet minimum balance requirements, cannot use it:`;
          if (!hasEnoughERC20) warningMsg += ' insufficient ERC20 balance;';
          if (!hasEnoughGas) warningMsg += ' insufficient gas balance;';
          this.logger.logWarning({ msg: warningMsg }, 'INSUFFICIENT_BALANCE');
        }
      }
    }

    index = startIndex;

    for (let i = 0; i < this.fleetAddresses.length; i++) {
      index = (index + 1) % this.fleetAddresses.length;
      const currentAddress = this.fleetAddresses[index];
      const pendingOrder = await this.refreshPendingOrder(currentAddress);

      if (!pendingOrder) {
        if (this.isInLowBalCache(currentAddress, now)) {
          continue;
        }

        const hasEnoughERC20 = await this.keyFleet.meetMinimumERC20Balance(currentAddress);
        const hasEnoughGas = await this.keyFleet.meetMinimumGasFeesBalance(currentAddress);

        if (hasEnoughERC20 && hasEnoughGas) {
          this.lastChosenFleetAddrIndex = index;
          return index;
        } else {
          this.cacheLowBalAddress(currentAddress, now);
          let warningMsg = `Fleet Address ${currentAddress} does not meet minimum balance requirements, cannot use it:`;
          if (!hasEnoughERC20) warningMsg += ' insufficient ERC20 balance;';
          if (!hasEnoughGas) warningMsg += ' insufficient gas balance;';
          this.logger.logWarning({ msg: warningMsg }, 'INSUFFICIENT_BALANCE');
        }
      }
    }

    return -1; // No free key slot found
  }
  /**
   * Checks if the address is in the low balance cache and the cache is still valid.
   * @param {string} address - The address to check.
   * @param {number} now - The current timestamp.
   * @returns {boolean} True if the address is in the cache and the cache is still valid, otherwise false.
   */
  isInLowBalCache(address, now) {
    if (!this.lowBalanceCache[address]) {
      return false;
    }

    return now - this.lowBalanceCache[address] < lowBalCacheTTLMinutes * 60 * 1000;
  }
  /**
   * Caches the address with the current timestamp in the low balance cache.
   * @param {string} address - The address to cache.
   * @param {number} now - The current timestamp.
   */
  cacheLowBalAddress(address, now) {
    this.lowBalanceCache[address] = now;
  }
}

module.exports = TxGofer;
