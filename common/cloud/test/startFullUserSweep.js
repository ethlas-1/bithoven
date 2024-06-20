const GamerFeed = require('../gamerFeed');

// Example callback function that processes each gamer record
async function userCallback(gamer, rules) {
    console.log('Processing new gamer:', gamer);
    console.log('Rules:', rules);

    // Example processing logic
    // You can replace this with your actual processing logic
    console.log(`Processing new gamer ${gamer.username} with wallet ${gamer.wallet_address}`);
    
    // Simulate saving the processed record's timestamp in persisted storage
    // In real implementation, you would save this in a database or file
    // For example: await saveTimestampToStorage(gamer.wallet_created_at);
}

// Current time to initialize GamerFeed
let currentTime = new Date().toISOString();

// Example rules to be passed to the callback
const rules = {
    someRule: 'exampleRuleValue'
};

// Create an instance of GamerFeed

const gamerFeed = new GamerFeed(currentTime);

// Start processing new users
gamerFeed.startFullUserSweep(userCallback, rules);

