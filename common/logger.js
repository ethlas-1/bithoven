/**
 * @file logger.js
 * @description This module provides a logging utility class for logging warning, error, and info messages to log files and Slack channels. 
 * The Logger class ensures log file existence, manages log file rotation based on size, and posts log messages to specified Slack channels. 
 * It supports logging at different levels (Warning, Error, Info) and includes error codes where applicable.
 * 
 * @module common/logger
 */
const fs = require('fs');
const path = require('path');
const { logSettings, slackSettings } = require('../config/cloudConfig');

// Resolve the absolute path to the postMessage.js file
const postMessagePath = path.resolve(__dirname, './contractUtil/postMessage');
const { postMessage } = require(postMessagePath);

class Logger {
  constructor() {
    this.warningLogFilePath = path.resolve(__dirname, '../logs/warnings.log');
    this.errorLogFilePath = path.resolve(__dirname, '../logs/errors.log');
    this.infoLogFilePath = path.resolve(__dirname, '../logs/info.log');
    this.logFileSizeLimit = logSettings.logFileSizeLimit; // Use the value from cloudConfig
    this.ensureLogFile(this.warningLogFilePath);
    this.ensureLogFile(this.errorLogFilePath);
    this.ensureLogFile(this.infoLogFilePath);
  }
  /**
   * Ensures the log file exists, creating it if necessary.
   *
   * @param {string} logFilePath - The path to the log file.
   */
  ensureLogFile(logFilePath) {
    const logDir = path.dirname(logFilePath);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
  }
  /**
   * Rotates the log file by renaming it with a timestamp.
   *
   * @param {string} logFilePath - The path to the log file to rotate.
   */
  rotateLogFile(logFilePath) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const newLogFilePath = `${logFilePath}.${timestamp}`;
    fs.renameSync(logFilePath, newLogFilePath);
  }
  /**
   * Checks the size of the log file and rotates it if it exceeds the size limit.
   *
   * @param {string} logFilePath - The path to the log file to check and rotate if necessary.
   */
  checkAndRotateLogFile(logFilePath) {
    if (fs.existsSync(logFilePath)) {
      const stats = fs.statSync(logFilePath);
      if (stats.size >= this.logFileSizeLimit) {
        this.rotateLogFile(logFilePath);
      }
    }
  }
  /**
   * Logs a message at the specified level, appending it to the appropriate log file and posting it to Slack.
   *
   * @param {string} level - The log level ('Warning', 'Error', 'Info').
   * @param {string} message - The message to log.
   * @param {string} logFilePath - The path to the log file.
   * @param {string} slackChannel - The Slack channel to post the message to.
   * @param {string} [errorCode=null] - An optional error code to include in the log message.
   */
  log(level, message, logFilePath, slackChannel, errorCode = null) {
    this.checkAndRotateLogFile(logFilePath);

    const timestamp = new Date().toISOString();
    const logMessage = {
      timestamp,
      level: level,
      msg: message
    };
    if (errorCode) {
      logMessage.code = errorCode;
    }
    fs.appendFileSync(logFilePath, JSON.stringify(logMessage, null, 2) + '\n');

    postMessage(slackChannel, JSON.stringify(logMessage, null, 2));

    if (level === 'Warning') {
      console.warn(logMessage);
    } else if (level === 'Error') {
      console.error(logMessage);
    } else if (level === 'Info') {
      console.log(logMessage);
    }
  }
  /**
   * Logs a warning message.
   *
   * @param {string} message - The warning message to log.
   * @param {string} [errorCode=null] - An optional error code to include in the log message.
   */
  logWarning(message, errorCode = null) {
    this.log('Warning', message, this.warningLogFilePath, slackSettings.slack_channel_warning, errorCode);
  }
  /**
   * Logs an error message.
   *
   * @param {string} message - The error message to log.
   * @param {string} errorCode - The error code to include in the log message.
   */
  logError(message, errorCode) {
    this.log('Error', message, this.errorLogFilePath, slackSettings.slack_channel_error, errorCode);
  }
  /**
   * Logs an informational message.
   *
   * @param {string} message - The informational message to log.
   * @param {string} [errorCode=null] - An optional error code to include in the log message.
   */
  logInfo(message, errorCode = null) {
    this.log('Info', message, this.infoLogFilePath, slackSettings.slack_channel_info, errorCode);
  }
}

module.exports = Logger;
