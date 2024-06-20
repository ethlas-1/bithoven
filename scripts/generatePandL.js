/**
 * @file generatePandL.js
 * @description This script generates the profit and loss (P&L) report for the fleet addresses.
 * It retrieves the full store for the fleet addresses, computes the P&L, and prints the results.
 * It takes an optional block number as a command line argument to compute the P&L from that point.
 * 
 * Usage: node generatePandL.js [startStrategyBlockNumber]
 * The startStrategyBlockNumber represents the point in time when the current trade strategy started,
 * and the profits and losses should be computed from that point. Any batch with BlockNumOnWhichBitsWereBought
 * less than the startStrategyBlockNumber will be omitted from the computation.
 */

const fs = require('fs-extra');
const path = require('path');
const { JSONStore } = require('../store/JSONStore');
const KeyFleet = require('../fleet/keyFleet');
const TradeUtil = require('../common/trade/tradeUtil');

/**
 * Generates the profit and loss report.
 * It retrieves the full store for the fleet addresses, computes the P&L, and prints the results.
 */
async function generatePandL() {
  try {
    // Parse the optional command line argument for the start strategy block number
    const startStrategyBlockNumber = process.argv[2] ? parseInt(process.argv[2], 10) : undefined;

    if (startStrategyBlockNumber && isNaN(startStrategyBlockNumber)) {
      throw new Error('Invalid start strategy block number provided. It should be a valid number.');
    }

    // Create an instance of JSONStore
    const jsonStore = new JSONStore();
    
    // Create an instance of KeyFleet
    const keyFleet = new KeyFleet();
    
    // Get all fleet key addresses
    const fleetAddresses = keyFleet.getAllAddresses();
    
    // Get the full store for the fleet addresses
    const fullStore = await jsonStore.getFullStore(fleetAddresses);
    
    // Compute the profit and loss
    const pandLResults = await TradeUtil.computePandL(fullStore, startStrategyBlockNumber);
    
    // Print the result to the console
    console.log(JSON.stringify(pandLResults, null, 2));

    //console.log(JSON.stringify(fullStore, null, 2));
  } catch (error) {
    console.error('Error generating P&L:', error);
  }
}

// Run the function
generatePandL().catch(error => {
  console.error('Error running generatePandL:', error);
});
