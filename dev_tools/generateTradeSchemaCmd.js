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

// Generate the initial schema
const schema = generateSchema.json('Rules Set', jsonDocument);

// Modify the schema to make `quantity` and `conditions` mutually exclusive
schema.items.oneOf = [
  {
    "required": ["quantity"],
    "properties": {
      "quantity": {
        "type": "string"
      }
    }
  },
  {
    "required": ["conditions"],
    "properties": {
      "conditions": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "expression": {
              "type": "string"
            }
          },
          "required": ["expression"]
        }
      }
    }
  }
];

// Save the schema to the specified file
fs.writeFileSync(path.resolve(schemaFilePath), JSON.stringify(schema, null, 2));

console.log(`Schema generated and saved to ${schemaFilePath}`);
