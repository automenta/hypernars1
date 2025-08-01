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
 * Creates a unique ID for a hyperedge or a nested structure.
 * This is a central utility for identifying concepts.
 * @param {string} type The type of the hyperedge.
 * @param {string[]} args The arguments of the hyperedge.
 * @returns {string} The unique ID.
 */
export function id(type, args) {
  const stringify = (arg) => {
      if (typeof arg === 'string') return arg;
      if (arg && arg.type && arg.args) return id(arg.type, arg.args);
      if (arg && arg.type === 'Term' && arg.args.length === 1) return arg.args[0];
      return String(arg);
  };
  const stringArgs = args.map(stringify);
  return `${type}(${stringArgs.join(',')})`;
}

/**
 * A convenience function to get a string ID from various argument formats.
 * @param {*} arg The argument to identify.
 * @returns {string} The string ID of the argument.
 */
export function getArgId(arg) {
    if (typeof arg === 'string') return arg;
    if (arg && arg.type && arg.args) return id(arg.type, arg.args);
    if (arg !== null && arg !== undefined) return String(arg);
    return 'undefined_arg';
}

/**
 * Hashes a string to a 32-bit integer.
 * @param {string} str The string to hash.
 * @returns {number} The hash code.
 */
export function hash(str) {
  return [...str].reduce((h, c) => ((h << 5) - h + c.codePointAt(0)) >>> 0, 0);
}
