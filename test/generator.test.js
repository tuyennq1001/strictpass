import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CHAR_SETS,
  CONFUSING_CHARS,
  evaluatePasswordStrength,
  generatePassword,
  normalizeSettings,
  getMnemonic,
} from '../generator.js';

function hasCharFrom(password, pool) {
  const set = new Set(Array.from(pool));
  return Array.from(password).some((ch) => set.has(ch));
}

test('Strictly includes >= 1 character from all 4 groups (Uppercase, Lowercase, Numbers, Special) across 500 short passwords (length = 4)', () => {
  for (let i = 0; i < 500; i++) {
    const { password } = generatePassword({
      length: 4,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: true,
      specialChars: CHAR_SETS.special,
      strict: true,
      excludeConfusing: false,
    });

    assert.equal(password.length, 4);
    assert.ok(hasCharFrom(password, CHAR_SETS.uppercase), `Missing uppercase in: ${password}`);
    assert.ok(hasCharFrom(password, CHAR_SETS.lowercase), `Missing lowercase in: ${password}`);
    assert.ok(hasCharFrom(password, CHAR_SETS.numbers), `Missing number in: ${password}`);
    assert.ok(hasCharFrom(password, CHAR_SETS.special), `Missing special in: ${password}`);
  }
});

test('Reflects edited Special character pool accurately across 300 runs', () => {
  const customSpecial = '!#%$';
  for (let i = 0; i < 300; i++) {
    const { password } = generatePassword({
      length: 8,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: true,
      specialChars: customSpecial,
      strict: true,
      excludeConfusing: false,
    });

    assert.equal(password.length, 8);
    assert.ok(hasCharFrom(password, customSpecial), `Missing edited special char in: ${password}`);
    for (const ch of password) {
      const isStandardAlnum =
        CHAR_SETS.uppercase.includes(ch) ||
        CHAR_SETS.lowercase.includes(ch) ||
        CHAR_SETS.numbers.includes(ch);
      if (!isStandardAlnum) {
        assert.ok(customSpecial.includes(ch), `Unexpected special char "${ch}" in "${password}"`);
      }
    }
  }
});

test('Clamps minimum password length to number of active character groups when Strict is enabled', () => {
  const { password, settings, minLength } = generatePassword({
    length: 2, // smaller than 4 active groups
    uppercase: true,
    lowercase: true,
    numbers: true,
    special: true,
    strict: true,
  });

  assert.equal(minLength, 4);
  assert.equal(settings.length, 4);
  assert.equal(password.length, 4);
});

test('Disambiguation (excludeConfusing) filters out O, 0, l, 1, I, | across all pools', () => {
  for (let i = 0; i < 300; i++) {
    const { password } = generatePassword({
      length: 24,
      uppercase: true,
      lowercase: true,
      numbers: true,
      special: true,
      excludeConfusing: true,
    });

    for (const ch of password) {
      assert.ok(!CONFUSING_CHARS.has(ch), `Found confusing char "${ch}" in "${password}"`);
    }
  }
});

test('Real-time password evaluator scores Weak vs Very Strong passwords and returns entropy bits', () => {
  const weakEval = evaluatePasswordStrength('che');
  assert.equal(weakEval.level, 'weak');
  assert.equal(weakEval.label, 'Weak');
  assert.equal(weakEval.icon, '🚫');

  const commonEval = evaluatePasswordStrength('123456');
  assert.equal(commonEval.level, 'weak');
  assert.equal(commonEval.icon, '🚫');

  const strongEval = evaluatePasswordStrength('(FRR=H@40^(L3-B#x9!P');
  assert.equal(strongEval.level, 'strong');
  assert.equal(strongEval.label, 'Very Strong');
  assert.equal(strongEval.icon, '🔒');
  assert.ok(strongEval.bits >= 96);
});

test('Falls back to lowercase when all character sets are unchecked', () => {
  const { settings, activeGroups } = normalizeSettings({
    uppercase: false,
    lowercase: false,
    numbers: false,
    special: false,
  });

  assert.equal(settings.lowercase, true);
  assert.equal(activeGroups.length, 1);
  assert.equal(activeGroups[0].id, 'lowercase');
});

test('Generates NATO phonetic mnemonic tokens accurately', () => {
  const tokens = getMnemonic('Ab9!');
  assert.deepEqual(tokens, [
    { char: 'A', word: 'ALPHA', type: 'upper' },
    { char: 'b', word: 'bravo', type: 'lower' },
    { char: '9', word: 'nine', type: 'number' },
    { char: '!', word: 'exclamation', type: 'symbol' },
  ]);
});
