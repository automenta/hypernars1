const inverses = {
    'before': 'after', 'after': 'before',
    'meets': 'metBy', 'metBy': 'meets',
    'overlaps': 'overlappedBy', 'overlappedBy': 'overlaps',
    'during': 'contains', 'contains': 'during',
    'starts': 'startedBy', 'startedBy': 'starts',
    'finishes': 'finishedBy', 'finishedBy': 'finishes',
    'equals': 'equals'
};

const table = {
    'before': {
        'before': ['before'],
        'meets': ['before'],
        'overlaps': ['before'],
        'starts': ['before'],
        'during': ['before'],
        'finishes': ['before', 'meets', 'overlaps', 'starts', 'during']
    },
    'meets': {
        'before': ['before'], 'meets': ['before'], 'overlaps': ['before'],
        'starts': ['starts'], 'during': ['during']
    },
    'overlaps': {
        'before': ['before'], 'meets': ['before'], 'overlaps': ['before', 'meets', 'overlaps'],
        'starts': ['overlaps'], 'during': ['during', 'overlaps', 'finishes']
    },
    'starts': {
        'starts': ['starts'], 'during': ['during'], 'finishes': ['finishes', 'during', 'overlaps']
    },
    'during': {
        'during': ['during'], 'finishes': ['finishes']
    },
    'finishes': {
        'finishes': ['finishes']
    },
    'equals': {
        'before': ['before'], 'meets': ['meets'], 'overlaps': ['overlaps'],
        'starts': ['starts'], 'during': ['during'], 'finishes': ['finishes'],
        'equals': ['equals']
    }
};

export function getInverseTemporalRelation(relation) {
    return inverses[relation];
}

export function composeTemporalRelations(rel1, rel2, triedInverse = false) {
    let composed = table[rel1]?.[rel2];
    if (composed) return composed;

    if (!triedInverse) {
        const inv_r1 = getInverseTemporalRelation(rel1);
        const inv_r2 = getInverseTemporalRelation(rel2);
        if (inv_r1 && inv_r2) {
            const inv_composed = composeTemporalRelations(inv_r2, inv_r1, true);
            if (inv_composed) {
                return inv_composed.map(r => getInverseTemporalRelation(r)).filter(r => r);
            }
        }
    }
    return null;
}
