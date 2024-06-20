const { ethers } = require('ethers');
const BitsAbi = require('../../abi/GambitBitsV3ABI.json');
/**
 * Fetches the sell price for a specified amount of bits for a gamer from a specified contract.
 *
 * @param {string} gamer - The address of the gamer for whom the sell price is to be fetched.
 * @param {ethers.BigNumber} amount - The amount of bits for which the sell price is to be fetched.
 * @param {Object} provider - An instance of ethers provider to interact with the Ethereum network.
 * @param {string} contractAddress - The address of the Ethereum contract.
 * @param {(string|number)} [blockNumber='latest'] - The block number at which to fetch the sell price. Defaults to 'latest'.
 * @returns {Promise<ethers.BigNumber>} A promise that resolves to the sell price for the specified amount of bits.
 * @throws Will throw an error if the sell price cannot be fetched.
 */
async function getSellPrice(gamer, amount, provider, contractAddress, blockNumber = 'latest') {
    try {
        const contract = new ethers.Contract(contractAddress, BitsAbi, provider);
        const sellPrice = await contract.getSellPrice(gamer, amount, { blockTag: blockNumber });
        console.log(`Sell price for gamer ${gamer} with amount ${amount} at block ${blockNumber}  sell price: ${sellPrice.toString()}`);
        return sellPrice;
    } catch (error) {
        console.error(`Failed to fetch sell price: ${error.message}`);
        throw error;
    }
}

module.exports = { getSellPrice };
