export function clamp(number, lower, upper) {
    return Math.max(lower, Math.min(number, upper));
}

export function id(type, args) {
    const stringify = (arg) => {
        if (typeof arg === 'string') return arg;
        if (arg && arg.type && arg.args) return id(arg.type, arg.args);
        if (arg && arg.type === 'Term' && arg.args.length === 1) return arg.args[0];
        return String(arg);
    };
    const stringArgs = args.map(stringify);
    return `${type}(${stringArgs.join(', ')})`;
}

export function getArgId(arg) {
    if (typeof arg === 'string') return arg;
    if (arg && arg.type && arg.args) return id(arg.type, arg.args);
    if (arg !== null && arg !== undefined) return String(arg);
    return 'undefined_arg';
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
