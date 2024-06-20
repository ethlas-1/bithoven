/**
 * @file functions.js
 * @description This module provides functions to evaluate various conditions related to gamers and holders.
 * The conditions include checking bit age, player stats, bits supply, and other game-related metrics.
 * The functions implemented include holderOwnedBitAge, gamerWithinMaxAge, gamerTotalBitsInCirculation,
 * gamerBitsWithinMaxIdleTime, gamerBitWithinMaxBuyPrice, gamerWinRate, bitProfitThreshold, buyUpTo, and sellBit.
 * Each function utilizes underlying implementations from the conditions and actions modules.
 * 
 * @module common/functions
 */
const {
  holderOwnedBitAgeImpl,
  gamerWithinMaxAgeImpl,
  gamerTotalBitsInCirculationImpl,
  gamerBitsWithinMaxIdleTimeImpl,
  gamerBitWithinMaxBuyPriceImpl,
  gamerWinRateImpl,
  bitProfitThresholdImpl,
  gamerSupplyUpTickImpl,
  gamerSupplyDownTickImpl,
  gamerTotalBitsInCirculationExcludeOwnStakeImpl,
  gamerSumKillsImpl,
  gamesPlayedImpl
} = require('./conditions/conditions');
const { buyUpToImpl, sellBitImpl, sellBitFromAutoSelectedFleetKeyImpl } = require('./actions/actions');

async function gamerSupplyDownTick(ctx, value){
  return await gamerSupplyDownTickImpl(ctx, value);
}

async function gamerSupplyUpTick(ctx, value){
  return await gamerSupplyUpTickImpl(ctx, value);
}

async function sellBitFromAutoSelectedFleetKey(ctx, value) {
  await sellBitFromAutoSelectedFleetKeyImpl(ctx, value);
}

async function gamerTotalBitsInCirculationExcludeOwnStake(ctx, operator, value) {
  return await gamerTotalBitsInCirculationExcludeOwnStakeImpl (ctx, operator, value);
}

async function holderOwnedBitAge(ctx, operator, value) {
  return await holderOwnedBitAgeImpl(ctx, operator, value);
}

async function gamerWithinMaxAge(ctx, value) {
  return await gamerWithinMaxAgeImpl(ctx, value);
}

async function gamerTotalBitsInCirculation(ctx, operator, value) {
  return await gamerTotalBitsInCirculationImpl(ctx, operator, value);
}

async function gamerBitsWithinMaxIdleTime(ctx, value) {
  return await gamerBitsWithinMaxIdleTimeImpl(ctx, value);
}

async function gamerBitWithinMaxBuyPrice(ctx, value) {
  return await gamerBitWithinMaxBuyPriceImpl(ctx, value);
}

async function gamerWinRate(ctx, operator, value) {
  return await gamerWinRateImpl(ctx, operator, value);
}

async function gamerSumKills(ctx, operator, value) {
  return await gamerSumKillsImpl(ctx, operator, value);
}

async function gamesPlayed(ctx, operator, value) {
  return await gamesPlayedImpl(ctx, operator, value);
}

async function bitProfitThreshold(ctx, value) {
  return await bitProfitThresholdImpl(ctx, value);
}

async function buyUpTo(ctx, value) {
  await buyUpToImpl(ctx, value);
}

async function sellBit(ctx) {
  await sellBitImpl(ctx);
}

module.exports = {
  holderOwnedBitAge,
  gamerWithinMaxAge,
  gamerTotalBitsInCirculation,
  gamerBitsWithinMaxIdleTime,
  gamerBitWithinMaxBuyPrice,
  gamerWinRate,
  bitProfitThreshold,
  buyUpTo,
  sellBit,
  gamerSupplyUpTick,
  gamerSupplyDownTick,
  gamerTotalBitsInCirculationExcludeOwnStake,
  sellBitFromAutoSelectedFleetKey,
  gamerSumKills,
  gamesPlayed
};
