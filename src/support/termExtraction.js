import { id as generateId } from './utils.js';

export const extractTerms = (parsed, terms = new Set()) => {
    if (!parsed) {
        return terms;
    }

    if (parsed.type === 'Term') {
        terms.add(generateId(parsed.type, parsed.args));
    }

    if (parsed.args) {
        parsed.args.forEach((arg) => {
            if (typeof arg === 'object' && arg !== null) {
                extractTerms(arg, terms);
            }
        });
    }

    return terms;
};
