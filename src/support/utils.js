/**
 * Clamps a number between a lower and upper bound.
 * @param {number} number The number to clamp.
 * @param {number} lower The lower bound.
 * @param {number} upper The upper bound.
 * @returns {number} The clamped number.
 */
export function clamp(number, lower, upper) {
  return Math.max(lower, Math.min(number, upper));
}

/**
 * Creates a unique ID for a hyperedge.
 * @param {string} type The type of the hyperedge.
 * @param {string[]} args The arguments of the hyperedge.
 * @returns {string} The unique ID.
 */
export function id(type, args) {
  return `${type}(${args.join(',')})`;
}

/**
 * Hashes a string to a 32-bit integer.
 * @param {string} str The string to hash.
 * @returns {number} The hash code.
 */
export function hash(str) {
  return [...str].reduce((h, c) => ((h << 5) - h + c.codePointAt(0)) >>> 0, 0);
}
