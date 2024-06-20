/**
 * @file ChainHolderInvestmentsFullSweep.js
 * @description This module handles the full sweep of chain holder investments, processing sell rules for each holder and gamer.
 * The ChainHolderInvestmentsFullSweep class reads holder addresses, processes sell rules, and evaluates sell actions.
 * 
 */
// scripts/tradesExecution/ChainHolderInvestmentsFullSweep.js
const fs = require('fs-extra');
const path = require('path');
const { JSONStore } = require('../../store/JSONStore');
const KeyFleet = require('../../fleet/keyFleet');
const { processJsonSellRules, evaluateAndInvokeSell, processJsonBuyRules, evaluateAndInvokeBuy} = require('../../common/rulesEngineLib');

const jobsConfigPath = path.resolve(__dirname, '../../config/jobsConfig.json');
const schemaFilePath = path.resolve(__dirname, '../../schema/tradeSchema.json');
const sellRulesFilePath = path.resolve(__dirname, '../../rules/sell/sellRules.json');
const buyRulesFilePath = path.resolve(__dirname, '../../rules/buy/buyRules.json');

const invokedBy = "chainHolderInvestmentsFullSweep";

class ChainHolderInvestmentsFullSweep {
    constructor() {
        this.fleet = new KeyFleet();
        this.store = new JSONStore();
        this.jobsConfig = this.readJobsConfig();
        this.schema = JSON.parse(fs.readFileSync(schemaFilePath, 'utf-8'));
        this.sellRules = this.processSellRules();
        this.buyRules = this.processBuyRules();
    }
    /**
     * Processes the sell rules from the JSON document.
     *
     * @returns {Object} The processed sell rules.
     */
    processSellRules() {
        const jsonDocument = JSON.parse(fs.readFileSync(sellRulesFilePath, 'utf-8'));
        const rules = processJsonSellRules(jsonDocument, this.schema, invokedBy);
        return rules;
    }
        /**
     * Processes the buy rules from the JSON document.
     *
     * @returns {Object} The processed sell rules.
     */
    processBuyRules() {
        const jsonDocument = JSON.parse(fs.readFileSync(buyRulesFilePath, 'utf-8'));
        const rules = processJsonBuyRules(jsonDocument, this.schema, invokedBy);
        return rules;
    }
    /**
     * Reads holder addresses from KeyFleet.
     *
     * @returns {Promise<Array>} A promise that resolves to the holder addresses.
     * @throws {Error} Throws an error if reading addresses fails.
     */
    async readHolderAddresses() {
        try {
            const jsonData = this.fleet.getAllAddresses2();
            console.log("[chainHolderInvestmentsFullSweep] key fleet addrs:" + JSON.stringify(jsonData, null, 2));

            for (var i = 0; i < jsonData.holderAddresses.length; i++) {
                const holderPath = this.store.getHolderPath(jsonData.holderAddresses[i]);
                await fs.ensureDir(holderPath);
            }
            return jsonData.holderAddresses || [];
        } catch (error) {
            console.error('Error reading keyFleet.json:', error);
            throw error;
        }
    }
    /**
     * Reads the jobs configuration from the JSON file.
     *
     * @returns {Object} The jobs configuration.
     * @throws {Error} Throws an error if reading the jobs configuration fails.
     */
    readJobsConfig() {
        try {
            const data = fs.readFileSync(jobsConfigPath, 'utf-8');
            return JSON.parse(data);
        } catch (error) {
            console.error('Error reading jobsConfig.json:', error);
            throw error;
        }
    }
    /**
     * Adds a delay for a specified amount of time.
     *
     * @param {number} ms - The delay in milliseconds.
     * @returns {Promise} A promise that resolves after the specified delay.
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Processes holders and gamers, evaluating sell rules for each.
     *
     * @param {Array} holderAddresses - The holder addresses.
     * @param {number} functionDelay - The delay between each function invocation.
     */
    async processHoldersAndGamers(holderAddresses, functionDelay) {
        for (const holderAddress of holderAddresses) {
            const holderPath = this.store.getHolderPath(holderAddress);
            const gamerAddresses = await fs.readdir(holderPath);

            for (const gamerAddress of gamerAddresses) {

                const gamerPath = this.store.getGamerPath(holderAddress, gamerAddress);
                if ((await fs.stat(gamerPath)).isDirectory()) {

                    console.log(`[chainHolderInvestmentsFullSweep] Processing holder: ${holderAddress}, gamer: ${gamerAddress}`);
                    const ctx = {
                        invokedBy: invokedBy,
                        holder: holderAddress,
                        gamer: gamerAddress
                    };

                    if (this.sellRules) {
                        await evaluateAndInvokeSell(ctx, this.sellRules);
                    }

                    if (this.buyRules){
                        await evaluateAndInvokeBuy(ctx, this.buyRules);
                    }

                    await this.delay(functionDelay); // Delay between each function invocation
                }
            }
        }
    }
    /**
     * Starts the full sweep process, running it at specified intervals.
     */
    startFullSweep() {
        const processLoop = async () => {
            try {
                // Read the holder addresses from keyFleet
                const holderAddresses = await this.readHolderAddresses();
                await this.processHoldersAndGamers(holderAddresses, this.jobsConfig.functionDelay);
            } catch (error) {
                console.error('Error processing holders and gamers:', error);
            } finally {
                setTimeout(() => processLoop(), this.jobsConfig.fullSweepInterval); // Interval between full sweeps
            }
        };

        processLoop();
    }
}
module.exports = ChainHolderInvestmentsFullSweep;