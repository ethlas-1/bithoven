/**
 * Validates a JSON document against a given schema using AJV (Another JSON Schema Validator).
 *
 * @param {Object} schema - The JSON schema to validate against.
 * @param {Object} jsonDocumentToValidate - The JSON document to validate.
 * @returns {Object} An object containing the validation result and any validation errors.
 */
const Ajv = require('ajv-draft-04');

function validateJsonSchema(schema, jsonDocumentToValidate) {
  // Initialize AJV
  const ajv = new Ajv();
  const validate = ajv.compile(schema);

  // Validate the document
  const valid = validate(jsonDocumentToValidate);

  return {
    isValid: valid,
    errors: validate.errors
  };
}

module.exports = validateJsonSchema;

