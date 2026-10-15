const { calculateScore, cleanTitle } = require('./matcher');

describe('Matcher tests', () => {
    test('cleanTitle removes special characters and normalizes', () => {
        expect(cleanTitle('Elden Ring: Deluxe Edition [Repack]')).toBe('elden ring deluxe edition');
        expect(cleanTitle('The Witcher 3 - Wild Hunt')).toBe('the witcher 3 wild hunt');
        expect(cleanTitle('Half-Life 2©')).toBe('half life 2');
    });

    test('calculateScore exact match returns 1.0', () => {
        expect(calculateScore('Elden Ring', 'Elden Ring')).toBe(1.0);
    });

    test('calculateScore gives high score to subtitle matches', () => {
        const score = calculateScore('Elden Ring', 'Elden Ring Deluxe Edition');
        expect(score).toBeGreaterThan(0.7);
    });

    test('calculateScore returns 0 on missing inputs', () => {
        expect(calculateScore('', 'Elden Ring')).toBe(0);
        expect(calculateScore('Elden Ring', null)).toBe(0);
    });
});
