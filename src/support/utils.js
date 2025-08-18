export function clamp(number, lower, upper) {
    return Math.max(lower, Math.min(number, upper));
}

function termId(str) {
    return `Term(${str})`;
}

export function getArgId(arg) {
    if (typeof arg === 'object' && arg !== null && arg.id) {
        return arg.id;
    }
    if (typeof arg === 'string') {
        if (arg.includes('(')) { // simple check if it is already an ID
            return arg;
        }
        return termId(arg);
    }
    if (arg !== null && arg !== undefined) {
        return String(arg);
    }
    return 'undefined_arg';
}

export function id(type, args) {
    if (type === 'Term') {
        return termId(args[0]);
    }
    return `${type}(${args.map(getArgId).join(', ')})`;
}

export function hash(str) {
    return [...str].reduce((h, c) => ((h << 5) - h + c.codePointAt(0)) >>> 0, 0);
}

export function stringifyAST(astNode) {
    if (typeof astNode === 'string') {
        return astNode;
    }
    if (!astNode || !astNode.type) {
        return null;
    }

    const args = astNode.args.map(arg => stringifyAST(arg)).join(', ');

    switch (astNode.type) {
        case 'Term':
            return astNode.args[0];
        case 'Inheritance':
            return `<${stringifyAST(astNode.args[0])} --> ${stringifyAST(astNode.args[1])}>.`;
        case 'Implication':
            return `<${stringifyAST(astNode.args[0])} ==> ${stringifyAST(astNode.args[1])}>.`;
        case 'Conjunction':
            return `(&&, ${args})`;
        default:
            return `${astNode.type}(${args})`;
    }
}

export function mergeConfig(defaultConfig, userConfig) {
    return {...defaultConfig, ...userConfig};
}
