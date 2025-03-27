const { ethers } = require("ethers");
// Key Fleet Manager
const fleet = require("../../fleet/keyFleet");
const {
  sellGasLimit,
  contractAddress,
  contractType,
} = require("../../config/chainConfig");
const {
  uidMappingLinks,
  sellSignatureLinks,
} = require("../../config/cloudConfig"); // Added sellSignatureLinks
const Logger = require("../logger");
const keyFleet = new fleet();
const logger = new Logger();

// Contract ABI
const contractAbi = require("../../abi/GambitBitsV3ABI.json");
const axios = require("axios");

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
 * Handles the functionality of selling bits using the GambitBitsV3 contract.
 * Sets up a wallet, encodes the function call to 'sellBits', sends the transaction,
 * and waits for the transaction to be mined.
 *
 * @param {Object} provider - The ethers provider instance.
 * @param {number} amount - The amount of bits to sell.
 * @param {string} gamerAddress - The address of the gamer.
 * @param {string} fleetAddr - The address of the fleet.
 * @param {Function} [callback] - Optional async callback function to handle the transaction hash.
 * @returns {Promise<string>} - The transaction hash if successful, otherwise "error".
 * @throws {Error} - If the sellBits function call fails.
 */
async function sellBits(provider, amount, gamerAddress, fleetAddr, callback) {
  try {
    // Set up wallet
    const wallet = new ethers.Wallet(keyFleet.getKey(fleetAddr), provider);
    const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

    // Get the uid and playerID given the gamer address and fleet address
    const requestBodyToGetUIDs = {
      uidAddress: `${fleetAddr.toLowerCase()}`,
      playerIdAddress: `${gamerAddress.toLowerCase()}`,
    };
    let uidResponse;
    try {
      uidResponse = await makePostRequest(
        uidMappingLinks.getUIDByAddress,
        requestBodyToGetUIDs
      );
      if (
        !uidResponse ||
        !uidResponse.uidAddress ||
        !uidResponse.playerIdAddress
      ) {
        throw new Error("uidResponse did not return expected properties");
      }
      console.log("Response Data:", uidResponse);
    } catch (error) {
      console.error("Request failed:", error);
      throw error; // Propagate the error to be caught by the outer catch
    }

    // Prepare the signature request body
    const signBody = {
      uid: `${uidResponse.uidAddress.toLowerCase()}`,
      playerId: `${uidResponse.playerIdAddress.toLowerCase()}`,
    };

    // Request the sell signature from the sellSignatureWhitelist endpoint
    let responseData;
    try {
      responseData = await makePostRequest(
        sellSignatureLinks.sellSignatureWhitelist,
        signBody
      );
      if (
        !responseData ||
        !responseData.data.signedPayload ||
        !responseData.data.signature
      ) {
        throw new Error("responseData did not return expected properties");
      }
      console.log("Response Data:", responseData);
    } catch (error) {
      console.error("Request failed:", error);
      throw error; // Propagate the error to be caught by the outer catch
    }

    // Encode the sellBits function with the signature data
    const encodedData = contract.interface.encodeFunctionData("sellBits", [
      gamerAddress,
      contractType,
      amount,
      responseData.data.signedPayload,
      responseData.data.signature,
    ]);

    // Fetch current gas price
    const gasPrice = await provider.getGasPrice();

    // Send the transaction
    const tx = await wallet.sendTransaction({
      to: contractAddress,
      data: encodedData,
      gasLimit: ethers.utils.hexlify(sellGasLimit),
      gasPrice: gasPrice,
    });

    // Log the transaction hash
    console.log(`Transaction sent with hash: ${tx.hash}`);
    logger.logInfo(
      {
        msg: `Transaction sent with hash: ${tx.hash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}`,
      },
      "SELL_BITS"
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
      "SELL_BITS"
    );
    return receipt.transactionHash;
  } catch (err) {
    logger.logError(
      {
        msg: `Failed to call sellBits method due to: ${err.message} wallet: ${fleetAddr} gasLimit: ${sellGasLimit}`,
      },
      "SELL_BITS_ERROR"
    );
    console.error(`Failed to call sellBits method due to: ${err.message}`);
    return "error";
  }
}

module.exports = { sellBits };
