/**
 * This module provides functions to process, evaluate, and invoke buy and sell rules 
 * in a JSON document with serialized execution. By using a shared task queue, 
 * it ensures that calls to evaluateAndInvokeBuy and evaluateAndInvokeSell are 
 * serialized, preventing any concurrency issues between them.
 * 
 * Explanation:
 * 
 * 1. Shared Task Queue: A single `TaskQueue` instance (`sharedTaskQueue`) is used 
 *    to serialize calls to both `evaluateAndInvokeBuy` and `evaluateAndInvokeSell`.
 * 
 * 2. evaluateAndInvokeBuy and evaluateAndInvokeSell: These functions add their 
 *    respective tasks to the shared queue. This ensures that no two tasks 
 *    (whether buy or sell) are executed concurrently.
 * 
 * 3. Task Processing: The `TaskQueue` class processes each task in the order they 
 *    were added, ensuring serialized execution.
 * 
 * By using this shared task queue, you ensure that calls to `evaluateAndInvokeBuy` 
 * and `evaluateAndInvokeSell` are serialized, preventing any concurrency issues 
 * between them.
 */

const validateJsonSchema = require('../common/validateJsonSchema');
const parseAndValidateExpression = require('../common/parseAndValidateExpression');
const functions = require('../common/functions');
const TaskQueue = require('./taskQueue');

// Create a shared task queue for serializing evaluateAndInvokeBuy and evaluateAndInvokeSell calls
const sharedTaskQueue = new TaskQueue();

// Shared function to process rules in a JSON document
function processJsonRules(jsonDocument, schema, role) {
  const result = validateJsonSchema(schema, jsonDocument);

  if (!result.isValid) {
    console.log(`The document is invalid:`, result.errors);
    return null;
  }

  const rules = jsonDocument
    .filter(rule => rule.invokeBy.includes(role))
    .map(rule => {
      let conditions = [];
      if (rule.conditions) {
        conditions = rule.conditions.map(condition => {
          const { functionName, args } = parseAndValidateExpression(condition.expression, functions);
          return { functionName, args };
        });
      }
      let quantity = null;
      if (rule.quantity) {
        const { functionName, args } = parseAndValidateExpression(rule.quantity, functions);
        quantity = { functionName, args };
      }
      const { functionName: actionFunctionName, args: actionArgs } = parseAndValidateExpression(rule.action, functions);
      return { conditions, quantity, action: { functionName: actionFunctionName, args: actionArgs }, ruleID: rule.ruleID };
    });

  return rules;
}

// Shared function to evaluate and invoke rules asynchronously
async function evaluateAndInvokeRulesAsync(ctx, rules) {
  //console.log(JSON.stringify(rules, null, 2));
  for (const rule of rules) {
    //console.log("-rule--------");
    //console.log(JSON.stringify(rule, null, 2));

    let allConditionsMet = true;
    if (rule.conditions.length > 0) {
      allConditionsMet = (await Promise.all(rule.conditions.map(async condition => {
        return await functions[condition.functionName](ctx, ...condition.args);
      }))).every(Boolean);
    }

    //console.log("allConditionsMet => " + allConditionsMet);

    if (allConditionsMet && rule.quantity) {
      ctx.quantity = await functions[rule.quantity.functionName](ctx, ...rule.quantity.args);
    }

    if (allConditionsMet) {
      ctx.rule = rule;
      await functions[rule.action.functionName](ctx, ...rule.action.args);
    }
  }
}

// Function to evaluate and invoke rules with serialization
async function evaluateAndInvokeRules(ctx, rules) {
  await sharedTaskQueue.add(async () => {
    await evaluateAndInvokeRulesAsync(ctx, rules);
  });
}

module.exports = {
  processJsonBuyRules: processJsonRules,
  evaluateAndInvokeBuy: evaluateAndInvokeRules,
  processJsonSellRules: processJsonRules,
  evaluateAndInvokeSell: evaluateAndInvokeRules
};
