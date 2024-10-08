/**
 * @file cloudConfig.js
 * @description Configuration file for cloud-related settings, including player stats and feed URLs, logging, and Slack channels.
 * This module exports configurations for player stats, player feed, Slack channels, and logging settings.
 */

const playerStatsSettings = {
  statsUrl: "https://aws.ethlas.com/prod/wags/getPlayerStats",
};

const playerFeedSettings = {
  playersUrl:
    "https://aws.ethlas.com/prod/wags/getAllPlayers?sort=wallet_created_at&page=",
  interval: 6000,
  pageFetchThrottle: 200, //
};

const slackSettings = {
  slack_channel_info: "bithoven-logs",
  slack_channel_error: "bithoven-err",
  slack_channel_warning: "bithoven-warn",
};

const logSettings = {
  logFileSizeLimit: 1024 * 1024, // 1MB size limit for log rotation
};

const uidMappingLinks = {
  getUIDByAddress: "https://aws.ethlas.com/prod/user/getUIDByAddress",
};

const buySignatureLinks = {
  buySignatureWhitelist: "https://aws.ethlas.com/prod/user/buyWhitelistSignature",
}

module.exports = {
  playerStatsSettings,
  playerFeedSettings,
  slackSettings,
  logSettings,
  uidMappingLinks,
  buySignatureLinks
};
