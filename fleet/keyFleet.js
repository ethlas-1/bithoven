/**
 * @file keyFleet.js
 * @description This module provides the KeyFleet class, which manages a fleet of keys loaded from environment variables. 
 * It includes methods for retrieving keys, checking balances, and ensuring minimum balance requirements are met for gas fees and ERC20 tokens.
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
require('dotenv').config({ path: path.resolve(__dirname, '../config/.env') });
const { providerURL, minGasFeesBalance, minERC20Balance, ERC20BuyerToken } = require('../config/chainConfig');

class KeyFleet {
  constructor() {
    this.keys = this.loadKeysFromEnv();
    this.provider = new ethers.providers.JsonRpcProvider(providerURL);
  }
  /**
   * Loads keys from environment variables.
   * 
   * @returns {Object} An object containing the keys.
   */
  loadKeysFromEnv() {
    const keys = {};
    for (const key in process.env) {
      if (key.startsWith('WALLET_')) {
        const address = key.replace('WALLET_', '');
        keys[address] = process.env[key];
      }
    }
    return keys;
  }
  /**
   * Retrieves the key for a specified address.
   * 
   * @param {string} addr - The address for which to retrieve the key.
   * @returns {string} The key for the specified address.
   */
  getKey(addr){
    return this.keys[addr];
  }
  /**
   * Retrieves all addresses in the key fleet.
   * 
   * @returns {Array<string>} An array of all addresses in the key fleet.
   */
  getAllAddresses() {
    return Object.keys(this.keys);
  }
  /**
   * Exports all addresses in the key fleet to a specified file path.
   * 
   * @param {string} filePath - The file path to which to export the addresses.
   */
  exportAllAddresses(filePath) {
    const addresses = this.getAllAddresses();
    const data = {
      holderAddresses: addresses
    };
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  }
  /**
   * Retrieves all addresses in the key fleet as a data object.
   * 
   * @returns {Object} An object containing all addresses in the key fleet.
   */
  getAllAddresses2() {
    const addresses = this.getAllAddresses();
    const data = {
      holderAddresses: addresses
    };
    return data;
  }
  /**
   * Checks if a specified address meets the minimum gas fees balance requirement.
   * 
   * @param {string} fleetAddress - The address to check.
   * @returns {Promise<boolean>} True if the address meets the minimum gas fees balance, otherwise false.
   */
  async meetMinimumGasFeesBalance(fleetAddress) {
    try {
      const balanceWei = await this.provider.getBalance(fleetAddress);
      const balanceEth = ethers.utils.formatEther(balanceWei);
      console.log(`ETH balance for ${fleetAddress}: ${balanceEth} ETH`);
      return ethers.BigNumber.from(balanceWei).gte(minGasFeesBalance);
    } catch (error) {
      console.error(`Error checking gas fees balance for ${fleetAddress}:`, error);
      return false;
    }
  }
/**
 * Checks if the fleet address has enough balance to cover the gas fees for a transaction
 * using the current gas price and the specified gas limit.
 *
 * @param {string} fleetAddress - The address of the fleet.
 * @param {number} gasLimit - The gas limit for the transaction.
 * @returns {Promise<boolean>} A promise that resolves to true if the balance is sufficient, otherwise false.
 */
async meetMinimumGasFeesBalanceUsingCurrentGasPrice(fleetAddress, gasLimit) {
  try {
    const gasPrice = await this.provider.getGasPrice();
    const balance = await this.provider.getBalance(fleetAddress);

    const requiredGasFees = gasPrice.mul(ethers.BigNumber.from(gasLimit));
    //console.log("        balance: " + balance.toString());
    //console.log("requiredGasFees: " + requiredGasFees.toString());
    //console.log("gasPrice " + gasPrice);
    return balance.gte(requiredGasFees);
  } catch (error) {
    console.error(`[BuyGofer] Error checking gas fees balance: ${error.message}`);
    this.logger.logError({ msg: `Error checking gas fees balance for ${fleetAddress}: ${error.message}` }, 'CHECK_GAS_FEES_ERROR');
    throw error;
  }
}
  /**
   * Retrieves the ERC20 balance for a specified address.
   * 
   * @param {string} fleetAddress - The address to check.
   * @returns {Promise<ethers.BigNumber>} The ERC20 balance for the specified address.
   */
  async getERC20Balance(fleetAddress) {
    try {
      const contract = new ethers.Contract(
        ERC20BuyerToken,
        ['function balanceOf(address) view returns (uint256)'],
        this.provider
      );
      const balanceWei = await contract.balanceOf(fleetAddress);
      const balanceERC20 = ethers.utils.formatEther(balanceWei);
      console.log(`ERC20 balance for ${fleetAddress}: ${balanceERC20} tokens`);
      return balanceWei;
    } catch (error) {
      console.error(`Error checking ERC20 balance for ${fleetAddress}:`, error);
      throw error;
    }
  }
  /**
   * Checks if an address is part of the key fleet.
   * 
   * @param {string} address - The address to check.
   * @returns {boolean} True if the address is in the key fleet, otherwise false.
   */
  isAddressInKeyFleet(address) {
    return this.keys.hasOwnProperty(address);
  }
  /**
   * Checks if a specified address meets the minimum ERC20 balance requirement.
   * 
   * @param {string} fleetAddress - The address to check.
   * @returns {Promise<boolean>} True if the address meets the minimum ERC20 balance, otherwise false.
   */
  async meetMinimumERC20Balance(fleetAddress) {
    try {
      const balanceWei = await this.getERC20Balance(fleetAddress);
      const balanceERC20 = ethers.utils.formatEther(balanceWei);
      console.log(`ERC20 balance for ${fleetAddress}: ${balanceERC20} tokens`);
      return ethers.BigNumber.from(balanceWei).gte(minERC20Balance);
    } catch (error) {
      console.error(`Error checking ERC20 balance for ${fleetAddress}:`, error);
      return false;
    }
  }
}

module.exports = KeyFleet;
