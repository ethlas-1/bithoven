// fleet/test/testTxGofer.js
const assert = require('assert');
const ethers = require('ethers');
const TxGofer = require('../txGofer');
const Logger = require('../../common/logger');
const { providerURL, ERC20BuyerToken, minERC20Balance } = require('../../config/chainConfig');
const KeyFleet = require('../keyFleet');
const fs = require('fs-extra');
const path = require('path');

// Setup provider using the RPC URL from chainConfig
console.log("providerURL=" + providerURL);
const provider = new ethers.providers.JsonRpcProvider(providerURL);

// Create instances of TxGofer for producer and consumer roles
const txGoferProducer = new TxGofer(provider, TxGofer.ROLE_PRODUCER);
const txGoferConsumer = new TxGofer(provider, TxGofer.ROLE_CONSUMER);

// Logger instance
const logger = new Logger();

// Create an instance of KeyFleet
const keyFleet = new KeyFleet();

// Example usage
(async () => {
  try {
    const fleetAddress1 = '0x'; //put your address here
    const fleetAddress2 = '0x'; //put your address here
    const gamerAddress = '0x'; //put your address here
    const orderType = 'BUY';
    const quantity = 10;
    const txHash1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const txHash2 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const ruleId = 'PortofolioRefresh';
    const invokedBy = 'cloudNewGamerFeed';

    // Propose a new order (producer role)
    await txGoferProducer.proposeOrder(gamerAddress, orderType, quantity, ruleId, invokedBy);
    console.log('Proposed new order.');

    // Verify the order and alert files are created
    const orderFilePath = path.join(__dirname, '../../data/orders/proposedOrders', gamerAddress);
    const alertFilePath = path.join(__dirname, '../../data/orders/proposedOrders/alerts');

    const orderFiles = await fs.readdir(orderFilePath);
    const alertFiles = await fs.readdir(alertFilePath);

    assert(orderFiles.length > 0, 'Order file should exist.');
    assert(alertFiles.length > 0, 'Alert file should exist.');

    console.log('Order file path:', orderFilePath);
    console.log('Alert file path:', alertFilePath);

    // Check if the fleet addresses meet the minimum gas fees balance
    const hasEnoughGasBalance1 = await keyFleet.meetMinimumGasFeesBalance(fleetAddress1);
    console.log('Fleet address 1 has enough balance for gas fees:', hasEnoughGasBalance1);

    const hasEnoughGasBalance2 = await keyFleet.meetMinimumGasFeesBalance(fleetAddress2);
    console.log('Fleet address 2 has enough balance for gas fees:', hasEnoughGasBalance2);

    // Check if the fleet addresses meet the minimum ERC20 token balance
    const hasEnoughERC20Balance1 = await keyFleet.meetMinimumERC20Balance(fleetAddress1);
    console.log('Fleet address 1 has enough ERC20 token balance:', hasEnoughERC20Balance1);

    const hasEnoughERC20Balance2 = await keyFleet.meetMinimumERC20Balance(fleetAddress2);
    console.log('Fleet address 2 has enough ERC20 token balance:', hasEnoughERC20Balance2);

    // Record a pending order (consumer role)
    await txGoferConsumer.recordPendingOrder(gamerAddress, orderType, quantity, fleetAddress1, txHash1);
    console.log('Recorded pending order.');

    // Refresh the pending order
    let pendingOrder = await txGoferConsumer.refreshPendingOrder(fleetAddress1);
    console.log('Refreshed pending order:', pendingOrder);

    // Assert pending order is present
    assert(pendingOrder, 'Expected pending order to be present after recording.');

    // Update the pending order - this should remove it
    await txGoferConsumer.updatePendingOrder(txHash1, fleetAddress1);
    console.log('Updated pending order and expected to be removed.');

    // Refresh again to check if it's removed
    pendingOrder = await txGoferConsumer.refreshPendingOrder(fleetAddress1);
    console.log('Pending order after removal attempt:', pendingOrder);

    // Assert pending order is removed
    assert(!pendingOrder, 'Expected pending order to be removed.');

    // Record another pending order with a different txHash (consumer role)
    await txGoferConsumer.recordPendingOrder(gamerAddress, orderType, quantity, fleetAddress1, txHash2);
    console.log('Recorded another pending order.');

    // Refresh the pending order
    pendingOrder = await txGoferConsumer.refreshPendingOrder(fleetAddress1);
    console.log('Refreshed pending order:', pendingOrder);

    // Assert pending order is present
    assert(pendingOrder, 'Expected pending order to be present after recording.');

    // Print the gas and ERC20 balances
    const gasBalance1 = ethers.utils.formatEther(await provider.getBalance(fleetAddress1));
    const gasBalance2 = ethers.utils.formatEther(await provider.getBalance(fleetAddress2));

    const erc20Contract = new ethers.Contract(ERC20BuyerToken, ['function balanceOf(address) view returns (uint256)'], provider);
    const erc20Balance1 = ethers.utils.formatEther(await erc20Contract.balanceOf(fleetAddress1));
    const erc20Balance2 = ethers.utils.formatEther(await erc20Contract.balanceOf(fleetAddress2));

    console.log(`Gas balance for ${fleetAddress1}: ${gasBalance1} ETH`);
    console.log(`Gas balance for ${fleetAddress2}: ${gasBalance2} ETH`);
    console.log(`ERC20 token balance for ${fleetAddress1}: ${erc20Balance1} tokens`);
    console.log(`ERC20 token balance for ${fleetAddress2}: ${erc20Balance2} tokens`);
  } catch (error) {
    logger.logError({ msg: error.message }, 'TX_GOFER_TEST_ERROR');
    console.error('Error:', error);
  }
})();
