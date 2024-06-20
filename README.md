# Bithoven

## About This Project

Welcome to the Gambit Algorithmic Trading System AKA Bithoven! Bithoven lets you run your own customized investment strategy on the Gambit contract deployed on the Base network. With Bithoven, you can buy and sell player bits (represented by their web3 address in the contract) based on numerous signals and trends (e.g., bits in circulation, win rate, trading activity on the most recent block, and much more!). All of this can be done from your own desktop (or in the cloud) with very minimal system requirements.

By following the instructions in this guide, you will be able to set up and run your own Bithoven bot for trading on the Gambit contract. Happy trading!

## System Requirements

- **OS:** A Linux-based system (e.g., Debian, Ubuntu, etc.). This will also work from a Mac shell!
- **Software:** Node.js (v18.11 or greater), npm, pm2
- **Storage:** Bithoven uses the local file system to persist state. It is safe to [wipe out the state](#data-directory-cleanup-tool) and start from scratch any time, as the blockchain (BASE) on which the [Gambit contract](https://basescan.org/address/0x25ae3e0099f4Ceb8b70a8b800c788c612163A538#code) is deployed is used as the source of truth. All positions and trades made by the Bithoven operator are rebuilt by the Bithoven blockchain [indexer component](#how-to-start-your-bot) that processes all trade events emitted by the Gambit contract.

## Installation

Clone the repository:
**Change the git url below to the actual git url when made**

```env
git clone <git url>
cd bithoven
npm install
```

Install [pm2](https://pm2.keymetrics.io/docs/usage/quick-start/) globally:

```env
npm install -g pm2
```

## Network Requirements

To connect to the Base network, you will need an RPC URL. Here is an example of the URL:

`BASE_PROVIDER_URL=https://base-mainnet.core.chainstack.com/your-api-key`

This setup has been tested and confirmed to work with [Chainstack](https://chainstack.com). To use Chainstack nodes, you will need to purchase the [Growth plan](https://chainstack.com/pricing/) to enable the necessary calls. The capacity in terms of the number of requests per month covered by this plan (20 million) should suffice for Bithoven blockchain indexing requirements.

For [Alchemy](https://www.alchemy.com) nodes, you will need to purchase their premium plan as well to run it on there.

List of calls made during indexing:

```env
eth_chainId
eth_getLogs
eth_getBlockByNumber
eth_call
eth_blockNumber
```

## Gambit Contract

The Gambit contract used by Bithoven is deployed to the following address: [0x25ae3e0099f4Ceb8b70a8b800c788c612163A538](https://basescan.org/address/0x25ae3e0099f4Ceb8b70a8b800c788c612163A538). The contract source code for Gambit can be viewed [here](https://basescan.org/address/0x10930f0920fdfbbe0dc7274384d31245592a006d#code).

## Key Fleet

You will need one or more Base addresses (and corresponding private keys) to trade from. While you can trade with a single key, Bithoven will not initiate a new buy/sell transaction from a key until the current one has been mined. To trade on multiple buying and selling opportunities simultaneously, Bithoven enables you to set up a key fleet to trade from. To do this, set up your `.env` file as shown below: (The .env file needs to be set in the config directory)

```env
WALLET_1="your-private-key-1"
WALLET_2="your-private-key-2"
WALLET_3="your-private-key-3"
BASE_PROVIDER_URL=https://base-mainnet.core.chainstack.com/your-api-key
```

## Funding Your Key Fleet

You will need to purchase WELS. The address for WELS is: `0x7F62ac1e974D65Fab4A81821CA6AF659A5F46298` You can get WELS by following the instructions provided on [aerodrome](https://aerodrome.finance/swap?from=eth&to=0x7f62ac1e974d65fab4a81821ca6af659a5f46298).

You will also need Base ETH. You can obtain Base ETH from major cryptocurrency exchanges like Binance or Coinbase.

## Grant allowance for Key Fleet

When one of your fleet addresses buys bits from the Gambit contract, the Gambit contract must have allowance to transfer WELS tokens from the key fleet address to the Gambit contract address. To grant allowance:

1. Navigate to the [WELS token contract](https://basescan.org/token/0x7F62ac1e974D65Fab4A81821CA6AF659A5F46298#writeContract) on Etherscan.
2. Click on the "Write Contract" tab.
3. Connect your wallet.
4. Find the "increaseAllowance" function and enter the following details:
   - `spender`: The Gambit contract address (`0x25ae3e0099f4Ceb8b70a8b800c788c612163A538`).
   - `addedValue`: Enter a high amount, e.g., `1000000` (ensure to set a value high enough to cover multiple transactions).
5. Click "Write" and confirm the transaction.

## How to Start Your Bot

Ensure your .env file is correctly set up with your wallet keys and provider URL.

**CAUTION:** Running your bot scripts manually is purely for initial experimentation. For actual trading, you should use the PM2 approach described below. There are conditions, such as faulty provider connectivity/errors, where the indexer (investor.js) will intentionally shut down, counting on PM2 to automatically restart, so that it can pick up indexing from the last successfully persisted contract event.

To start your bot manually:

### Start both the investor script and the trade gofer script at the same time in two different shells:

Start the investor script:

```bash
node ./scripts/tradesGenaration/investor.js
```

This starts up the indexer and once it has caught up with the latest emitted events, it begins proposing trades based on ./rules/buy/buyRules.json and ./rules/sell/sellRules.json. Note that these rules are intended for you to change and customize to form your strategy! The rules need to stick to the schema format defined in the .schema directory and use the functions defined in trade/functions.js. You can do further customization by implementing and plugging in your own. For more details, see [Trading Strategies](#trading-strategies)

Start the trade gofer script:

```bash
node ./scripts/tradesExecution/tradeGofer.js
```

This script processes, schedules, and executes the trades proposed by the investor.js script. The throughput of the trades depends on the size of your keyFleet. The pending trades are temporarily tracked in the `./data/orders` directory.

### To manage the bot with PM2:

First, install PM2:

```bash
npm install -g pm2
```

Then run:

```bash
pm2 start node --time --log /tmp/investorLog.log --name investor -- --trace-uncaught ./scripts/tradesGenaration/investor.js
pm2 start node --time --log /tmp/tradeGoferLog.log --name tradeGofer -- --trace-uncaught ./scripts/tradesExecution/tradeGofer.js
pm2 save
```

### To see logs:

To see traced script execution, use:

```bash
tail -F /tmp/investorLog.log
tail -F /tmp/tradeGoferLog.log
```

To view the outcome of proposed and executed trades, check the logs directory at the root of your project (`logs/logs.info`, `logs/info.log`, `logs/warnings.log`, `logs/errors.log`). Logs are automatically rolled over when they reach the maximum size (as specified in `config/cloudConfig.js`). To receive these trade events on Slack, see the Slack configuration section below.

### To stop:

```bash
pm2 stop investor
pm2 stop tradeGofer
```

For more details on how to use PM2, refer to the [PM2 Documentation](https://pm2.keymetrics.io/docs/usage/quick-start/).

## Slack Setup

This setup is optional (this information is also logged to the `logs` directory). However, if you would like to receive trade status/warnings and any errors on Slack, do the following:

1. **Create a Slack App**:
   - Go to the [Slack API: Applications](https://api.slack.com/apps) page.
   - Click on "Create New App".
   - Choose "From scratch" and provide a name for your app and select the Slack workspace where you want to install the app.
2. **Configure OAuth & Permissions**:

   - Navigate to "OAuth & Permissions" under "Features".
   - Scroll down to "Scopes" and add the following bot token scopes:
     - `chat:write`
     - `channels:read`
     - `groups:read`
     - `im:read`
     - `mpim:read`
   - Click "Save Changes".

3. **Install App to Workspace**:

   - Go back to "OAuth & Permissions".
   - Scroll up to "OAuth Tokens for Your Workspace" and click "Install App to Workspace".
   - Complete the installation and copy the "Bot User OAuth Token".

4. **Add Your Slack API Key to .env File**:
   - In your `.env` file, add the following line with your copied token:
     ```plaintext
     slack_key="your-slack-api-key"
     ```

This will enable the bot to send notifications and updates directly to your Slack channel.

## Example .env File

Here is an example of a complete `.env` file:
(The .env file needs to be set in the config directory)

```env
slack_key="xxxxx"
WALLET_1="xxxxx"
WALLET_2="xxxxx"
WALLET_3="xxxxx"
BASE_PROVIDER_URL="https://base-mainnet.core.chainstack.com/your-api-key"
```

## Trading Strategies

This section explains various buy and sell strategies that can be implemented to optimize your bot's trading performance. To implement a given strategy, you should paste the corresponding rules into the `rules/buy/buyRules.json` for buy strategies and `rules/sell/sellRules.json` for sell strategies.

All strategies shown below can be found in `rules/buy/exampleStrategies` and `rules/sell/exampleStrategies`.

### Buy Strategies

1. **New Gamer Strategies**

   ```json
   [
     {
       "ruleID": "newUser",
       "invokeBy": ["cloudNewGamerFeed"],
       "conditions": [
         {
           "expression": "gamerWithinMaxAge(60)"
         },
         {
           "expression": "gamerTotalBitsInCirculation('<', 5)"
         }
       ],
       "action": "buyUpTo(2)"
     }
   ]
   ```

   This strategy buys bits for users who have registered within the last 60 minutes and have fewer than 5 bits in circulation. It aims to capitalize on new users entering the market. Note that if the conditions evaluate to true, the `buyUpTo` function ensures that the entire key fleet owns no more than 2 bits of the gamer that met the above conditions.

   The configuration-driven strategy makes it easy to compose your own conditions, specify your own parameter values, and more without writing any additional code.

2. **Skilled Gamer Strategy**

   ```json
   [
     {
       "ruleID": "experiencedGamer",
       "invokeBy": ["chainIndexer"],
       "conditions": [
         {
           "expression": "gamesPlayed('>', 20)"
         },
         {
           "expression": "gamerTotalBitsInCirculationExcludeOwnStake('>', 20)"
         }
       ],
       "action": "buyUpTo(3)"
     },
     {
       "ruleID": "triggerhappy",
       "invokeBy": ["chainIndexer"],
       "conditions": [
         {
           "expression": "gamerSumKills('>=', 15)"
         },
         {
           "expression": "gamerBitWithinMaxBuyPrice(6)"
         }
       ],
       "action": "buyUpTo(2)"
     },
     {
       "ruleID": "skilledGamer",
       "invokeBy": ["chainIndexer"],
       "conditions": [
         {
           "expression": "gamerTotalBitsInCirculation('<', 10)"
         },
         {
           "expression": "gamerWinRate('>', 40)"
         }
       ],
       "action": "buyUpTo(1)"
     }
   ]
   ```

   This set of rules targets experienced gamers by considering factors like the number of games played, total bits in circulation excluding their own stake, sum of kills, and win rate. It aims to invest in gamers who show consistent and high performance.

3. **Trending Gamer Strategy**

   ```json
   [
     {
       "ruleID": "trendingUpUser",
       "invokeBy": ["chainIndexer"],
       "conditions": [
         {
           "expression": "gamerSupplyUpTick(3)"
         },
         {
           "expression": "gamerTotalBitsInCirculationExcludeOwnStake('>', 5)"
         },
         {
           "expression": "gamerTotalBitsInCirculationExcludeOwnStake('<', 10)"
         }
       ],
       "action": "buyUpTo(3)"
     }
   ]
   ```

   This strategy buys bits when a gamer's bit supply is trending upwards within a specified range. It aims to take advantage of positive trends in a gamer's performance and bit accumulation.

### Sell Strategies

1. **Close Out All Positions Strategy**

   ```json
   [
     {
       "ruleID": "portfolioRefresh",
       "invokeBy": ["chainHolderInvestmentsFullSweep"],
       "quantity": "holderOwnedBitAge('>', 1)",
       "action": "sellBit()"
     }
   ]
   ```

   This strategy sells all bits owned by the keyFleet that are older than one minute. It is used to quickly liquidate the entire portfolio. This strategy illustrates the use of quantity instead of conditions. The function in the `quantity` field (`holderOwnedBitAge`) retrieves the number of bits owned by the keyFleet that are older than one minute and passes this value to the `sellBit` function. This applies to any gamer owned by any one of the keyFleet keys. If the value is 0, meaning no criteria match, then `sellBit` will not sell anything.

2. **Profit Taking Example**

   ```json
   [
     {
       "ruleID": "profitTaking",
       "invokeBy": ["chainHolderInvestmentsFullSweep"],
       "quantity": "bitProfitThreshold(10)",
       "action": "sellBit()"
     }
   ]
   ```

   This strategy sells bits that have reached a target profit threshold (e.g., 10%). It is designed to take profits when the bits have appreciated in value.

3. **Trending Down User Example**

   ```json
   [
     {
       "ruleID": "trendingDownUser",
       "invokeBy": ["chainIndexer"],
       "conditions": [
         {
           "expression": "gamerSupplyDownTick(2)"
         },
         {
           "expression": "gamerTotalBitsInCirculationExcludeOwnStake('<', 5)"
         }
       ],
       "action": "sellBitFromAutoSelectedFleetKey(1000000)"
     }
   ]
   ```

   This strategy sells all bits owned by the keyFleet if a gamer's bit supply is trending downwards. It aims to cut losses by liquidating positions when negative trends are detected.

### Notes

- `ruleID` is an identifier used for logging purposes and has no actual meaning in the execution of the rules.
- `conditions` are boolean expressions that must be met for the actions to be executed.
- `actions` are the operations that will be carried out if the conditions are met.
- You can specify any number of rule objects in the `buyRules` and `sellRules` files.
- The action function is only executed if all conditions evaluate to true.
- In a condition, you can enumerate any number of expressions.
- `invokedBy` represents the system component that will execute your rule.
  - There are three system components for this:
    - `cloudNewGamerFeed` - pulls off-chain new Gambit player records.
    - `chainIndexer` - processes all new blocks looking for events emitted by the Gambit contract.
    - `chainHolderInvestmentsFullSweep` - periodically triggers rules on all gamer bits owned by the key fleet.
- Note that either `conditions` or the `quantity` field needs to be specified (quantity examples shown in the sell section).
- The complete list of supported functions and valid parameter values are defined in the next section, followed by how to extend and implement your own custom function.

### Profit and Loss (P&L) Report

#### How to Run

To generate the profit and loss (P&L) report for the fleet addresses:

1. Navigate to the `bithoven` directory.
2. Run the following command:

   ```bash
   node tools/generatePandL.js
   ```

   This script retrieves the full store for the fleet addresses, computes the P&L, and prints the results.

   #### Running with a Specific Strategy Block Number

   You can also provide a specific block number to compute the P&L from that point onward. For example:

   ```bash
   node tools/generatePandL.js 14543534
   ```

   This will calculate profit and loss starting from the block number `14543534`, which is the point in time when your strategy was deployed.

## Budget Control for Bithoven Strategy

Once you have configured, tested, and are ready to deploy your trading strategy with Bithoven, it's essential to manage the amount of WELS that your strategy can utilize effectively. The simplest way to control this is by limiting the total funds you transfer into your key fleet. For instance, you could allocate 200 WELS across 4 keys.

The trading system is designed to handle situations where it fully invests all allocated WELS into gamer bits. In such scenarios, the system will only execute sell bit orders until additional WELS are available. This ensures that the strategy continues to operate smoothly without exceeding the available budget.

To evaluate the performance of your strategy, you can use the `tools/generatePandL.js` tool. This tool helps you analyze profits and losses, enabling you to make informed decisions about your strategy.

Based on the evaluation, you have several options:

- **Stop the Scripts:** If the strategy is not performing as expected, you can halt the execution and consider developing a new strategy.
- **Lock in Profits:** If the strategy is profitable, you can withdraw funds from the key fleet to secure your gains.
- **Continue Execution:** You may choose to let the strategy run if it's meeting your expectations. Any WELS earned from sales will be reinvested into the key fleet, allowing the strategy to continue its trading activities.

## Explanation of Functions Used in Rules

Below is a description of the functions that you can use in the rules, along with their parameters:

### bitProfitThreshold(value)

Evaluates if the bits held by the gamer meet a specified profit threshold.

**Parameters:**

- `value`: The profit threshold percentage.

### buyUpTo(value)

Proposes to buy up to a specified amount of bits.

**Parameters:**

- `value`: The maximum amount of bits to buy.

### gamesPlayed(operator, gamesPlayed)

Evaluates the number of games played by the gamer and checks if it meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `gamesPlayed`: The number of games played.

### gamerBitWithinMaxBuyPrice(value)

Checks if the current buy price of bits for a gamer is within a specified maximum price.

**Parameters:**

- `value`: The maximum buy price.

### gamerBitsWithinMaxIdleTime(value)

Checks if the gamer's bits have been idle within a specified maximum time.

**Parameters:**

- `value`: The maximum idle time in hours.

### gamerSumKills(operator, sumKills)

Evaluates the gamer's sum of kills and checks if it meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `sumKills`: The sum of kills.

### gamerSupplyDownTick(value)

Checks if the gamer's supply has decreased by a specified tick amount.

**Parameters:**

- `value`: The number of bits that were sold on a recent block.

### gamerSupplyUpTick(value)

Checks if the gamer's supply has increased by a specified tick amount.

**Parameters:**

- `value`: The number of bits that were bought on a recent block.

### gamerTotalBitsInCirculation(operator, value)

Evaluates the total number of bits in circulation for the gamer and checks if it meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `value`: The target number of bits.

### gamerTotalBitsInCirculationExcludeOwnStake(operator, value)

Evaluates the total number of bits in circulation for the gamer, excluding their own stake, and checks if it meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `value`: The target number of bits.

### gamerWithinMaxAge(value)

Checks if the gamer's wallet was created within the specified number of minutes.

**Parameters:**

- `value`: The maximum age of the wallet in minutes.

### gamerWinRate(operator, value)

Evaluates the gamer's win rate and checks if it meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `value`: The win rate.

### holderOwnedBitAge(operator, value)

Evaluates if the holder-owned bits' age meets the specified condition.

**Parameters:**

- `operator`: The comparison operator (e.g., '>', '>=', '<', '<=', '==').
- `value`: The age in minutes.

### sellBit()

Proposes to sell bits based on current context.

### sellBitFromAutoSelectedFleetKey()

Proposes to sell bits using an automatically selected key from the key fleet.

### Adding Your Own Custom Function

If you need to implement your own custom function, you must add support for it in common/functions.js, common/conditions/conditions.js, and common/actions/actions.js, following the same pattern used for the existing functions.

## Data Directory Cleanup Tool

This section describes the usage and purpose of the `scripts/deleteFileStore.js` script, which is a tool designed to reset the local data store used by the Bithoven trading system.

### deleteFileStore.js

The `deleteFileStore.js` script removes all directories in the data directory. This can be used to start clean and re-sync the data store from scratch.

### Purpose

The `deleteFileStore.js` script is used to clear all directories within the data directory. This is particularly useful when you need to reset and re-sync your local data store from scratch. This can be necessary if you encounter issues with the data store or simply want to start fresh.

### Usage Instructions

To use the `scripts/deleteFileStore.js` script, follow these steps:

1. **Stop Running Scripts:** Ensure that both the `investor.js` and `tradeGofer.js` scripts are stopped. This prevents any potential data corruption or conflicts while clearing the data store.

2. **Run the Script:** Execute the script using the command:

   ```bash
   node scripts/deleteFileStore.js
   ```

3. **Restart the Scripts**: Once the data directory has been cleared, restart the `investor.js` and `tradeGofer.js` scripts. The `investor.js` script will rebuild the local store by re-indexing all events emitted by the Gambit contract, ensuring that the local data store is fully synchronized and up-to-date.

By following these steps, you can effectively manage and maintain the integrity of your Bithoven trading system's local data store.
