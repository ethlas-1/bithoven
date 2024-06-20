/**
 * @file CloudNewGamerFeed.js
 * @description This module handles the processing of new gamers from the cloud and evaluates buy rules for them.
 * It initializes the gamer feed and starts processing new users, invoking the buy rules as needed.
 * 
 */
// scripts/tradesExecution/CloudNewGamerFeed.js
const GamerFeed = require('../../common/cloud/gamerFeed');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.resolve(__dirname, '../../config/.env') });
const { processJsonBuyRules, evaluateAndInvokeBuy } = require('../../common/rulesEngineLib');

class CloudNewGamerFeed {
    constructor(initialTime = new Date().toISOString()) {
        this.invokedBy = "cloudNewGamerFeed";
        this.schemaFilePath = path.resolve(__dirname, '../../schema/tradeSchema.json');
        this.rulesFilePath = path.resolve(__dirname, '../../rules/buy/buyRules.json');
        this.schema = JSON.parse(fs.readFileSync(this.schemaFilePath, 'utf-8'));
        this.rules = this.processBuyRules();
        this.gamerFeed = new GamerFeed(initialTime);
    }
    /**
     * Processes the buy rules from the JSON document.
     *
     * @returns {Object} The processed buy rules.
     */
    processBuyRules() {
        const jsonDocument = JSON.parse(fs.readFileSync(this.rulesFilePath, 'utf-8'));
        return processJsonBuyRules(jsonDocument, this.schema, this.invokedBy);
    }
    /**
     * Callback function for processing new gamers.
     *
     * @param {Object} gamer - The gamer object containing user details.
     */
    async newUserCallback(gamer) {
        console.log(`- [cloudNewGamerFeed] Processing new gamer ${gamer.username} with wallet ${gamer.wallet_address}`);
        if (this.rules) {
            let ctx = {
                invokedBy: this.invokedBy,
                gamer: gamer.wallet_address
            };
            console.log(" [cloudNewGamerFeed] calling evaluateAndInvokeBuy");
            await evaluateAndInvokeBuy(ctx, this.rules);
        }
    }
    /**
     * Starts processing new users, invoking the buy rules as needed.
     */
    startProcessingNewUsers() {
        this.gamerFeed.startProcessingNewUsers(this.newUserCallback.bind(this), this.rules);
    }
}

module.exports = CloudNewGamerFeed;

