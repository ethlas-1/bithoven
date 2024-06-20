// scripts/tradesExecution/BuyGofer.js
/**
 * BuyGofer class processes buy alerts for proposed orders.
 * It checks for halt conditions, stale orders, and sufficient token balance.
 * If conditions are met, it either executes a dummy buy function or calls the actual buyBits function.
 * It records pending orders and manages alerts.
 */

const fs = require('fs-extra');
const path = require('path');
const ethers = require('ethers');
const BigNumber = require('bignumber.js');
const Logger = require('../../common/logger');
const TxGofer = require('../../fleet/txGofer');
const KeyFleet = require('../../fleet/keyFleet');
const { buyBits } = require('../../common/contractUtil/buy');
const { getBuyPrice } = require('../../common/contractUtil/getBuyPrice');
const { providerURL, simulation, contractAddress, buyGasLimit } = require('../../config/chainConfig');
const { staleBuyOrderMinutes, warningLogIntervalMinutes, preSelectSlotSleepMilliseconds } = require('../../config/jobsConfig');

const ORDERS_PATH = path.join(__dirname, '../../data/orders');

class BuyGofer {
  constructor() {
    this.provider = new ethers.providers.JsonRpcProvider(providerURL);
    this.logger = new Logger();
    this.txGofer = new TxGofer(this.provider, TxGofer.ROLE_CONSUMER);
    this.keyFleet = new KeyFleet();
    this.lastLogTime = 0;
    this.alerts = {};
  }

  /**
   * Dummy buy function to simulate buy operation.
   * @param {Object} orderData - The order data.
   * @param {string} holderAddress - The holder address.
   * @param {string} gamerAddress - The gamer address.
   */
  async dummyBuyFunction(orderData, holderAddress, gamerAddress) {
    console.log('Executing dummy buy function with order data:', orderData);
    this.logger.logInfo({ msg: `Executed dummy buy function. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}, Holder: ${holderAddress}` }, 'DUMMY_BUY_FUNCTION');
  }

  /**
   * Processes buy alerts.
   * Reads proposed orders, checks conditions, and processes orders if conditions are met.
   */
  async processBuyAlerts() {
    console.log('Processing buy alerts...');
    const buyAlertsDir = path.join(ORDERS_PATH, 'proposedOrders/buyAlerts');
    await fs.ensureDir(buyAlertsDir);

    const buyDir = path.join(ORDERS_PATH, 'proposedOrders/buy');
    await fs.ensureDir(buyDir);

    const alertFiles = await fs.readdir(buyAlertsDir);

    for (const alertFile of alertFiles) {
      const [_, gamerAddress, timestamp] = alertFile.split('_');
      this.alerts[gamerAddress] = alertFile;
    }

    for (const gamerAddress in this.alerts) {
      const currentAlertFileName = this.alerts[gamerAddress];
      const alertFilePath = path.join(buyAlertsDir, this.alerts[gamerAddress]);

      if (await fs.pathExists(alertFilePath)) {
        await fs.remove(alertFilePath);
      }

      const proposedOrdersDir = path.join(ORDERS_PATH, `proposedOrders/buy/${gamerAddress}`);
      if (!(await fs.pathExists(proposedOrdersDir))) {
        if (this.alerts[gamerAddress]) {
          delete this.alerts[gamerAddress];
        }
        continue;
      }

      const orderFiles = await fs.readdir(proposedOrdersDir);
      for (const orderFile of orderFiles) {
        const orderFilePath = path.join(proposedOrdersDir, orderFile);
        const orderData = await fs.readJson(orderFilePath);

        const fileTimestamp = new Date(orderFile.replace('.json', ''));
        const now = new Date();
        const orderAgeMinutes = (now - fileTimestamp) / (1000 * 60);

        if (orderAgeMinutes > staleBuyOrderMinutes) {
          if (await fs.pathExists(orderFilePath)) {
            await fs.remove(orderFilePath);
          }
          this.logger.logWarning({ msg: `Stale order removed. Gamer: ${gamerAddress} Order: ${JSON.stringify(orderData)}` }, 'STALE_BUY_ORDER');
          if (this.alerts[gamerAddress]) {
            delete this.alerts[gamerAddress];
          }
          continue;
        }

        const haltFilePath = path.join(ORDERS_PATH, 'haultBuy');
        if (await fs.pathExists(haltFilePath)) {
          const currentTime = Date.now();
          if (currentTime - this.lastLogTime > warningLogIntervalMinutes * 60 * 1000) {
            this.logger.logWarning({ msg: 'Buying is currently halted.' }, 'BUY_HALT');
            this.lastLogTime = currentTime;
          }
          break;
        }

        await new Promise(resolve => setTimeout(resolve, preSelectSlotSleepMilliseconds));
        const selectedIndex = await this.txGofer.selectNextFreeKeySlot();
        if (selectedIndex === -1) {
          continue;
        }

        const holderAddress = this.txGofer.fleetAddresses[selectedIndex];
        
        // Check if the holder has enough WELS to buy the target quantity at the current price
        const buyPrice = await getBuyPrice(gamerAddress, orderData.quantity, this.provider, contractAddress);
        console.log("orderData.quantity=" + orderData.quantity)
        console.log("buyPrice = " + buyPrice)
        const buyPriceBigNumber = new BigNumber(buyPrice.toString());
        console.log("buyPriceBigNumber=" + buyPriceBigNumber.toString())
        const orderQuantity = new BigNumber(orderData.quantity);
        const totalWelsNeeded = buyPriceBigNumber.multipliedBy(orderQuantity);

        const holderBalance = await this.keyFleet.getERC20Balance(holderAddress);
        console.log("holderBalance= " + holderBalance);
        const holderBalanceBigNumber = new BigNumber(holderBalance.toString());
        console.log("holderBalanceBigNumber =" + holderBalanceBigNumber.toString() )
        console.log("totalWelsNeeded= " + totalWelsNeeded.toString());

        if (holderBalanceBigNumber.isLessThan(totalWelsNeeded)) {
          this.logger.logWarning({ msg: `Aborting purchase. Key fleet address ${holderAddress} doesn't have ${totalWelsNeeded.dividedBy(1e18).toFixed(4)} WELS to buy ${orderData.quantity} bits.` }, 'INSUFFICIENT_WELS_BALANCE');
          if (await fs.pathExists(orderFilePath)) {
            await fs.remove(orderFilePath);
          }
          continue;
        }

        if (await fs.pathExists(orderFilePath)) {
          await fs.remove(orderFilePath);
        }

        // check if there is enough Gas money on the key Fleet key (holderAddres); use buyGasLimit 
        // to figure out the cost of the operation
        const hasEnoughGas = await this.txGofer.keyFleet.meetMinimumGasFeesBalanceUsingCurrentGasPrice(holderAddress, buyGasLimit);
        if (!hasEnoughGas) {
          this.logger.logWarning({ msg: `Holder address ${holderAddress} does not meet minimum gas balance requirement. Order will not be executed. Order: ${JSON.stringify(orderData)}, Gamer: ${gamerAddress}` }, 'INSUFFICIENT_GAS_BALANCE');
          continue;
        }

        if (simulation) {
          await this.dummyBuyFunction(orderData, holderAddress, gamerAddress);
          await this.txGofer.recordPendingOrder(gamerAddress, 'BUY', orderData.quantity, holderAddress, "0x");
        } else {
          let ptr = this;
          await buyBits(this.provider, orderData.quantity, gamerAddress, holderAddress,
            async function (txHash){
              // stores it beofre its mined, the file is stored so keyfleet slot is blocked until trade event is emmited
              // and in turn the pending file is marked as completed/ok to be deleted.
              await ptr.txGofer.recordPendingOrder(gamerAddress, 'BUY', orderData.quantity, holderAddress, txHash);
            });
        }


      }

      const now = Date.now();
      const alertFileTimestamp = new Date(currentAlertFileName.split('_')[2].replace('.json', ''));
      const alertAgeMinutes = (now - alertFileTimestamp) / (1000 * 60);
      if (alertAgeMinutes > staleBuyOrderMinutes) {
        if (this.alerts[gamerAddress]) {
          delete this.alerts[gamerAddress];
        }
      }
    }
  }
}

module.exports = BuyGofer;
