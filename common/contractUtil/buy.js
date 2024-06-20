const { ethers } = require('ethers'); 
const fleet = require('../../fleet/keyFleet');
const { buyGasLimit, contractAddress } = require('../../config/chainConfig');
const Logger = require('../logger');
const keyFleet = new fleet();
const logger = new Logger();
const contractAbi = require('../../abi/GambitBitsV3ABI.json');

/**
 * Handles the functionality of buying bits using the GambitBitsV3 contract.
 * Sets up a wallet, encodes the function call to 'buyBits', sends the transaction,
 * and waits for the transaction to be mined.
 *
 * @param {Object} provider - The ethers provider instance.
 * @param {number} amount - The amount of bits to buy.
 * @param {string} gamerAddress - The address of the gamer.
 * @param {string} fleetAddr - The address of the fleet.
 * @param {Function} [callback] - Optional async callback function to handle the transaction hash.
 * @returns {Promise<string>} - The transaction hash if successful, otherwise "error".
 * @throws {Error} - If the buyBits function call fails.
 */
async function buyBits(provider, amount, gamerAddress, fleetAddr, callback) {
    try {
        // Set up wallet
        const wallet = new ethers.Wallet(keyFleet.getKey(fleetAddr), provider);
        const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

        // Encode the function call
        const encodedData = contract.interface.encodeFunctionData('buyBits', [gamerAddress, "WELS", amount]);

        const gasPrice = await provider.getGasPrice();
        // Send the transaction
        const tx = await wallet.sendTransaction({
            to: contractAddress,
            data: encodedData,
            gasLimit: ethers.utils.hexlify(buyGasLimit), 
            gasPrice: gasPrice
        });

        // Log the transaction hash
        console.log(`Transaction sent with hash: ${tx.hash}`);
        logger.logInfo({ msg: `Transaction sent with hash: ${tx.hash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}` }, 'BUY_BITS');

        // Call the callback function if provided
        if (callback) {
            await callback(tx.hash);
        }

        // Wait for the transaction to be mined
        const receipt = await tx.wait();

        console.log(`Transaction successful with hash: ${receipt.transactionHash}`);
        logger.logInfo({ msg: `Transaction successful with hash: ${receipt.transactionHash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}` }, 'BUY_BITS');
        return receipt.transactionHash;
    } catch (err) {
        logger.logError({ msg: `Failed to call buyBits method due to: ${err.message} wallet: ${fleetAddr} gasLimit: ${buyGasLimit}` }, 'BUY_BITS_ERROR');
        console.error(`Failed to call buyBits method due to: ${err.message}`);
        return "error";
    }
}

module.exports = { buyBits };
