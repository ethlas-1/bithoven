/**
 * Parses and validates a function expression against a set of known functions.
 *
 * @param {string} expression - The function expression to parse and validate.
 * @param {Object} functions - An object containing known functions as keys and their corresponding function definitions.
 * @returns {Object} An object containing the function name and its arguments.
 * @throws {Error} If the expression format is invalid, the function is unknown, or the argument count does not match the function definition.
 */
function parseAndValidateExpression(expression, functions) {
    // Clean up any extraneous characters from the expression
    const cleanedExpression = expression.replace(/['"]?\s*\)\s*['"]?$/, ')').replace(/^\s*['"]/, '');
  
    const functionPattern = /^([a-zA-Z0-9_]+)\(([^)]*)\)$/;
    const match = cleanedExpression.match(functionPattern);
  
    if (!match) {
      throw new Error(`Invalid expression format: ${expression}`);
    }
  
    const functionName = match[1];
    const argsString = match[2].trim();
  
    // Split args only if there are any, otherwise create an empty array
    const args = argsString ? argsString.split(',').map(arg => arg.trim().replace(/^['"](.*)['"]$/, '$1')) : [];
  
    if (!functions[functionName]) {
      throw new Error(`Unknown function: ${functionName}`);
    }
  
    let functionParameterCount = functions[functionName].length;
    if (functionParameterCount > 0){
      // to account for internal ctx param passed in to all functions
      functionParameterCount --;
    }
    if ((args.length ) !== functionParameterCount) {
      throw new Error(`Function ${functionName} expects ${functionParameterCount} parameters, but got ${args.length}`);
    }
  
    return { functionName, args };
  }
  
  module.exports = parseAndValidateExpression;
  
  
  