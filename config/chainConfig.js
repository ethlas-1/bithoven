/**
 * @file chainConfig.js
 * @description Configuration file for chain-related settings, including network configurations, gas limits, provider URLs, and contract addresses.
 * This module exports the configuration for the active network.
 */
const ethers = require("ethers");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "./.env") });

// Configuration for multiple networks
const configs = {
  base: {
    network: "Base",
    simulation: false,
    buyGasLimit: 180000,
    sellGasLimit: 180000,
    providerURL: process.env.BASE_PROVIDER_URL,
    contractAddress: "0x6b4819f78D886eF37d4f9972FD55B0302c947277",
    batchSize: 1000,
    startBlock: 15992772,
    ageOfOldestTxInHours: 12,
    blockFetchFrequency: 3000,
    catchUpDelta: 40,
    minGasFeesBalance: ethers.utils.parseEther("0.0001"), // Minimum gas fee balance in ETH
    ERC20BuyerToken: "0x7F62ac1e974D65Fab4A81821CA6AF659A5F46298",
    minERC20Balance: ethers.utils.parseEther("3"), // Minimum ERC20 token balance
    maxPendingInSeconds: 120, // Maximum pending order time in seconds
    restartDelaySeconds: 5, // in case of indexing disruption
  },
  // Add other networks here
};

// Specify the active network here
const activeNetwork = "base";

module.exports = configs[activeNetwork];
