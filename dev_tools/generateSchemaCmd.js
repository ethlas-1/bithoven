/**
 * @fileoverview Script to generate a JSON schema from a JSON document.
 * 
 * This script reads a JSON file specified by the command line argument,
 * generates a JSON schema using the `generate-schema` library, and saves the schema
 * to the specified output file.
 */
const generateSchema = require('generate-schema');
const fs = require('fs');
const path = require('path');

// Get the JSON file path and output schema file path from the command line arguments
const jsonFilePath = process.argv[2];
const schemaFilePath = process.argv[3];

if (!jsonFilePath || !schemaFilePath) {
  console.error('Please provide the path to the JSON file and the output schema file path.');
  process.exit(1);
}

// Read the JSON file
const jsonDocument = JSON.parse(fs.readFileSync(path.resolve(jsonFilePath), 'utf-8'));

// Generate the schema
const schema = generateSchema.json('Rules', jsonDocument);

// Save the schema to the specified file
fs.writeFileSync(path.resolve(schemaFilePath), JSON.stringify(schema, null, 2));

console.log(`Schema generated and saved to ${schemaFilePath}`);
