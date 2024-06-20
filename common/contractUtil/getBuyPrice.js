const { ethers } = require('ethers');
const abi = require('../../abi/GambitBitsV3ABI.json');
/**
 * Fetches the buy price for a specified amount of bits for a gamer from a specified contract.
 *
 * @param {string} gamer - The address of the gamer for whom the buy price is to be fetched.
 * @param {ethers.BigNumber} amount - The amount of bits for which the buy price is to be fetched.
 * @param {Object} provider - An instance of ethers provider to interact with the Ethereum network.
 * @param {string} contractAddress - The address of the Ethereum contract.
 * @param {(string|number)} [blockNumber='latest'] - The block number at which to fetch the buy price. Defaults to 'latest'.
 * @returns {Promise<ethers.BigNumber>} A promise that resolves to the buy price for the specified amount of bits.
 * @throws Will throw an error if the buy price cannot be fetched.
 */
async function getBuyPrice(gamer, amount, provider, contractAddress, blockNumber = 'latest') {
    try {
        const contract = new ethers.Contract(contractAddress, abi, provider);
        const buyPrice = await contract.getBuyPrice(gamer, amount, { blockTag: blockNumber });
        console.log(`Buy price for gamer ${gamer} with amount ${amount} at block ${blockNumber}: ${buyPrice.toString()}`);
        return buyPrice;
    } catch (error) {
        console.error(`Failed to fetch buy price: ${error.message}`);
        throw error;
    }
}

module.exports = { getBuyPrice };
