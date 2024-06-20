// common/trade/test/testTradeUtil.js
const fs = require('fs-extra');
const path = require('path');
const assert = require('assert');
const TradeUtil = require('../tradeUtil');
const KeyFleet = require('../../../fleet/keyFleet');

// Create an instance of KeyFleet
const keyFleet = new KeyFleet();
const fleetAddresses = keyFleet.getAllAddresses();

// Mock data directories
const dataDir = path.join(__dirname, '../../../data');
const holdersDir = path.join(dataDir, 'holders');
const ordersDir = path.join(dataDir, 'orders');

// Sample data for testing
const gamerAddress = '0xabcdef1234567890abcdef1234567890abcdef12';
const maxBitsToSell = 10;
const maxBitsToOwn = 100;

async function setupMockData() {
  // Clean up orders directory at the beginning
  await fs.emptyDir(dataDir);

  // Ensure there are at least two fleet addresses for testing
  assert(fleetAddresses.length >= 2, 'Expected at least 2 fleet addresses.');

  // Create mock holder and gamer batch files for each fleet address
  for (const holderAddress of fleetAddresses) {
    const gamerPath = path.join(holdersDir, holderAddress, gamerAddress);
    await fs.ensureDir(gamerPath);

    const batchFile1 = {
      InitialBatchAmount: 5,
      remainingBatchAmount: 5,
      purchasePrice: '1000000000000000000',
      BlockNumOnWhichBitsWereBought: 1,
      peakSupply: '5',
    };
    await fs.writeJson(path.join(gamerPath, 'batch_1.json'), batchFile1);

    const batchFile2 = {
      InitialBatchAmount: 5,
      remainingBatchAmount: 3,
      purchasePrice: '2000000000000000000',
      BlockNumOnWhichBitsWereBought: 2,
      peakSupply: '5',
    };
    await fs.writeJson(path.join(gamerPath, 'batch_2.json'), batchFile2);
  }

  // Create mock proposed orders
  const buyOrdersDir = path.join(ordersDir, 'proposedOrders/buy', gamerAddress);
  await fs.ensureDir(buyOrdersDir);

  const sellOrdersDir = path.join(ordersDir, 'proposedOrders/sell', gamerAddress);
  await fs.ensureDir(sellOrdersDir);

  const orderFile1 = { ruleId: 'rule1', invokedBy: 'invoker1', quantity: 2 };
  await fs.writeJson(path.join(buyOrdersDir, 'order_BUY_1.json'), orderFile1);

  const orderFile2 = { ruleId: 'rule2', invokedBy: 'invoker2', quantity: 1, holderAddress: fleetAddresses[0] };
  await fs.writeJson(path.join(sellOrdersDir, 'order_SELL_1.json'), orderFile2);

  // Additional proposed orders
  const orderFile3 = { ruleId: 'rule3', invokedBy: 'invoker3', quantity: 4 };
  await fs.writeJson(path.join(buyOrdersDir, 'order_BUY_2.json'), orderFile3);

  const orderFile4 = { ruleId: 'rule4', invokedBy: 'invoker4', quantity: 3, holderAddress: fleetAddresses[1] };
  await fs.writeJson(path.join(sellOrdersDir, 'order_SELL_2.json'), orderFile4);

  const orderFile5 = { ruleId: 'rule5', invokedBy: 'invoker5', quantity: 2, holderAddress: fleetAddresses[0] };
  await fs.writeJson(path.join(sellOrdersDir, 'order_SELL_3.json'), orderFile5);

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

  // Test getBitBalanceInStore
  const balance = await TradeUtil.getBitBalanceInStore(fleetAddresses[0], gamerAddress);
  console.log(`Bit Balance: ${balance}`);
  assert.strictEqual(balance, 8, `Expected bit balance to be 8, but got ${balance}`);

  // Test getProposedSum
  const proposedBuySum = await TradeUtil.getProposedSum(gamerAddress, 'BUY');
  console.log(`Proposed BUY Sum: ${proposedBuySum}`);
  assert.strictEqual(proposedBuySum, 6, `Expected proposed BUY sum to be 6, but got ${proposedBuySum}`);

  const proposedSellSum = await TradeUtil.getProposedSum(gamerAddress, 'SELL', fleetAddresses[0]);
  console.log(`Proposed SELL Sum: ${proposedSellSum}`);
  assert.strictEqual(proposedSellSum, 3, `Expected proposed SELL sum to be 3, but got ${proposedSellSum}`);

  const proposedSellSum2 = await TradeUtil.getProposedSum(gamerAddress, 'SELL', fleetAddresses[1]);
  console.log(`Proposed SELL Sum 2: ${proposedSellSum2}`);
  assert.strictEqual(proposedSellSum2, 3, `Expected proposed SELL sum to be 3, but got ${proposedSellSum2}`);

  // Test getAmountPending
  const amountPendingBuy = await TradeUtil.getAmountPending(gamerAddress, fleetAddresses[0], 'BUY');
  console.log(`Amount Pending BUY: ${amountPendingBuy}`);
  assert.strictEqual(amountPendingBuy, 2, `Expected pending BUY amount to be 2, but got ${amountPendingBuy}`);

  const amountPendingSell = await TradeUtil.getAmountPending(gamerAddress, fleetAddresses[1], 'SELL');
  console.log(`Amount Pending SELL: ${amountPendingSell}`);
  assert.strictEqual(amountPendingSell, 2, `Expected pending SELL amount to be 2, but got ${amountPendingSell}`);

  // Test adjustSellTargetAmount
  const adjustedSellAmount = await TradeUtil.adjustSellTargetAmount(gamerAddress, fleetAddresses[0], maxBitsToSell);
  console.log(`Adjusted Sell Amount: ${adjustedSellAmount}`);
  assert.strictEqual(adjustedSellAmount, 5, `Expected adjusted sell amount to be 5, but got ${adjustedSellAmount}`);

  // Test adjustBuyTargetAmount
  // Calculate the expected adjusted buy amount
  const bitBalances = await Promise.all(fleetAddresses.map(address => TradeUtil.getBitBalanceInStore(address, gamerAddress)));
  const totalBitBalance = bitBalances.reduce((sum, balance) => sum + balance, 0);
  const pendingAmountsBuy = await Promise.all(fleetAddresses.map(address => TradeUtil.getAmountPending(gamerAddress, address, 'BUY')));
  const totalPendingAmountBuy = pendingAmountsBuy.reduce((sum, amount) => sum + amount, 0);
  const expectedAdjustedBuyAmount = maxBitsToOwn - totalBitBalance - proposedBuySum - totalPendingAmountBuy;

  const adjustedBuyAmount = await TradeUtil.adjustBuyTargetAmount(gamerAddress, maxBitsToOwn);
  console.log(`Adjusted Buy Amount: ${adjustedBuyAmount}`);
  assert.strictEqual(adjustedBuyAmount, expectedAdjustedBuyAmount, `Expected adjusted buy amount to be ${expectedAdjustedBuyAmount}, but got ${adjustedBuyAmount}`);

  // Additional tests where no more bits can be bought or sold

  // Test when maxBitsToOwn is less than the sum of bitBalance, pending, and proposed
  const lowerMaxBitsToOwn = 8;
  const adjustedBuyAmountZero = await TradeUtil.adjustBuyTargetAmount(gamerAddress, lowerMaxBitsToOwn);
  console.log(`Adjusted Buy Amount with lower maxBitsToOwn: ${adjustedBuyAmountZero}`);
  assert.strictEqual(adjustedBuyAmountZero, 0, `Expected adjusted buy amount to be 0, but got ${adjustedBuyAmountZero}`);

  // Test when maxBitsToSell is less than the sum of pending and proposed
  const lowerMaxBitsToSell = 3;
  const _adjustedSellAmount = await TradeUtil.adjustSellTargetAmount(gamerAddress, fleetAddresses[0], lowerMaxBitsToSell);
  console.log(`Adjusted Sell Amount with lower maxBitsToSell: ${_adjustedSellAmount}`);
  assert.strictEqual(_adjustedSellAmount, 3, `Expected adjusted sell amount to be 3, but got ${_adjustedSellAmount}`);

  console.log('All tests passed!');
}

// Run the tests
runTests().catch(err => {
  console.error('Test failed', err);
});
