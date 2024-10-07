const { ethers } = require("ethers");
const fleet = require("../../fleet/keyFleet");
const { buyGasLimit, contractAddress } = require("../../config/chainConfig");
const { uidMappingLinks, buySignatureLinks  } = require('../../config/cloudConfig');
const Logger = require("../logger");
const keyFleet = new fleet();
const logger = new Logger();
const contractAbi = require("../../abi/BitsABI.json");
const axios = require('axios');

/**
 * Makes a POST request to the specified URL with the provided body.
 *
 * @param {string} url - The endpoint URL to send the request to.
 * @param {object} body - The JSON object to be sent as the request body.
 * @param {object} headers - (Optional) Additional headers to include in the request.
 * @returns {Promise<object>} - The response data from the POST request.
 */
async function makePostRequest(url, body, headers = {}) {
  try {
    const response = await axios.post(url, body, { headers });
    return response.data;
  } catch (error) {
    console.error(`Error making POST request to ${url}:`, error.message);
    // If there's a response error, include more details
    if (error.response) {
      console.error("Response status:", error.response.status);
      console.error("Response data:", error.response.data);
    }
    throw error;
  }
}


/**
 * Handles the functionality of buying bits using the GambitBitsV3 contract.
 * Sets up a wallet, encodes the function call to 'buyBits', sends the transaction,
 * and waits for the transaction to be mined.
 *
 * @param {Object} provider - The ethers provider instance.
 * @param {number} amount - The amount of bits to buy.
 * @param {number} tokenAmount - The amount of tokens to buy.
 * @param {string} gamerAddress - The address of the gamer.
 * @param {string} fleetAddr - The address of the fleet.
 * @param {Function} [callback] - Optional async callback function to handle the transaction hash.
 * @returns {Promise<string>} - The transaction hash if successful, otherwise "error".
 * @throws {Error} - If the buyBits function call fails.
 */
async function buyBits(
  provider,
  amount,
  tokenAmount,
  gamerAddress,
  fleetAddr,
  callback
) {
  try {
    // Set up wallet
    const wallet = new ethers.Wallet(keyFleet.getKey(fleetAddr), provider);
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    // Get the uid and playerID given the gamer address and fleet address
    const requestBodyToGetUIDs = {
      "uidAddress": `${fleetAddr.toLowerCase()}`,
      "playerIdAddress": `${gamerAddress.toLowerCase()}`
    };
    let uidResponse;
    try {
      uidResponse = await makePostRequest(uidMappingLinks.getUIDByAddress, requestBodyToGetUIDs);
      if (!uidResponse || !uidResponse.uidAddress || !uidResponse.playerIdAddress) {
        throw new Error('uidResponse did not return expected properties');
      }
      console.log("Response Data:", uidResponse);
      
    } catch (error) {
      console.error("Request failed:", error);
    }

    const signBody = {
      "uid": `${uidResponse.uidAddress.toLowerCase()}`,
      "playerId": `${uidResponse.playerIdAddress.toLowerCase()}`,
    };

    // Check and sign if the fleet address is within whitelist   
    let responseData;
    try {
      responseData = await makePostRequest(buySignatureLinks.buySignatureWhitelist, signBody );
      console.log("Response Data:", responseData);
    } catch (error) {
      console.error("Request failed:", error);
    }

    // Encode the function call
    const encodedData = contract.interface.encodeFunctionData("buyBits", [
      gamerAddress,
      'WELS',
      amount,
      tokenAmount,
      responseData?.signedPayload,
      responseData.signature.signature,
    ]);

    const gasPrice = await provider.getGasPrice();
    // Send the transaction
    const tx = await wallet.sendTransaction({
      to: contractAddress,
      data: encodedData,
      gasLimit: ethers.utils.hexlify(buyGasLimit),
      gasPrice: gasPrice,
    });

    // Log the transaction hash
    console.log(`Transaction sent with hash: ${tx.hash}`);
    logger.logInfo(
      {
        msg: `Transaction sent with hash: ${tx.hash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}`,
      },
      "BUY_BITS"
    );

    // Call the callback function if provided
    if (callback) {
      await callback(tx.hash);
    }

    // Wait for the transaction to be mined
    const receipt = await tx.wait();

    console.log(`Transaction successful with hash: ${receipt.transactionHash}`);
    logger.logInfo(
      {
        msg: `Transaction successful with hash: ${receipt.transactionHash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}`,
      },
      "BUY_BITS"
    );
    return receipt.transactionHash;
  } catch (err) {
    logger.logError(
      {
        msg: `Failed to call buyBits method due to: ${err.message} wallet: ${fleetAddr} gasLimit: ${buyGasLimit}`,
      },
      "BUY_BITS_ERROR"
    );
    console.error(`Failed to call buyBits method due to: ${err.message}`);
    return "error";
  }
}

module.exports = { buyBits };
