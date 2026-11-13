/**
 * Core Password Generator & Strength Evaluator Module
 * CSPRNG + Strict Category Inclusion Guarantee
 */

export const CHAR_SETS = {
  uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  lowercase: 'abcdefghijklmnopqrstuvwxyz',
  numbers: '0123456789',
  special: '!"#$%&\'()*+,-./:;<=>?@[\\]^_`{|}~',
};

export const CONFUSING_CHARS = new Set(['O', '0', 'l', '1', 'I', '|']);

export const DEFAULT_SETTINGS = {
  length: 16,
  uppercase: true,
  lowercase: true,
  numbers: true,
  special: true,
  specialChars: CHAR_SETS.special,
  strict: true,
  excludeConfusing: false,
  showMnemonic: false,
  enableHistory: true,
  theme: 'dark',
};

const NATO_PHONETIC = {
  a: 'alpha',
  b: 'bravo',
  c: 'charlie',
  d: 'delta',
  e: 'echo',
  f: 'foxtrot',
  g: 'golf',
  h: 'hotel',
  i: 'india',
  j: 'juliet',
  k: 'kilo',
  l: 'lima',
  m: 'mike',
  n: 'november',
  o: 'oscar',
  p: 'papa',
  q: 'quebec',
  r: 'romeo',
  s: 'sierra',
  t: 'tango',
  u: 'uniform',
  v: 'victor',
  w: 'whiskey',
  x: 'x-ray',
  y: 'yankee',
  z: 'zulu',
};

const DIGIT_NAMES = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

const SYMBOL_NAMES = {
  '!': 'exclamation',
  '"': 'double-quote',
  '#': 'hash',
  '$': 'dollar',
  '%': 'percent',
  '&': 'ampersand',
  "'": 'apostrophe',
  '(': 'left-paren',
  ')': 'right-paren',
  '*': 'asterisk',
  '+': 'plus',
  ',': 'comma',
  '-': 'dash',
  '.': 'dot',
  '/': 'slash',
  ':': 'colon',
  ';': 'semicolon',
  '<': 'less-than',
  '=': 'equals',
  '>': 'greater-than',
  '?': 'question',
  '@': 'at',
  '[': 'left-bracket',
  '\\': 'backslash',
  ']': 'right-bracket',
  '^': 'caret',
  '_': 'underscore',
  '`': 'backtick',
  '{': 'left-brace',
  '|': 'pipe',
  '}': 'right-brace',
  '~': 'tilde',
  ' ': 'space',
};

/**
 * Unbiased cryptographically secure random integer in [0, max)
 * Uses rejection sampling to eliminate modulo bias.
 */
export function getSecureRandomInt(max) {
  if (!Number.isInteger(max) || max <= 0) {
    throw new RangeError(`max must be a positive integer, got ${max}`);
  }
  if (max === 1) return 0;

  const uint32Max = 0xffffffff;
  const limit = uint32Max - ((uint32Max + 1) % max);
  const buffer = new Uint32Array(1);

  while (true) {
    globalThis.crypto.getRandomValues(buffer);
    const value = buffer[0];
    if (value <= limit) {
      return value % max;
    }
  }
}

/**
 * Removes duplicate characters from a string while preserving order.
 */
export function deduplicateChars(str) {
  return Array.from(new Set(Array.from(str))).join('');
}

/**
 * Filters out confusing characters (O, 0, l, 1, I, |) when excludeConfusing is enabled.
 */
function filterConfusing(pool, excludeConfusing) {
  if (!excludeConfusing) return pool;
  return Array.from(pool)
    .filter((ch) => !CONFUSING_CHARS.has(ch))
    .join('');
}

/**
 * Builds the active character groups based on current settings.
 */
export function getActiveGroups(settings) {
  const groups = [];

  if (settings.uppercase) {
    const chars = filterConfusing(CHAR_SETS.uppercase, settings.excludeConfusing);
    if (chars.length > 0) {
      groups.push({ id: 'uppercase', chars });
    }
  }

  if (settings.lowercase) {
    const chars = filterConfusing(CHAR_SETS.lowercase, settings.excludeConfusing);
    if (chars.length > 0) {
      groups.push({ id: 'lowercase', chars });
    }
  }

  if (settings.numbers) {
    const chars = filterConfusing(CHAR_SETS.numbers, settings.excludeConfusing);
    if (chars.length > 0) {
      groups.push({ id: 'numbers', chars });
    }
  }

  const useSpecial =
    settings.special !== undefined ? Boolean(settings.special) : Boolean(settings.symbols);

  if (useSpecial) {
    const rawSpecial =
      typeof settings.specialChars === 'string'
        ? deduplicateChars(settings.specialChars)
        : CHAR_SETS.special;
    const chars = filterConfusing(rawSpecial, settings.excludeConfusing);
    if (chars.length > 0) {
      groups.push({ id: 'special', chars });
    }
  }

  return groups;
}

/**
 * Normalizes settings so that:
 * 1. At least one valid character group is active (falls back to lowercase if none).
 * 2. Length is clamped between [minLength, 99], where minLength = activeGroups.length when strict is true.
 */
export function normalizeSettings(rawSettings = {}) {
  const merged = { ...DEFAULT_SETTINGS, ...rawSettings };

  // Support legacy 'symbols'/'symbolChars' keys if migrating from older state
  if (rawSettings.special === undefined && rawSettings.symbols !== undefined) {
    merged.special = Boolean(rawSettings.symbols);
  }
  if (rawSettings.specialChars === undefined && typeof rawSettings.symbolChars === 'string') {
    merged.specialChars = rawSettings.symbolChars;
  }

  merged.uppercase = Boolean(merged.uppercase);
  merged.lowercase = Boolean(merged.lowercase);
  merged.numbers = Boolean(merged.numbers);
  merged.special = Boolean(merged.special);
  merged.specialChars =
    typeof merged.specialChars === 'string' ? merged.specialChars : CHAR_SETS.special;
  merged.strict = merged.strict !== undefined ? Boolean(merged.strict) : true;
  merged.excludeConfusing = Boolean(merged.excludeConfusing);
  merged.showMnemonic = Boolean(merged.showMnemonic);
  merged.enableHistory = Boolean(merged.enableHistory);
  merged.theme = merged.theme === 'light' ? 'light' : 'dark';

  // If special is checked but the user cleared all characters in specialChars, disable special or restore if it's the only group
  let activeGroups = getActiveGroups(merged);
  if (activeGroups.length === 0) {
    merged.lowercase = true;
    activeGroups = getActiveGroups(merged);
  }

  const minLength = merged.strict ? Math.max(1, activeGroups.length) : 1;
  const parsedLength = Number.parseInt(merged.length, 10);
  const safeLength = Number.isNaN(parsedLength) ? DEFAULT_SETTINGS.length : parsedLength;
  merged.length = Math.min(99, Math.max(minLength, safeLength));

  return {
    settings: merged,
    activeGroups,
    minLength,
  };
}

/**
 * Generates a password that STRICTLY includes at least 1 character from each
 * active character group (when strict=true), fills the remaining slots from
 * the combined pool, and shuffles with CSPRNG Fisher-Yates.
 */
export function generatePassword(rawSettings = {}) {
  const { settings, activeGroups, minLength } = normalizeSettings(rawSettings);
  const targetLength = settings.length;

  const passwordChars = [];

  // 1. Guarantee at least 1 character from every active group when strict is enabled
  if (settings.strict) {
    for (const group of activeGroups) {
      const randomIndex = getSecureRandomInt(group.chars.length);
      passwordChars.push(group.chars[randomIndex]);
    }
  }

  // 2. Build deduplicated combined pool for remaining positions
  const combinedPool = deduplicateChars(activeGroups.map((g) => g.chars).join(''));

  for (let i = passwordChars.length; i < targetLength; i++) {
    const randomIndex = getSecureRandomInt(combinedPool.length);
    passwordChars.push(combinedPool[randomIndex]);
  }

  // 3. Unbiased CSPRNG Fisher-Yates shuffle
  for (let i = passwordChars.length - 1; i > 0; i--) {
    const j = getSecureRandomInt(i + 1);
    const temp = passwordChars[i];
    passwordChars[i] = passwordChars[j];
    passwordChars[j] = temp;
  }

  const password = passwordChars.join('');
  const evaluation = evaluatePasswordStrength(password, combinedPool.length);

  return {
    password,
    settings,
    minLength,
    poolSize: combinedPool.length,
    entropy: evaluation,
    mnemonic: getMnemonic(password),
  };
}

/**
 * Evaluates any password (generated or user-typed) for entropy bits,
 * strength rating ('Weak', 'Fair', 'Good', 'Strong', 'Very Strong'), border level, and icon.
 */
export function evaluatePasswordStrength(password, explicitPoolSize = null) {
  if (!password || typeof password !== 'string' || password.length === 0) {
    return {
      bits: 0,
      score: 0,
      label: 'Weak',
      level: 'weak',
      icon: '🚫',
    };
  }

  let hasLower = false;
  let hasUpper = false;
  let hasNumber = false;
  let hasSpecial = false;

  for (const ch of password) {
    if (ch >= 'a' && ch <= 'z') hasLower = true;
    else if (ch >= 'A' && ch <= 'Z') hasUpper = true;
    else if (ch >= '0' && ch <= '9') hasNumber = true;
    else hasSpecial = true;
  }

  let detectedPool = 0;
  if (hasLower) detectedPool += 26;
  if (hasUpper) detectedPool += 26;
  if (hasNumber) detectedPool += 10;
  if (hasSpecial) detectedPool += 32;

  const poolSize = Math.max(explicitPoolSize || 0, detectedPool, 2);

  // Penalize repeated characters or common dictionary/keyboard patterns when typed manually
  const uniqueChars = new Set(Array.from(password)).size;
  const repetitionRatio = uniqueChars / password.length;
  const lowerPw = password.toLowerCase();
  const isCommonPattern =
    /^(12345|123456|12345678|123456789|qwerty|password|admin|welcome|abc123|letmein)/.test(
      lowerPw
    ) || uniqueChars <= 2;

  let rawBits = password.length * Math.log2(poolSize);
  if (isCommonPattern) {
    rawBits = Math.min(rawBits, 18);
  } else if (repetitionRatio < 0.5 && password.length > 4) {
    rawBits *= repetitionRatio + 0.25;
  }

  const bits = Math.max(1, Math.round(rawBits));

  let score = 0;
  let label = 'Weak';
  let level = 'weak';
  let icon = '🚫';

  if (bits >= 96) {
    score = 4;
    label = 'Very Strong';
    level = 'strong';
    icon = '🔒';
  } else if (bits >= 68) {
    score = 3;
    label = 'Strong';
    level = 'strong';
    icon = '🔒';
  } else if (bits >= 50) {
    score = 2;
    label = 'Good';
    level = 'medium';
    icon = '😐';
  } else if (bits >= 34) {
    score = 1;
    label = 'Fair';
    level = 'medium';
    icon = '😠';
  } else {
    score = 0;
    label = 'Weak';
    level = 'weak';
    icon = '🚫';
  }

  return {
    bits,
    score,
    label,
    level,
    icon,
  };
}

/**
 * Generates NATO phonetic / readable hint tokens for each character in the password.
 */
export function getMnemonic(password) {
  return Array.from(password).map((ch) => {
    const lower = ch.toLowerCase();
    if (NATO_PHONETIC[lower]) {
      const word = NATO_PHONETIC[lower];
      const isUpper = ch !== lower && ch === ch.toUpperCase();
      return {
        char: ch,
        word: isUpper ? word.toUpperCase() : word,
        type: isUpper ? 'upper' : 'lower',
      };
    }
    if (DIGIT_NAMES[ch]) {
      return {
        char: ch,
        word: DIGIT_NAMES[ch],
        type: 'number',
      };
    }
    return {
      char: ch,
      word: SYMBOL_NAMES[ch] || ch,
      type: 'symbol',
    };
  });
}
