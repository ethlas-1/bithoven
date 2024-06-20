/**
 * @file gamerFeed.js
 * @description This module is responsible for fetching and processing gamer feed records from the cloud. 
 * It periodically retrieves new user records, processes them, and invokes a callback for further handling.
 * @module GamerFeed
 */
// common/cloud/gamerFeed.js
const axios = require('axios');
const { playerFeedSettings } = require('../../config/cloudConfig');
const Logger = require('../logger');
const logger = new Logger();
class GamerFeed {
  // currentTime supports testing of users
  // enrolled in the past
  constructor(currentTime) {
    console.log("init time: " + currentTime);
    this.recFloorTime = new Date(currentTime).getTime(); 
  }
  /**
   * Fetches records from the gamer feed API for a specific page.
   * @param {number} page - The page number to fetch records from.
   * @returns {Promise<Array>} - An array of fetched records.
   */
  async fetchRecords(page) {
    try {
      const response = await axios.get(`${playerFeedSettings.playersUrl}${page}`);
      return response.data.data;
    } catch (error) {
      logger.logError(`[cloudNewGamerFeed] Error fetching records from page ${page}:`, error);
      return [];
    }
  }
  /**
   * Processes a single record by invoking the provided callback function.
   * @param {Object} record - The record to process.
   * @param {Function} newUserCallback - The callback function to handle the new user.
   * @param {Object} rules - The rules to be applied during processing.
   */
  async processRecord(record, newUserCallback, rules) {
    try {
      await newUserCallback(record, rules);
    } catch (error) {
      logger.logError(`[cloudNewGamerFeed] Error processing record ${record.wallet_address}:`, error);
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  /**
   * Processes new users by fetching and processing records from the gamer feed API.
   * @param {Function} newUserCallback - The callback function to handle new users.
   * @param {Object} rules - The rules to be applied during processing.
   */
  async processNewUsers(newUserCallback, rules) {
    let page = 1;
    let newRecords = true;
    let maxTimestamp = this.recFloorTime;

    //console.log("maxTimestamp: " + new Date().toISOString(maxTimestamp));
    while (newRecords) {
      console.log("[cloudNewGamerFeed] Fetched Page: " + page);
      await this.delay(playerFeedSettings.pageFetchThrottle); // Ensure some delay between fetches to avoid blasting the enpoint

      const records = await this.fetchRecords(page);

      if (records.length === 0) {
        newRecords = false;
        continue;
      }

      for (const record of records) {
        const recordTime = new Date(record.wallet_created_at).getTime();
        if (recordTime <= this.recFloorTime) {
          newRecords = false;
          break;
        }

        await this.processRecord(record, newUserCallback, rules);
        maxTimestamp = Math.max(maxTimestamp, recordTime);
      }

      page++;
    }

    this.recFloorTime = maxTimestamp;
  }
  /**
   * Processes all user records by fetching and processing records from the gamer feed API.
   * @param {Function} newUserCallback - The callback function to handle new users.
   */
  startProcessingNewUsers(newUserCallback, rules) {
    const processLoop = async () => {
      try {
        await this.processNewUsers(newUserCallback, rules);
      } catch (error) {
        logger.logError('[cloudNewGamerFeed] Error processing new records:', error);
      } finally {
        setTimeout(processLoop, playerFeedSettings.interval);
      }
    };
    processLoop();
  }
  /**
   * Processes all user records by fetching and processing records from the gamer feed API.
   * @param {Function} newUserCallback - The callback function to handle new users.
   */
  async processFullUserSweep(newUserCallback) {
    let page = 1;
    let newRecords = true;

    while (newRecords) {
      console.log("[cloudNewGamerFeed] Fetched Page: " + page);
      await this.delay(playerFeedSettings.pageFetchThrottle); // Ensure some delay between fetches to avoid blasting the enpoint

      const records = await this.fetchRecords(page);

      if (records.length === 0) {
        newRecords = false;
        continue;
      }

      for (const record of records) {
        await this.processRecord(record, newUserCallback);
      }

      page++;
    }

  }

  /**
   * Starts processing all user records in a continuous loop, periodically invoking the provided callback function.
   * @param {Function} userCallback - The callback function to handle user records.
   */
  startFullUserSweep(userCallback) {
    const _processLoop = async () => {
      try {
        await this.processFullUserSweep(userCallback);
      } catch (error) {
        logger.logError('[cloudNewGamerFeed] Error processing records:', error);
      } finally {
        setTimeout(_processLoop, playerFeedSettings.interval);
      }
    };
    _processLoop();
  }

}

module.exports = GamerFeed;
