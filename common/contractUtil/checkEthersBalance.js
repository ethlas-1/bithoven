const { ethers } = require('ethers'); // Correct import statement
/**
 * Checks the Ether balance of a specified wallet address.
 * Retrieves the balance of Ether in the specified address, converts it from wei to a human-readable format (Ether),
 * and logs the balance to the console.
 *
 * @param {string} walletAddress - The address of the wallet to check the balance for.
 * @param {Object} provider - The ethers provider instance.
 * @returns {Promise<string>} - The formatted balance in Ether.
 * @throws {Error} - If fetching the balance fails.
 */
async function checkEthersBalance(walletAddress, provider) {
    try {
        // Get the balance of Ether in the specified address
        const balance = await provider.getBalance(walletAddress);

        // Convert balance from wei to human-readable format (Ether)
        const formattedBalance = ethers.utils.formatEther(balance);
        console.log(`Ether Balance of ${walletAddress}: ${formattedBalance}`);
        return formattedBalance;
    } catch (error) {
        console.error(`Failed to fetch Ether balance: ${error.message}`);
    }
}

module.exports = { checkEthersBalance };