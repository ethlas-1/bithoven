/**
 * @file investor.js
 * @description This script initializes and manages the chain indexer, new gamer feed, and holder investments sweep.
 * It ensures that the indexer fetches events periodically and triggers new gamer processing and full investment sweeps once caught up.
 * 
 * @module investor
 */
// scripts/tradesGeneration/investor.js
const ChainIndexer = require('./chainIndexer');
const CloudNewGamerFeed = require('./cloudNewGamerFeed');
const ChainHolderInvestmentsFullSweep = require('./chainHolderInvestmentsFullSweep');
const jobsConfig = require('../../config/jobsConfig.json');
const Logger = require('../../common/logger');
const logger = new Logger();

let indexerCaughtUp = false;
/**
 * Main function to start the chain indexer, new gamer feed, and holder investments sweep.
 * It sets up periodic fetching of events and triggers additional processes once the indexer is caught up.
 */
async function main() {
  const indexer = new ChainIndexer();

  const initialTime = process.env.NEW_GAMER_BACK_IN_TIME_TEST;
  const newGamerFeedInstance = new CloudNewGamerFeed(initialTime || new Date().toISOString());
  const chainHolderInvestmentsInstance = new ChainHolderInvestmentsFullSweep();

  indexer.fetchEventsPeriodically(() => {
    if (!indexerCaughtUp) {
        console.log("--- [Investor] calling newGamerFeedInstance.startProcessingNewUsers");
        newGamerFeedInstance.startProcessingNewUsers();
        console.log("--- [Investor] calling chainHolderInvestmentsInstance.startFullSweep");
        chainHolderInvestmentsInstance.startFullSweep();
        indexerCaughtUp = true;
    }
  });
}

main().catch(error => {
  logger.logError({ msg: `Error starting ChainIndexer: ${error.message}` }, 'INVESTOR_ERROR');
  console.error('Error starting ChainIndexer:', error);
});
