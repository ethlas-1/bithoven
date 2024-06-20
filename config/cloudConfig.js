/**
 * @file cloudConfig.js
 * @description Configuration file for cloud-related settings, including player stats and feed URLs, logging, and Slack channels.
 * This module exports configurations for player stats, player feed, Slack channels, and logging settings.
 */

const playerStatsSettings = {
  statsUrl: 'https://aws.ethlas.com/dev/wags/getPlayerStats'
};

const playerFeedSettings = {
  playersUrl: 'https://aws.ethlas.com/dev/wags/getAllPlayers?sort=wallet_created_at&page=',
  interval: 6000,
  pageFetchThrottle: 200 // 
};

const slackSettings = {
  slack_channel_info: "bithoven-info",
  slack_channel_error: "bithoven-errors",
  slack_channel_warning: "bithoven-warnings"
};

const logSettings = {
  logFileSizeLimit: 1024 * 1024 // 1MB size limit for log rotation
};

module.exports = { playerStatsSettings, playerFeedSettings, slackSettings, logSettings };
