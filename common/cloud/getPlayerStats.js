/**
 * @file getPlayerStats.js
 * @description This module provides a function to fetch player statistics from the cloud. 
 * It uses the player's wallet address to query the player stats service and returns the player's stats data.
 * @module getPlayerStats
 */

const axios = require('axios');
const { PlayerStatsError } = require('./cloudErrors');
const { playerStatsSettings  } = require('../../config/cloudConfig');
/**
 * Fetches player statistics from the cloud based on the given wallet address.
 * @param {string} walletAddr - The wallet address of the player.
 * @returns {Promise<Object>} - The player's statistics data.
 * @throws {PlayerStatsError} - If there is an error retrieving player stats.
 */
async function getPlayerStats(walletAddr) {
  try {
    const response = await axios.get(playerStatsSettings.statsUrl, {
      params: {
        wallet: walletAddr
      }
    });
    if (response.data.message === 'success') {
      return response.data.data;
    } else {
      throw new PlayerStatsError('Failed to retrieve player stats');
    }
  } catch (error) {
    if (error.response) {
      // Server responded with a status other than 2xx
      throw new PlayerStatsError(`Server error: ${error.response.status} - ${error.response.data}`);
    } else if (error.request) {
      // No response received from server
      throw new PlayerStatsError('No response received from server');
    } else {
      // Error setting up the request
      throw new PlayerStatsError(`Error setting up request: ${error.message}`);
    }
  }
}

module.exports = getPlayerStats;
