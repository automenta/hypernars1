import { id as generateId } from '../support/utils.js';

export function getArgId(arg) {
    if (typeof arg === 'string') return arg;
    if (arg && arg.type && arg.args) return generateId(arg.type, arg.args);
    if (arg !== null && arg !== undefined) return String(arg);
    return 'undefined_arg';
}
