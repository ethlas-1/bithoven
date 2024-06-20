/**
 * Custom error class for JSONStore transaction history errors.
 * Includes an error code for more specific error handling.
 */
class JSONStoreTxHistoryError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }

  class JSONStoreError extends Error {
    constructor(message, code) {
      super(message);
      this.code = code;
    }
  }
  
  module.exports = { JSONStoreTxHistoryError, JSONStoreError };
  