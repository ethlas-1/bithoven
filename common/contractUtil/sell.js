const { ethers } = require('ethers'); 
//key fleet Manager
const fleet = require('../../fleet/keyFleet');
const { sellGasLimit, contractAddress } = require('../../config/chainConfig');
const Logger = require('../logger');
const keyFleet = new fleet();
const logger = new Logger();

// Contract ABI
const contractAbi = require('../../abi/GambitBitsV3ABI.json');

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

        // Encode the function call
        const encodedData = contract.interface.encodeFunctionData('sellBits', [gamerAddress, "WELS", amount]);

        const gasPrice = await provider.getGasPrice();
        // Send the transaction
        const tx = await wallet.sendTransaction({
            to: contractAddress,
            data: encodedData,
            gasLimit: ethers.utils.hexlify(sellGasLimit), 
            gasPrice: gasPrice
        });

        // Log the transaction hash
        console.log(`Transaction sent with hash: ${tx.hash}`);
        logger.logInfo({ msg: `Transaction sent with hash: ${tx.hash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}` }, 'SELL_BITS');

        // Call the callback function if provided
        if (callback) {
            await callback(tx.hash);
        }

        // Wait for the transaction to be mined
        const receipt = await tx.wait();

        console.log(`Transaction successful with hash: ${receipt.transactionHash}`);
        logger.logInfo({ msg: `Transaction successful with hash: ${receipt.transactionHash}. Amount: ${amount}, Gamer: ${gamerAddress}, FleetAddr: ${fleetAddr}` }, 'SELL_BITS');
        return receipt.transactionHash;
    } catch (err) {
        logger.logError({ msg: `Failed to call sellBits method due to: ${err.message} wallet: ${fleetAddr} gasLimit: ${sellGasLimit}` }, 'SELL_BITS_ERROR');
        console.error(`Failed to call sellBits method due to: ${err.message}`);
        return "error";
    }
}

module.exports = { sellBits };
