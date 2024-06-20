/**
 * Exports all addresses in the KeyFleet to a JSON file.
 */
// tools/exportKeyFleetAddrs.js
const KeyFleet = require('../fleet/keyFleet');
const path = require('path');

const manager = new KeyFleet();
const filePath = path.resolve(__dirname, '../config/keyFleet.json');

manager.exportAllAddresses(filePath);

console.log(`Addresses have been exported to ${filePath}`);
