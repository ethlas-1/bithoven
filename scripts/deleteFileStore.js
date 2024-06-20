/**
 * @file deleteFileStore.js
 * @description This script removes all directories in the data directory. 
 * This can be used to start clean and re-sync the data store from scratch.
 * 
 * Usage: 
 * 1. Stop the investor.js and tradeGofer.js scripts.
 * 2. Run this script using `node deleteFileStore.js`.
 * 3. Start the investor.js and tradeGofer.js scripts again.
 * 
 * The investor.js script will recreate the local store with all the keyFleet trade positions
 * by indexing all events emitted by the Gambit contract.
 */

const fs = require('fs-extra');
const path = require('path');

async function deleteFileStore() {
  try {
    const dataDir = path.join(__dirname, '../data');
    
    if (await fs.pathExists(dataDir)) {
      const files = await fs.readdir(dataDir);
      
      for (const file of files) {
        const filePath = path.join(dataDir, file);
        if ((await fs.lstat(filePath)).isDirectory()) {
          await fs.remove(filePath);
          console.log(`Deleted directory: ${filePath}`);
        }
      }
    } else {
      console.log('Data directory does not exist.');
    }

    console.log('All directories in the data directory have been removed.');
  } catch (error) {
    console.error('Error deleting file store:', error);
  }
}

// Run the function
deleteFileStore().catch(error => {
  console.error('Error running deleteFileStore:', error);
});
