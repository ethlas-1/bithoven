const { ethers } = require('ethers'); // Correct import statement

/**
 * Checks if the total bit amount in the array exceeds the target amount within a given time interval.
 *
 * @param {Array} bitMovements - The array of objects containing bitAmount and timeStamp properties.
 * @param {BigNumber} amountBN - The target amount as a BigNumber.
 * @param {number} periodInMinutes - The time period in minutes to check.
 * @returns {boolean} - True if the total bit amount in the interval exceeds the target amount, otherwise false.
 */
function checkTimeIntervals(bitMovements, amountBN, periodInMinutes) {
    let totalBits = ethers.BigNumber.from(0);
    const currentTime = Date.now();

    //console.log(`Cache contents: ${JSON.stringify(bitMovements)})`);
    // Start from the end of the array
    for (let i = bitMovements.length - 1; i >= 0; i--) {
        const movement = bitMovements[i];
        const timeDifference = (currentTime - movement.timeStamp) / (1000 * 60); // Convert ms to minutes

        // If the time difference exceeds the period, stop checking
        if (timeDifference > periodInMinutes) {
            console.log("Time diff exceeds period")
            bitMovements.shift();
            break;
        }

        // Accumulate bit amounts
        totalBits = totalBits.add(movement.bitAmount);

    }
    //console.log(`amountBN: ${JSON.stringify(amountBN)}, totalBits:${totalBits})`);
    // If total exceeds the target amount, return true
    return totalBits.gte(amountBN);
          
}

module.exports = { checkTimeIntervals };
