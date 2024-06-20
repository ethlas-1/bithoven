const { ethers } = require('ethers');
const BitsAbi = require('../../abi/GambitBitsV3ABI.json');
/**
 * Fetches the price based on supply, amount, and gamer details from a specified contract.
 *
 * @param {ethers.BigNumber} supply - The supply of bits.
 * @param {ethers.BigNumber} amount - The amount of bits.
 * @param {string} gamer - The address of the gamer for whom the price is to be fetched.
 * @param {Object} provider - An instance of ethers provider to interact with the Ethereum network.
 * @param {string} contractAddress - The address of the Ethereum contract.
 * @param {(string|number)} [blockNumber='latest'] - The block number at which to fetch the price. Defaults to 'latest'.
 * @returns {Promise<ethers.BigNumber>} A promise that resolves to the price for the specified supply, amount, and gamer.
 * @throws Will throw an error if the price cannot be fetched.
 */

async function getPrice(supply, amount, gamer, provider, contractAddress, blockNumber = 'latest') {
    try {
        const contract = new ethers.Contract(contractAddress, BitsAbi, provider);
        const price = await contract.getPrice(supply, amount, gamer, { blockTag: blockNumber });
        console.log(`Price for gamer ${gamer} with supply ${supply}, amount ${amount} at block ${blockNumber}: ${price.toString()}`);
        return price;
    } catch (error) {
        console.error(`Failed to fetch price: ${error.message}`);
        throw error;
    }
}

module.exports = { getPrice };
