/**
 * @file cloudErrors.js
 * @description This module defines custom error classes for handling cloud-related errors. 
 * The errors defined include PlayerStatsError for errors related to player statistics and 
 * InvalidParameterError for errors related to invalid parameters.
 * @module cloudErrors
 */
// cloud/cloudErrors.js
class PlayerStatsError extends Error {
    constructor(message) {
      super(message);
      this.name = "PlayerStatsError";
    }
  }
  
  class InvalidParameterError extends Error {
    constructor(message) {
      super(message);
      this.name = "InvalidParameterError";
    }
  }
  
  module.exports = {
    PlayerStatsError,
    InvalidParameterError
  };
  