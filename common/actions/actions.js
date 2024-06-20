/**
 * @file action.js
 * @description This script contains implementations for adjusting and proposing buy and sell orders for bits.
 * It utilizes the TxGofer class to handle the order processing and the TradeUtil class to perform necessary adjustments.
 * The script includes two main functions: buyUpToImpl and sellBitImpl, which handle the buying and selling operations respectively.
 * @module action
 */

const Logger = require('../logger');
const TradeUtil = require('../trade/tradeUtil');
const TxGofer = require('../../fleet/txGofer');
const { providerURL } = require('../../config/chainConfig');
const { ethers } = require('ethers');
const logger = new Logger();

// Setup provider using the RPC URL from chainConfig
const provider = new ethers.providers.JsonRpcProvider(providerURL);

// Create an instance of TxGofer
const txGofer = new TxGofer(provider, TxGofer.ROLE_PRODUCER);

/**
 * Adjusts the buy target amount and proposes a buy order if the adjusted quantity is greater than zero.
 * @param {Object} ctx - The context object containing information about the gamer and the rule.
 * @param {number} quantity - The quantity of bits to buy.
 */

async function buyUpToImpl(ctx, quantity) {
  //console.log(`buyUpToImpl(${JSON.stringify(ctx)}, ${quantity})`);
  //console.log(`buyUpToImpl called with ctx: ${JSON.stringify(ctx)}, quantity: ${quantity}`);

  // Adjust the buy target amount
  const adjustedQuantity = await TradeUtil.adjustBuyTargetAmount(ctx.gamer, quantity);
  
  if (adjustedQuantity > 0) {
    const ruleId = ctx.rule.ruleID;
    const invokedBy = ctx.invokedBy;

    await txGofer.proposeOrder(ctx.gamer, 'BUY', adjustedQuantity, ruleId, invokedBy);

    let obj = {
      "action": "proposedOrder",
      "funcName" : "buyUpTo",
      "adjustedNumberOfBits": adjustedQuantity,
      "gamer": ctx.gamer,
      "ruleId": ruleId,
      "invokedBy": invokedBy
    }

    logger.logInfo(obj);
  } else {
    const proposedSum = await TradeUtil.getProposedSum(ctx.gamer, 'BUY');
    if (proposedSum >0){
      // reminder for buyGofer to take a look at proposed transactions
      await txGofer.raiseAlert(ctx.gamer, 'BUY');
    }
    console.log(`No bits to buy after adjustment for gamer: ${ctx.gamer}`);
  }
}

/**
 * Adjusts the sell target amount and proposes a sell order if the adjusted quantity is greater than zero.
 * Note that quantity is the output of quantity functions specified in sell rules (e.g., bitProfitThreshold)
 * @param {Object} ctx - The context object containing information about the gamer, holder, and the rule.
 */
async function sellBitImpl(ctx) {
  //console.log(`######################sellBitImpl called with ctx: ${JSON.stringify(ctx)}, quantity: ${ctx.quantity}`);
   
  if (ctx.quantity == 0){
    return;
  }

  // Adjust the sell target amount
  const adjustedQuantity = await TradeUtil.adjustSellTargetAmount(ctx.gamer, ctx.holder, ctx.quantity);
  
  if (adjustedQuantity > 0) {
    const ruleId = ctx.rule.ruleID;
    const invokedBy = ctx.invokedBy;

    await txGofer.proposeOrder(ctx.gamer, 'SELL', adjustedQuantity, ruleId, invokedBy, ctx.holder);

    let obj = {
      "action": "proposedOrder",
      "funcName" : "sellBit",
      "adjustedNumberOfBits": adjustedQuantity,
      "holder": ctx.holder,
      "gamer": ctx.gamer,
      "ruleId": ruleId,
      "invokedBy": invokedBy
    }

    logger.logInfo(obj);
  } else {
    const proposedSum = await TradeUtil.getProposedSum(ctx.gamer, 'SELL', ctx.holder);
    if (proposedSum >0){
      // reminder for sellGofer to take a look at proposed transactions
      await txGofer.raiseAlert(ctx.gamer, 'SELL');
    }

    console.log(`No bits to sell after adjustment for gamer: ${ctx.gamer}, holder: ${ctx.holder}`);
  }
}

/**
 * Adjusts the sell target amount and proposes a sell order if the adjusted quantity is greater than zero.
 * Will select fleet address with the largest stake in specifc gamer that is passed in via context
 * @param {Object} ctx - The context object containing information about the gamer, holder, and the rule.
 */
async function sellBitFromAutoSelectedFleetKeyImpl(ctx, amount) {
  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }

  const amountInt = parseInt(amount, 10);

  if (amountInt == 0){
    return;
  }

  const holder = await TradeUtil.getLargestKeyFleetOwnerOfGamer(ctx.gamer);

  // Adjust the sell target amount
  const adjustedQuantity = await TradeUtil.adjustSellTargetAmount(ctx.gamer, holder, amountInt);
  
  if (adjustedQuantity > 0) {
    const ruleId = ctx.rule.ruleID;
    const invokedBy = ctx.invokedBy;

    await txGofer.proposeOrder(ctx.gamer, 'SELL', adjustedQuantity, ruleId, invokedBy, holder);

    let obj = {
      "action": "proposedOrder",
      "funcName" : "sellBit",
      "adjustedNumberOfBits": adjustedQuantity,
      "holder": holder,
      "gamer": ctx.gamer,
      "ruleId": ruleId,
      "invokedBy": invokedBy
    }

    logger.logInfo(obj);
  } else {
    const proposedSum = await TradeUtil.getProposedSum(ctx.gamer, 'SELL', holder);
    if (proposedSum >0){
      // reminder for sellGofer to take a look at proposed transactions
      await txGofer.raiseAlert(ctx.gamer, 'SELL');
    }

    console.log(`No bits to sell after adjustment for gamer: ${ctx.gamer}, holder: ${holder}`);
  }
}

module.exports = {
  buyUpToImpl,
  sellBitImpl,
  sellBitFromAutoSelectedFleetKeyImpl
};
