const { ethers } = require('ethers');
const BitsAbi = require('../../abi/GambitBitsV3ABI.json');
/**
 * Fetches the bits balance for a specific gamer and holder from the GambitBitsV3 contract.
 * Creates a contract instance using ethers.js and calls the bitsBalance method to retrieve the balance.
 *
 * @param {string} gamer - The address of the gamer.
 * @param {string} holder - The address of the holder.
 * @param {Object} provider - The ethers provider instance.
 * @param {string} contractAddress - The address of the GambitBitsV3 contract.
 * @param {string} [blockNumber='latest'] - The block number to query the balance at (default is 'latest').
 * @returns {Promise<ethers.BigNumber>} - The bits balance of the holder for the specified gamer.
 * @throws {Error} - If fetching the balance fails.
 */
async function getBitsBalance(gamer, holder, provider, contractAddress, blockNumber = 'latest') {
    try {
        // Create a contract instance
        const contract = new ethers.Contract(contractAddress, BitsAbi, provider);

        // Call the bitsBalance getter method with the specified block number
        const balance = await contract.bitsBalance(gamer, holder, { blockTag: blockNumber });

        // Log the balance
        console.log(`Bits balance of holder ${holder} for gamer ${gamer} at block ${blockNumber}: ${balance.toString()}`);
        return balance;
    } catch (error) {
        console.error(`Failed to fetch bits balance: ${error.message}`);
        throw error;
    }
}

module.exports = { getBitsBalance };