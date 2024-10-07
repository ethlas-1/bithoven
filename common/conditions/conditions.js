/**
 * Module that provides various condition implementations for gamers and holders.
 * Includes functions for evaluating bit age, player stats, bits supply, and more.
 * 
 * @module common/conditions/conditions
 */
const { ethers } = require('ethers');
const validateOperator = require('../../common/validateOperator');
const getPlayerStats = require('../cloud/getPlayerStats');
const { PlayerStatsError, InvalidParameterError } = require('../cloud/cloudErrors');
const { getBitsSupply } = require('../contractUtil/getBitsSupply');
const { getBuyPrice } = require('../contractUtil/getBuyPrice');
const config = require('../../config/chainConfig');
const { JSONStore} = require('../../store/JSONStore'); // Add the JSONStore import
const { JSONStoreTxHistoryError} = require('../../store/storeErrors');
let { getSellPrice } = require('../contractUtil/getSellPrice');
const Logger = require('../../common/logger');
const KeyFleet = require('../../fleet/keyFleet');
const TradeUtil = require('../trade/tradeUtil');
const logger = new Logger();
const provider = new ethers.providers.JsonRpcProvider(config.providerURL);
const keyFleet = new KeyFleet();
const fs = require('fs');
const path = require('path');
const { buySellMemCacheTtlSeconds } = require('../../config/jobsConfig');
const buyMemCache = require('memory-cache-ttl');
const sellMemCache = require('memory-cache-ttl');
const { checkTimeIntervals } = require('../contractUtil/checkTimeIntervals');
buyMemCache.init({ ttl: buySellMemCacheTtlSeconds, interval: 120, randomize: false });
sellMemCache.init({ ttl: buySellMemCacheTtlSeconds, interval: 120, randomize: false });

/**
 * Evaluates if the holder-owned bits' age meets the specified condition.
 *s
 * @param {Object} ctx - The context object containing gamer and holder fields.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} ageInMinutes - The age in minutes as a string representation of an integer.
 * @returns {Promise<number>} - The total number of bits that meet the condition.
 * @throws {InvalidParameterError} - If the ctx object does not have gamer and holder fields or if the ageInMinutes parameter is invalid.
 */
async function holderOwnedBitAgeImpl(ctx, operator, ageInMinutes) {
  if (!ctx.gamer || !ctx.holder) {
    throw new InvalidParameterError('The ctx object must have gamer and holder fields');
  }

  // Check if ageInMinutes is a string representation of an integer
  if (typeof ageInMinutes !== 'string' || !/^\d+$/.test(ageInMinutes)) {
    throw new InvalidParameterError('The ageInMinutes parameter must be a string representation of an integer');
  }

  validateOperator(operator);

  const ageInMinutesInt = parseInt(ageInMinutes, 10);
  const store = new JSONStore();
  let totalBitsMetCondition = 0;

  try {
    const batchFiles = await store.getBatchFiles(ctx.holder, ctx.gamer);
    for (const batchFile of batchFiles) {
      const batchNumber = parseInt(batchFile.match(/^batch_(\d+)\.json$/)[1], 10);
      const batch = await store.getBatchFile(ctx.holder, ctx.gamer, batchNumber);

      const blockTimestamp = await store.getBlockTimestamp(batch.BlockNumOnWhichBitsWereBought);
      const currentTime = Math.floor(Date.now() / 1000);
      const ageInSeconds = ageInMinutesInt * 60;

      let isConditionMet = false;
      switch (operator) {
        case '>':
          isConditionMet = (currentTime - blockTimestamp) > ageInSeconds;
          break;
        case '>=':
          isConditionMet = (currentTime - blockTimestamp) >= ageInSeconds;
          break;
        case '<':
          isConditionMet = (currentTime - blockTimestamp) < ageInSeconds;
          break;
        case '<=':
          isConditionMet = (currentTime - blockTimestamp) <= ageInSeconds;
          break;
        case '==':
          isConditionMet = (currentTime - blockTimestamp) === ageInSeconds;
          break;
        default:
          throw new InvalidParameterError('Invalid operator');
      }

      if (isConditionMet) {
        totalBitsMetCondition += batch.remainingBatchAmount;
      }
    }
    return totalBitsMetCondition;
  } catch (error) {
    console.error(`Error evaluating bit age: ${error.message}`);
    throw error;
  }
}

/**
 * Checks if the gamer's wallet was created within the specified number of minutes.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} minutes - The maximum age of the wallet in minutes as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the wallet is within the specified age, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the minutes parameter is invalid.
 */
async function gamerWithinMaxAgeImpl(ctx, minutes) {
  console.log(`gamerWithinMaxAgeImpl(${JSON.stringify(ctx)}, ${minutes})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  // Check if minutes is a string representation of an integer
  if (typeof minutes !== 'string' || !/^\d+$/.test(minutes)) {
    throw new InvalidParameterError('The minutes parameter must be a string representation of an integer');
  }

  // Convert minutes to an integer
  const minutesInt = parseInt(minutes, 10);

  try {
    const walletAddr = ctx.gamer;
    const stats = await getPlayerStats(walletAddr);

    // Check if wallet_created_at is present
    if (!stats.wallet_created_at) {
      logger.logWarning({ msg: `wallet_created_at field is missing in the player stats with address ${walletAddr} stats: ${JSON.stringify(stats)}` }, 'MAX_AGE_FUNCTION');
      return false;
    }

    const walletCreatedAt = new Date(stats.wallet_created_at);
    const currentTime = new Date();

    if (walletCreatedAt > currentTime) {
      throw new PlayerStatsError('wallet_created_at is in the future');
    }

    const secondsDifference = (currentTime - walletCreatedAt) / 1000;
    const minutesInSeconds = minutesInt * 60;

    // Return true if wallet_created_at is within the specified minutes in seconds, otherwise false
    let res = secondsDifference < minutesInSeconds;
    console.log(`gamerWithinMaxAgeImpl() => ${res}`);
    return res;
  } catch (error) {
    if (error instanceof PlayerStatsError || error instanceof InvalidParameterError) {
      console.error(`Error retrieving player stats: ${error.message}`);
      throw error;  // Rethrow the error if necessary
    } else {
      console.error(`Unexpected error: ${error}`);
      throw error;  // Rethrow the error if necessary
    }
  }
}

/**
 * Evaluates the total number of bits in circulation for the gamer and checks if it meets the specified condition.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} amount - The amount is the target number of bits passed in as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the amount parameter is invalid.
 */
async function gamerTotalBitsInCirculationImpl(ctx, operator, amount) {
  console.log(`gamerTotalBitsInCirculationImpl(${JSON.stringify(ctx)}, ${operator}, ${amount})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }

  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  validateOperator(operator);
  //console.log(`gamerTotalBitsInCirculationImpl called with ctx: ${JSON.stringify(ctx)}, operator: ${operator}, amount: ${amount}`);

  try {
    const { gamer } = ctx;
    const supply = await getBitsSupply(gamer, provider, config.contractAddress);
    console.log('Bits supply retrieved successfully:', supply.toString());

    // Convert amount to BigNumber for comparison
    const amountBN = ethers.BigNumber.from(amount);

    let res = false;
    // Perform the comparison based on the operator and amount
    switch (operator) {
      case '>':
        res = supply.gt(amountBN);
        break;
      case '>=':
        res = supply.gte(amountBN);
        break;
      case '<':
        res = supply.lt(amountBN);
        break;
      case '<=':
        res = supply.lte(amountBN);
        break;
      case '==':
        res = supply.eq(amountBN);
        break;
      default:
        throw new InvalidParameterError('Invalid operator');
    }
    console.log(`gamerTotalBitsInCirculationImpl(...) => ${res}`);
    return res;
  } catch (error) {
    console.error(`Error retrieving bits supply: ${error.message}`);
    throw error;
  }
}

////////////////////////////////////////////////////////////////////

/**
 * used to check if a recent purchase event is reached (or exceeded target amount), E.g., 3 or more bits were just bought.
 * bit movements beloinging to the keyfleet are excluded.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} amount - The amount is the target number of bits passed in as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 */
async function gamerSupplyUpTickImpl(ctx, amount) {
  console.log(`gamerSupplyUpTickImpl(${JSON.stringify(ctx)}, ${amount})`);
  if (!ctx.holder) {
    throw new InvalidParameterError('The ctx object must have holder field');
  }

  if (!ctx.isBuy){
    return false;
  }

  if (!ctx.bitAmount) {
    return false;
  }


  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  // Convert amount to BigNumber for comparison
  const amountBN = ethers.BigNumber.from(amount);
  const bitMoveBN = ethers.BigNumber.from(ctx.bitAmount + "");

  //console.log("tick amountBN " + amountBN.toString());
  //console.log("tick bitMoveBN " + bitMoveBN.toString());

  let res = false;
  if (bitMoveBN.gte(amountBN)) {
    // make sure to exclude movements in supply caused by own key fleet
    res = (keyFleet.isAddressInKeyFleet(ctx.holder) != true);
  }

  console.log("gamerSupplyUpTickImpl(...) => " + res);
  return res;
}

async function gamerSupplyDownTickImpl(ctx, amount) {
  console.log(`gamerSupplyDownTickImpl(${JSON.stringify(ctx)}, ${amount})`);
  if (!ctx.holder) {
    throw new InvalidParameterError('The ctx object must have holder field');
  }

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }

  if (ctx.isBuy){
    return false;
  }

  if (!ctx.bitAmount) {
    return false;
  }

  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  // Convert amount to BigNumber for comparison
  const amountBN = ethers.BigNumber.from(amount);
  const bitMoveBN = ethers.BigNumber.from(ctx.bitAmount + "");

  if (bitMoveBN.lt(amountBN)) {
    return false;
  }
  const kfAddr = await TradeUtil.getLargestKeyFleetOwnerOfGamer(ctx.gamer);
  let res = (kfAddr != null);

  console.log("gamerSupplyDownTickImpl(...) => " + res);
  return res;
}

////////////////////////////////////////////////////////////////////

/**
 * used to check if a recent purchase event is reached (or exceeded target amount), E.g., 3 or more bits were just bought.
 * bit movements beloinging to the keyfleet are excluded.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} amount - The amount is the target number of bits passed in as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 */
async function gamerBuysImpl(ctx, amount, periodInMinutes) {
  console.log(`gamerBuysImpl(${JSON.stringify(ctx)}, ${amount}, ${periodInMinutes})`);
  if (!ctx.holder) {
    throw new InvalidParameterError('The ctx object must have holder field');
  }

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }
  if (!ctx.isBuy){ // just ctx.isBuy no ! for it
    return false;
  }

  if (!ctx.bitAmount) {
    return false;
  }
  if (keyFleet.isAddressInKeyFleet(ctx.holder)){
    return false;
  }

  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  // Convert amount to BigNumber for comparison
  const amountBN = ethers.BigNumber.from(amount);
  const bitMoveBN = ethers.BigNumber.from(ctx.bitAmount + "");

  //console.log("tick amountBN " + amountBN.toString());
  //console.log("tick bitMoveBN " + bitMoveBN.toString());

  //lookup cache
  let gamerBuys = buyMemCache.get(ctx.gamer);
  
  if(!gamerBuys){
    gamerBuys = [];

  }
  gamerBuys.push({bitAmount: bitMoveBN, timeStamp: Date.now()})
  buyMemCache.set(ctx.gamer, gamerBuys);

  let res = (bitMoveBN.gte(amountBN));
  //convert to int
  periodInMinutes = parseInt(periodInMinutes, 10);
  res = checkTimeIntervals(gamerBuys, amountBN, periodInMinutes);

  if (res){
    ctx.callback = async function() {
      buyMemCache.set(ctx.gamer, []);
    }
  }

  console.log("gamerBuysImpl(...) => " + res);
  return res;
}


////////////////////////////////////////////////////////////////////

/**
 * used to check if a recent sell event is reached (or exceeded target amount), E.g., 3 or more bits were just sold.
 * bit movements beloinging to the keyfleet are excluded.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} amount - The amount is the target number of bits passed in as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 */
async function gamerSellsImpl(ctx, amount, periodInMinutes) {
  console.log(`gamerSellsImpl(${JSON.stringify(ctx)}, ${amount}, ${periodInMinutes})`);
  if (!ctx.holder) {
    throw new InvalidParameterError('The ctx object must have holder field');
  }

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }
  if (ctx.isBuy){ // just ctx.isBuy no ! for it
    return false;
  }

  if (!ctx.bitAmount) {
    return false;
  }
  if (keyFleet.isAddressInKeyFleet(ctx.holder)){
    return false;
  }

  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  // Convert amount to BigNumber for comparison
  const amountBN = ethers.BigNumber.from(amount);
  const bitMoveBN = ethers.BigNumber.from(ctx.bitAmount + "");

  //console.log("tick amountBN " + amountBN.toString());
  //console.log("tick bitMoveBN " + bitMoveBN.toString());

  //lookup cache
  let gamerSells = sellMemCache.get(ctx.gamer);

  if(!gamerSells){
    gamerSells = [];

  }
  gamerSells.push({bitAmount: bitMoveBN, timeStamp: Date.now()})
  sellMemCache.set(ctx.gamer, gamerSells);

  let res = (bitMoveBN.gte(amountBN));
  //convert to int
  periodInMinutes = parseInt(periodInMinutes, 10);
  res = checkTimeIntervals(gamerSells, amountBN, periodInMinutes);

  if (res){
    ctx.callback = async function() {
      sellMemCache.set(ctx.gamer, []);
    }
  }
  console.log("gamerSellsImpl(...) => " + res);
  return res;
}

/**
 * Checks if the current gamer's address exists in the specified whitelist.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} whitelistName - The name of the whitelist file (without the .json extension).
 * @returns {Promise<boolean>} - True if the gamer's address is in the whitelist, otherwise false.
 */
async function isGamerInWhitelistImpl(ctx, whitelistName) {
  console.log(`isGamerInWhitelistImpl(${JSON.stringify(ctx)}, ${whitelistName})`);

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  const whitelistPath = path.resolve(__dirname, ' ../../../../data/whitelist', `${whitelistName}.json`);

  // Read and parse the whitelist file
  let whitelist;
  try {
    const data = fs.readFileSync(whitelistPath, 'utf8');
    whitelist = JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read whitelist file: ${err.message}`);
    return false;
  }
  //console.log(JSON.stringify(whitelist));
  // Convert gamer's address to lowercase and check against each address in the whitelist
  const isInWhitelist = whitelist.some(addr => addr.toLowerCase() === ctx.gamer.toLowerCase());

  console.log(`isGamerInWhitelistImpl(...) => ${isInWhitelist}`);
  return isInWhitelist;
}

/**
 * Checks if the current gamer's address does not exist in the specified whitelist.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} whitelistName - The name of the whitelist file (without the .json extension).
 * @returns {Promise<boolean>} - True if the gamer's address is not in the whitelist, otherwise false.
 */
async function isGamerNotInWhitelistImpl(ctx, whitelistName) {
  console.log(`isGamerNotInWhitelistImpl(${JSON.stringify(ctx)}, ${whitelistName})`);

  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  
  const whitelistPath = path.resolve(__dirname, ' ../../../../data/whitelist', `${whitelistName}.json`);
  // Read and parse the whitelist file

  let whitelist;
  try {
    const data = fs.readFileSync(whitelistPath, 'utf8');
    whitelist = JSON.parse(data);
  } catch (err) {
    console.error(`Failed to read whitelist file: ${err.message}`);
    return false;
  }
  //console.log(JSON.stringify(whitelist));

  // Convert gamer's address to lowercase and check against each address in the whitelist
  const isNotInWhitelist = !whitelist.some(addr => addr.toLowerCase() === ctx.gamer.toLowerCase());

  console.log(`isGamerNotInWhitelistImpl(...) => ${isNotInWhitelist}`);
  return isNotInWhitelist;
}

/**
 * Evaluates the total number of bits in circulation for the gamer and checks if it meets the specified condition.
 * This version excludes bits owned by key fleet addresses.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} amount - The amount is the target number of bits passed in as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the amount parameter is invalid.
 */
async function gamerTotalBitsInCirculationExcludeOwnStakeImpl(ctx, operator, amount) {
  console.log("gamerTotalBitsInCirculationExcludeOwnStakeImpl(...)");
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }

  // Check if amount is a string representation of an integer
  if (typeof amount !== 'string' || !/^\d+$/.test(amount)) {
    throw new InvalidParameterError('The amount parameter must be a string representation of an integer');
  }

  validateOperator(operator);

  try {
    const { gamer, blockNumber } = ctx;
    const supply = await getBitsSupply(gamer, provider, config.contractAddress);
    //console.log('Bits supply retrieved successfully:', supply.toString());

    const holderAddresses = keyFleet.getAllAddresses();
    let totalBitBalanceInKeyFleet = ethers.BigNumber.from(0);

    for (const holderAddress of holderAddresses) {
      const bitBalance = await TradeUtil.getBitBalanceInStore(holderAddress, gamer);
      totalBitBalanceInKeyFleet = totalBitBalanceInKeyFleet.add(ethers.BigNumber.from(bitBalance));
    }

    let adjustedSupply = supply.sub(totalBitBalanceInKeyFleet);
    if (adjustedSupply.isNegative()) {
      adjustedSupply = ethers.BigNumber.from(0);
    }

    // Convert amount to BigNumber for comparison
    const amountBN = ethers.BigNumber.from(amount);

    //console.log(`############## circlsupply ownend by key fleet:${totalBitBalanceInKeyFleet.toString()}  adjusted supply ${adjustedSupply.toString()}`)
    //console.log("amount passed in: " + amountBN.toString())
    // Perform the comparison based on the operator and amount
    let res = false;
    switch (operator) {
      case '>':
        res =  adjustedSupply.gt(amountBN);
        break;
      case '>=':
        res = adjustedSupply.gte(amountBN);
        break;
      case '<':
        res = adjustedSupply.lt(amountBN);
        break;
      case '<=':
        res =  adjustedSupply.lte(amountBN);
        break;
      case '==':
        res =  adjustedSupply.eq(amountBN);
        break;
      default:
        throw new InvalidParameterError('Invalid operator');
    }
    console.log("gamerTotalBitsInCirculationExcludeOwnStakeImpl(...) => " + res);
    return res;
  } catch (error) {
    console.error(`Error retrieving bits supply: ${error.message}`);
    throw error;
  }
}


/**
 * Evaluates the gamer's win rate and checks if it meets the specified condition.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} winRate - The win rate as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the winRate parameter is invalid.
 */
async function gamerWinRateImpl(ctx, operator, winRate) {
  console.log(`gamerWinRateImpl(${JSON.stringify(ctx)}, ${operator} ${winRate})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  // Check if winRate is a string representation of an integer
  if (typeof winRate !== 'string' || !/^\d+$/.test(winRate)) {
    throw new InvalidParameterError('The winRate parameter must be a string representation of an integer');
  }

  validateOperator(operator);
  // Convert winRate to an integer
  const winRateInt = parseInt(winRate, 10);

  let winRateFromStats;

  try {
    if ('win_rate' in ctx) {
      winRateFromStats = ctx.win_rate;
      //console.log('Using win_rate from ctx:', winRateFromStats);
    } else {
      const walletAddr = ctx.gamer;
      const stats = await getPlayerStats(walletAddr);
      //console.log('Player stats retrieved successfully:', stats);

      // Check if win_rate is present
      if (stats.win_rate === undefined) {
        logger.logWarning({ msg: `win_rate field is missing in the player stats with address ${walletAddr} stats: ${JSON.stringify(stats)}` }, 'WIN_RAGE_FUNCTION');
        return false;
      }

      winRateFromStats = stats.win_rate;
    }

    let res = false;
    // Perform the comparison based on the operator and winRate
    switch (operator) {
      case '>':
        res = winRateFromStats > winRateInt;
        break;
      case '>=':
        res = winRateFromStats >= winRateInt;
        break;
      case '<':
        res = winRateFromStats < winRateInt;
        break;
      case '<=':
        res = winRateFromStats <= winRateInt;
        break;
      case '==':
        res = winRateFromStats == winRateInt;
        break;
      default:
        throw new InvalidParameterError('Invalid operator');
    }
    console.log(`gamerWinRateImpl(...) => ${res})`);
    return res;

  } catch (error) {
    console.error(`Error retrieving player stats: ${error.message}`);
    throw error;
  }
}
/**
 * Evaluates the gamer's sum of kills and checks if it meets the specified condition.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} sumKills - The sum of kills as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the sumKills parameter is invalid.
 */
async function gamerSumKillsImpl(ctx, operator, sumKills) {
  console.log(`gamerSumKillsImpl(${JSON.stringify(ctx)}, ${operator} ${sumKills})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  // Check if sumKills is a string representation of an integer
  if (typeof sumKills !== 'string' || !/^\d+$/.test(sumKills)) {
    throw new InvalidParameterError('The sumKills parameter must be a string representation of an integer');
  }

  validateOperator(operator);
  // Convert sumKills to an integer
  const sumKillsInt = parseInt(sumKills, 10);

  let sumKillsFromStats;

  try {
    if ('sum_kills' in ctx) {
      sumKillsFromStats = ctx.sum_kills;
      //console.log('Using sum_kills from ctx:', sumKillsFromStats);
    } else {
      const walletAddr = ctx.gamer;
      const stats = await getPlayerStats(walletAddr);
      //console.log('Player stats retrieved successfully:', stats);

      // Check if sum_kills is present
      if (stats.sum_kills === undefined) {
        logger.logWarning({ msg: `sum_kills field is missing in the player stats with address ${walletAddr} stats: ${JSON.stringify(stats)}` }, 'SUM_KILLS_FUNCTION');
        return false;
      }

      sumKillsFromStats = stats.sum_kills;
    }

    let res = false;
    // Perform the comparison based on the operator and sumKills
    switch (operator) {
      case '>':
        res = sumKillsFromStats > sumKillsInt;
        break;
      case '>=':
        res = sumKillsFromStats >= sumKillsInt;
        break;
      case '<':
        res = sumKillsFromStats < sumKillsInt;
        break;
      case '<=':
        res = sumKillsFromStats <= sumKillsInt;
        break;
      case '==':
        res = sumKillsFromStats == sumKillsInt;
        break;
      default:
        throw new InvalidParameterError('Invalid operator');
    }
    console.log(`gamerSumKillsImpl(...) => ${res})`);
    return res;

  } catch (error) {
    console.error(`Error retrieving player stats: ${error.message}`);
    throw error;
  }
}
/**
 * Evaluates the number of games played by the gamer and checks if it meets the specified condition.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} operator - The comparison operator (e.g., '>', '>=', '<', '<=', '==').
 * @param {string} gamesPlayed - The number of games played as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the condition is met, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the gamesPlayed parameter is invalid.
 */
async function gamesPlayedImpl(ctx, operator, gamesPlayed) {
  console.log(`gamesPlayedImpl(${JSON.stringify(ctx)}, ${operator} ${gamesPlayed})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  // Check if gamesPlayed is a string representation of an integer
  if (typeof gamesPlayed !== 'string' || !/^\d+$/.test(gamesPlayed)) {
    throw new InvalidParameterError('The gamesPlayed parameter must be a string representation of an integer');
  }

  validateOperator(operator);
  // Convert gamesPlayed to an integer
  const gamesPlayedInt = parseInt(gamesPlayed, 10);

  let gamesPlayedFromStats;

  try {
    if ('games_played' in ctx) {
      gamesPlayedFromStats = ctx.games_played;
      //console.log('Using games_played from ctx:', gamesPlayedFromStats);
    } else {
      const walletAddr = ctx.gamer;
      const stats = await getPlayerStats(walletAddr);
      //console.log('Player stats retrieved successfully:', stats);

      // Check if games_played is present
      if (stats.games_played === undefined) {
        logger.logWarning({ msg: `games_played field is missing in the player stats with address ${walletAddr} stats: ${JSON.stringify(stats)}` }, 'GAMES_PLAYED_FUNCTION');
        return false;
      }

      gamesPlayedFromStats = stats.games_played;
    }

    let res = false;
    // Perform the comparison based on the operator and gamesPlayed
    switch (operator) {
      case '>':
        res = gamesPlayedFromStats > gamesPlayedInt;
        break;
      case '>=':
        res = gamesPlayedFromStats >= gamesPlayedInt;
        break;
      case '<':
        res = gamesPlayedFromStats < gamesPlayedInt;
        break;
      case '<=':
        res = gamesPlayedFromStats <= gamesPlayedInt;
        break;
      case '==':
        res = gamesPlayedFromStats == gamesPlayedInt;
        break;
      default:
        throw new InvalidParameterError('Invalid operator');
    }
    console.log(`gamesPlayedImpl(...) => ${res})`);
    return res;

  } catch (error) {
    console.error(`Error retrieving player stats: ${error.message}`);
    throw error;
  }
}
/**
 * Checks if the current buy price of bits for a gamer is within a specified maximum price.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} price - The maximum buy price as a string representation of a number.
 * @returns {Promise<boolean>} - True if the buy price is within the specified maximum price, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the price parameter is invalid.
 */
async function gamerBitWithinMaxBuyPriceImpl(ctx, price) {
  console.log(`gamerBitWithinMaxBuyPriceImpl(${JSON.stringify(ctx)}, ${price})`);
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have gamer field');
  }

  // Check if price is a string representation of a number
  if (typeof price !== 'string' || isNaN(price)) {
    throw new InvalidParameterError('The price parameter must be a string representation of a number');
  }

  //console.log(`gamerBitWithinMaxBuyPriceImpl called with ctx: ${JSON.stringify(ctx)}, price: ${price}`);

  try {
    const { gamer, blockNumber } = ctx;
    const priceInWei = ethers.utils.parseEther(price); // Convert price to wei
    console.log(`Converted price to wei: ${priceInWei.toString()}`);
    const buyPrice = await getBuyPrice(gamer, 1, provider, config.contractAddress);
    console.log(`Buy price retrieved successfully: ${buyPrice.toString()}`);

    // Return true if the buyPrice is less than or equal to the priceInWei, otherwise false
    let result = buyPrice.lte(priceInWei);
    console.log(`gamerBitWithinMaxBuyPriceImpl(...) => ${result})`);
    return result;
  } catch (error) {
    console.error(`Error retrieving buy price: ${error.message}`);
    throw error;
  }
}
/**
 * Checks if the gamer's bits have been idle within a specified maximum time.
 *
 * @param {Object} ctx - The context object containing the gamer field.
 * @param {string} minutes - The maximum idle time in minutes as a string representation of an integer.
 * @returns {Promise<boolean>} - True if the bits have been idle within the specified maximum time, otherwise false.
 * @throws {InvalidParameterError} - If the ctx object does not have a gamer field or if the hours parameter is invalid.
 */
async function gamerBitsWithinMaxIdleTimeImpl(ctx, minutes) {
  if (!ctx.gamer) {
    throw new InvalidParameterError('The ctx object must have a gamer field');
  }

  // Check if minutes is a string representation of an integer
  if (typeof minutes !== 'string' || !/^\d+$/.test(minutes)) {
    throw new InvalidParameterError('The hours parameter must be a string representation of an integer');
  }

  // Convert minutes to an integer
  const minutesInt = parseInt(minutes, 10);

  const store = new JSONStore();

  try {
    const lastTransaction = await store.getLastTransaction(ctx.gamer);
    if (!lastTransaction) {
      return false;
    }

    const lastTxDate = new Date(lastTransaction.last_tx_date);
    const currentTime = new Date();

    if (lastTxDate > currentTime) {
      return false;
    }

    const secondsDifference = (currentTime - lastTxDate) / 1000;
    const minutesInSeconds = minutesInt * 60;
   
    console.log(secondsDifference < minutesInSeconds );
    // Return true if last_tx_date is within the specified hours in seconds, otherwise false
    return secondsDifference < minutesInSeconds;
  } catch (error) {
    console.error(`Error retrieving last transaction: ${error.message}`);
    throw new JSONStoreTxHistoryError('Error retrieving last transaction.', 'GET_TX_FAILED');
  }
}
/**
 * Evaluates if the bits held by the gamer meet a specified profit threshold.
 *
 * @param {Object} ctx - The context object containing gamer and holder fields.
 * @param {string} percent - The profit threshold percentage as a string representation of an integer.
 * @returns {Promise<number>} - The total number of bits that meet the profit threshold.
 * @throws {InvalidParameterError} - If the ctx object does not have gamer and holder fields or if the percent parameter is invalid.
 */
async function bitProfitThresholdImpl(ctx, percent) {
  if (!ctx.gamer || !ctx.holder ) {
    throw new InvalidParameterError('The ctx object must have gamer and holder fields');
  }

  // Check if percent is a string representation of an integer
  if (typeof percent !== 'string' || !/^\d+$/.test(percent)) {
    throw new InvalidParameterError('The percent parameter must be a string representation of an integer');
  }


  const percentInt = parseInt(percent, 10);
  const store = new JSONStore();
  let totalBitsMetCondition = 0;

  try {
    const sellPricePerBit = await getSellPrice(ctx.gamer, 1, provider, config.contractAddress);

    const batchFiles = await store.getBatchFiles(ctx.holder, ctx.gamer);
    for (const batchFile of batchFiles) {
      const batchNumber = parseInt(batchFile.match(/^batch_(\d+)\.json$/)[1], 10);
      const batch = await store.getBatchFile(ctx.holder, ctx.gamer, batchNumber);

      const purchasePricePerBit = ethers.BigNumber.from(batch.purchasePrice).div(batch.InitialBatchAmount);
      const profitThreshold = purchasePricePerBit.mul(100 + percentInt).div(100);


      if (sellPricePerBit.gte(profitThreshold)) {
        totalBitsMetCondition += batch.remainingBatchAmount;
      }
    }
    return totalBitsMetCondition;
  } catch (error) {
    console.error(`Error evaluating bit profit threshold: ${error.message}`);
    throw error;
  }
}

module.exports = {
  holderOwnedBitAgeImpl,
  gamerWithinMaxAgeImpl,
  gamerTotalBitsInCirculationImpl,
  gamerBitsWithinMaxIdleTimeImpl,
  gamerBitWithinMaxBuyPriceImpl,
  gamerWinRateImpl,
  gamerSumKillsImpl,
  gamesPlayedImpl,
  bitProfitThresholdImpl,
  gamerSupplyUpTickImpl,
  gamerSupplyDownTickImpl,
  gamerTotalBitsInCirculationExcludeOwnStakeImpl,
  gamerBuysImpl,
  gamerSellsImpl,
  isGamerInWhitelistImpl,
  isGamerNotInWhitelistImpl
};

