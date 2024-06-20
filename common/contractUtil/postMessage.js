require('dotenv').config({ path: __dirname + '/../../config/.env' });
const { WebClient } = require('@slack/web-api');

// Your Slack bot token from the .env file
const token = process.env.slack_key;

// Initialize the WebClient with the token if it exists
const web = token ? new WebClient(token) : null;

/**
 * Posts a message to a Slack channel.
 *
 * @param {string} channel - The ID or name of the Slack channel where the message will be posted.
 * @param {string} text - The text of the message to post.
 * @returns {Promise<void>} A promise that resolves when the message is successfully posted.
 * @throws Will throw an error if the message cannot be posted.
 */
async function postMessage(channel, text) {
  if (!token) {
    console.log(`Simulated post to ${channel}: ${text}`);
    return;
  }

  try {
    // Use the chat.postMessage method to send a message
    const result = await web.chat.postMessage({
      channel: channel,
      text: text,
    });

    console.log(`Successfully sent message ${result.ts} in conversation ${channel}`);
  } catch (error) {
    console.error(`Error posting message: ${error}`);
  }
}

module.exports = { postMessage };

