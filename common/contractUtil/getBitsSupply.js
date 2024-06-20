const { ethers } = require('ethers');
const BitsAbi = require('../../abi/GambitBitsV3ABI.json');
/**
 * Fetches the outstanding bits supply for a specific gamer from a specified contract.
 *
 * @param {string} gamer - The address of the gamer whose bits supply is to be fetched.
 * @param {Object} provider - An instance of ethers provider to interact with the Ethereum network.
 * @param {string} contractAddress - The address of the Ethereum contract.
 * @param {(string|number)} [blockNumber='latest'] - The block number at which to fetch the bits supply. Defaults to 'latest'.
 * @returns {Promise<ethers.BigNumber>} A promise that resolves to the bits supply of the specified gamer.
 * @throws Will throw an error if the bits supply cannot be fetched.
 */
async function getBitsSupply(gamer, provider, contractAddress, blockNumber = 'latest') {
    try {
        const contract = new ethers.Contract(contractAddress, BitsAbi, provider);
        const supply = await contract.getBitsSupply(gamer, { blockTag: blockNumber });
        //console.log(`Outstanding bits for gamer ${gamer} at block ${blockNumber};  supply: ${supply.toString()}`);
        return supply;
    } catch (error) {
        console.error(`Failed to fetch bits supply: ${error.message}`);
        throw error;
    }
}

module.exports = { getBitsSupply };

