// fleet/test/testTxGofer2.js
const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const ethers = require('ethers');
const TxGofer = require('../txGofer');
const KeyFleet = require('../keyFleet');
const Logger = require('../../common/logger');
const { providerURL, maxPendingInSeconds } = require('../../config/chainConfig');

// Setup provider using the RPC URL from chainConfig
const provider = new ethers.providers.JsonRpcProvider(providerURL);

// Initialize KeyFleet to get all addresses
const keyFleet = new KeyFleet();
const fleetAddresses = keyFleet.getAllAddresses();

// Create an instance of TxGofer
const txGofer = new TxGofer(provider, TxGofer.ROLE_CONSUMER);

// Logger instance
const logger = new Logger();

// Clean up orders directory
const ordersDir = path.join(__dirname, '../../data/orders');
fs.emptyDirSync(ordersDir);

// Example usage
(async () => {
  try {
    const gamerAddress = '0x'; //put your address here
    const orderType = 'BUY';
    const numberOfBits = 10;
    const txHash1 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
    const txHash2 = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

    // Ensure we have at least 3 addresses
    assert(fleetAddresses.length >= 3, 'Expected at least 3 fleet addresses.');

    // Record a pending order for the first fleet address
    await txGofer.recordPendingOrder(gamerAddress, orderType, numberOfBits, fleetAddresses[0], txHash1);
    console.log('Recorded pending order for fleetAddress1.');

    // Select next free key slot (should be fleetAddress2)
    let selectedIndex = await txGofer.selectNextFreeKeySlot();
    assert.strictEqual(selectedIndex, 1, 'Expected fleetAddress2 to be selected.');
    console.log('Selected next free key slot:', txGofer.fleetAddresses[selectedIndex]);

    // Record a pending order for the second fleet address
    await txGofer.recordPendingOrder(gamerAddress, orderType, numberOfBits, fleetAddresses[1], txHash1);
    console.log('Recorded pending order for fleetAddress2.');

    // Select next free key slot (should be fleetAddress3)
    selectedIndex = await txGofer.selectNextFreeKeySlot();
    assert.strictEqual(selectedIndex, 2, 'Expected fleetAddress3 to be selected.');
    console.log('Selected next free key slot:', txGofer.fleetAddresses[selectedIndex]);

    // Record a pending order for the third fleet address
    await txGofer.recordPendingOrder(gamerAddress, orderType, numberOfBits, fleetAddresses[2], txHash1);
    console.log('Recorded pending order for fleetAddress3.');

    // Wait for maxPendingInSeconds + 100ms to ensure pending orders expire
    //await new Promise(resolve => setTimeout(resolve, (maxPendingInSeconds + 0.1) * 1000));

    // Refresh pending order for the first fleet address (to possibly clear expired order)

    const orderFilePath = path.join(__dirname, '../../data/orders', fleetAddresses[2], TxGofer.PENDING_ORDER_FILE);

    await fs.chmod(orderFilePath, TxGofer.TRANSACTION_MINED_MARK);
    const refreshedOrder = await txGofer.refreshPendingOrder(fleetAddresses[2]);
    console.log('Refreshed pending order for fleetAddress1:', refreshedOrder);

    // Try to select next free key slot again (should now find an available slot)
    selectedIndex = await txGofer.selectNextFreeKeySlot();
    console.log('Selected next free key slot after refresh:', txGofer.fleetAddresses[selectedIndex]);

  } catch (error) {
    logger.logError({ msg: error.message }, 'TX_GOFER_TEST_ERROR');
    console.error('Error:', error);
  }
})();
