// common/trade/test/testTradeUtil2.js
const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const ethers = require('ethers');
const TradeUtil = require('../tradeUtil');
const KeyFleet = require('../../../fleet/keyFleet');
const TxGofer = require('../../../fleet/txGofer');

// Create an instance of KeyFleet
const keyFleet = new KeyFleet();
const fleetAddresses = keyFleet.getAllAddresses();

// Mock data directories
const dataDir = path.join(__dirname, '../../../data');
const ordersDir = path.join(dataDir, 'orders');

// Sample data for testing
const gamerAddress = '0xabcdef1234567890abcdef1234567890abcdef12';

// Create an instance of TxGofer
const provider = new ethers.providers.JsonRpcProvider();
const txGofer = new TxGofer(provider, TxGofer.ROLE_PRODUCER);

async function setupMockData() {
  // Clean up orders directory at the beginning
  await fs.emptyDir(dataDir);

  // Ensure there are at least two fleet addresses for testing
  assert(fleetAddresses.length >= 2, 'Expected at least 2 fleet addresses.');

  // Create mock pending order for each fleet address
  for (let i = 0; i < fleetAddresses.length; i++) {
    const holderAddress = fleetAddresses[i];
    const pendingOrder = {
      gamerAddress,
      orderType: i === 0 ? 'BUY' : 'SELL', // Change the first pending order to 'BUY'
      numberOfBits: 2,
      txHash: '0x123',
      nonce: 1,
      timestamp: new Date().toISOString(),
    };
    const orderFilePath = path.join(ordersDir, holderAddress, 'pendingOrder.json');
    await fs.ensureDir(path.dirname(orderFilePath));
    await fs.writeJson(orderFilePath, pendingOrder);
  }
}

async function runTests() {
  await setupMockData();

  // Test markMinedOrder for SELL
  await txGofer.markMinedOrder(fleetAddresses[1], '0x123');
  const amountPendingSellAfterMarkMined = await TradeUtil.getAmountPending(gamerAddress, fleetAddresses[1], 'SELL');
  console.log(`Amount Pending SELL after markMinedOrder: ${amountPendingSellAfterMarkMined}`);
  assert.strictEqual(amountPendingSellAfterMarkMined, 0, `Expected pending SELL amount to be 0, but got ${amountPendingSellAfterMarkMined}`);

  // Test markMinedOrder for BUY
  await txGofer.markMinedOrder(fleetAddresses[0], '0x123');
  const amountPendingBuyAfterMarkMined = await TradeUtil.getAmountPending(gamerAddress, fleetAddresses[0], 'BUY');
  console.log(`Amount Pending BUY after markMinedOrder: ${amountPendingBuyAfterMarkMined}`);
  assert.strictEqual(amountPendingBuyAfterMarkMined, 0, `Expected pending BUY amount to be 0, but got ${amountPendingBuyAfterMarkMined}`);

  console.log('All tests passed!');
}

// Run the tests
runTests().catch(err => {
  console.error('Test failed', err);
});
