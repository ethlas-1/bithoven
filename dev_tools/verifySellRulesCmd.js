/**
 * @file verifySellRulesCmd.js
 * @description This script verifies and evaluates sell rules for a given context.
 * It processes the sell rules from a JSON file and evaluates them against the provided context.
 * 
 */
const fs = require('fs');
const path = require('path');
const { ethers } = require('ethers');
const { processJsonSellRules, evaluateAndInvokeSell } = require('../common/rulesEngineLib');
const cnf = require('../config/chainConfig');
const invokedBy = "chainHolderInvestmentsFullSweep";

// Define the schema file path
const schemaFilePath = path.resolve(__dirname, '../schema/tradeSchema.json');

// Define the rules file path
const rulesFilePath = path.resolve(__dirname, '../rules/sell/sellRules.json');

// Read the schema file
const schema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'));

/**
 * Main function to execute the sell rules verification and evaluation.
 */
async function main() {
  const provider = new ethers.providers.JsonRpcProvider(cnf.providerURL);

  try {
    const latestBlockNumber = await provider.getBlockNumber();
    console.log('Latest block number:', latestBlockNumber);

    // Placeholder for the ctx object
    const ctx = {
      holder: '0xc564Aa1Fa62c09E80A7EB21BeaD181D39beC8707',
      gamer: "0x3f1Fc73223abCDC157A877a2a781E0A047687CBb",
      bitAmount: 1,
      blockNumber: latestBlockNumber
    };

    // Read and process the rules file
    const jsonDocument = JSON.parse(fs.readFileSync(rulesFilePath, 'utf-8'));
    const rules = processJsonSellRules(jsonDocument, schema, invokedBy);
    if (rules) {
      await evaluateAndInvokeSell(ctx, rules);
    }
  } catch (error) {
    console.error('Error fetching latest block number or processing rules:', error);
    process.exit(1);
  }
}

// Execute the main function
main();
