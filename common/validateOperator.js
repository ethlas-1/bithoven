/**
 * Validates that the provided operator is one of the allowed comparison operators.
 *
 * @param {string} op - The operator to validate.
 * @throws {Error} If the operator is not a valid comparison operator.
 */
function validateOperator(op) {
    const validOperators = ["==", ">", ">=", "<=", "<"];

    if (typeof op !== "string" || op.trim() === "") {
        throw new Error("invalid operator");
    }

    if (!validOperators.includes(op)) {
        throw new Error("invalid operator");
    }
}

module.exports = validateOperator;