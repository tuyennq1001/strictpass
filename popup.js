import {
  CHAR_SETS,
  DEFAULT_SETTINGS,
  evaluatePasswordStrength,
  generatePassword,
  getActiveGroups,
  getMnemonic,
  normalizeSettings,
} from './generator.js';

const STORAGE_KEYS = {
  SETTINGS: 'rpg_strict_settings_v3',
  HISTORY: 'rpg_strict_history_v2',
};

const MAX_HISTORY = 15;

// Storage Adapter (works in Chrome Extension and standalone browser tab)
const storage = {
  async get(key, fallback) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.get([key], (result) => {
          resolve(result[key] !== undefined ? result[key] : fallback);
        });
      });
    }
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  async set(key, value) {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      return new Promise((resolve) => {
        chrome.storage.local.set({ [key]: value }, resolve);
      });
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage errors in fallback mode
    }
  },
};

// State
let currentSettings = { ...DEFAULT_SETTINGS };
let currentPassword = '';
let passwordHistory = [];
let copyFeedbackTimer = null;

// DOM Elements
const els = {
  // Segmented Tabs
  tabBtnMain: document.getElementById('tabBtnMain'),
  tabBtnHistory: document.getElementById('tabBtnHistory'),
  tabBtnAbout: document.getElementById('tabBtnAbout'),
  tabPanelMain: document.getElementById('tabPanelMain'),
  tabPanelHistory: document.getElementById('tabPanelHistory'),
  tabPanelAbout: document.getElementById('tabPanelAbout'),
  historyBadge: document.getElementById('historyBadge'),

  // Theme Toggle Button
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  iconSun: document.getElementById('iconSun'),
  iconMoon: document.getElementById('iconMoon'),

  // Hero Password Card & Security Status
  passwordBox: document.getElementById('passwordBox'),
  securityIconWrap: document.getElementById('securityIconWrap'),
  svgShieldStrong: document.getElementById('svgShieldStrong'),
  svgShieldMedium: document.getElementById('svgShieldMedium'),
  svgShieldWeak: document.getElementById('svgShieldWeak'),
  passwordOutput: document.getElementById('passwordOutput'),
  regenerateBtn: document.getElementById('regenerateBtn'),
  regenerateSvg: document.getElementById('regenerateSvg'),
  copyBtn: document.getElementById('copyBtn'),
  copySvgIcon: document.getElementById('copySvgIcon'),
  checkSvgIcon: document.getElementById('checkSvgIcon'),

  // 4-Capsule Strength Meter & Entropy
  strengthCapsules: document.getElementById('strengthCapsules'),
  strengthLabel: document.getElementById('strengthLabel'),
  entropyBits: document.getElementById('entropyBits'),
  mnemonicBox: document.getElementById('mnemonicBox'),

  // Length Control & - / + Steppers
  btnLengthMinus: document.getElementById('btnLengthMinus'),
  btnLengthPlus: document.getElementById('btnLengthPlus'),
  lengthNumber: document.getElementById('lengthNumber'),
  lengthRange: document.getElementById('lengthRange'),
  minLengthNotice: document.getElementById('minLengthNotice'),

  // 4 Character Set Pills & Collapsible Special Drawer
  pillUppercase: document.getElementById('pillUppercase'),
  pillLowercase: document.getElementById('pillLowercase'),
  pillNumbers: document.getElementById('pillNumbers'),
  pillSpecial: document.getElementById('pillSpecial'),
  specialEditorDrawer: document.getElementById('specialEditorDrawer'),
  txtSpecialChars: document.getElementById('txtSpecialChars'),
  resetSpecialBtn: document.getElementById('resetSpecialBtn'),

  // iOS Switches
  chkStrict: document.getElementById('chkStrict'),
  chkExcludeConfusing: document.getElementById('chkExcludeConfusing'),
  chkShowMnemonic: document.getElementById('chkShowMnemonic'),

  // History Panel
  historyList: document.getElementById('historyList'),
  historyEmpty: document.getElementById('historyEmpty'),
  clearHistoryBtn: document.getElementById('clearHistoryBtn'),
  chkEnableHistory: document.getElementById('chkEnableHistory'),
};

/**
 * Switches between Generator, History, and About panels
 */
function switchTab(tabName) {
  const isMain = tabName === 'main';
  const isHistory = tabName === 'history';
  const isAbout = tabName === 'about';

  els.tabBtnMain.classList.toggle('active', isMain);
  els.tabBtnMain.setAttribute('aria-selected', String(isMain));
  els.tabPanelMain.classList.toggle('hidden', !isMain);

  els.tabBtnHistory.classList.toggle('active', isHistory);
  els.tabBtnHistory.setAttribute('aria-selected', String(isHistory));
  els.tabPanelHistory.classList.toggle('hidden', !isHistory);

  els.tabBtnAbout.classList.toggle('active', isAbout);
  els.tabBtnAbout.setAttribute('aria-selected', String(isAbout));
  els.tabPanelAbout.classList.toggle('hidden', !isAbout);

  if (isHistory) {
    renderHistory();
  }
}

/**
 * Applies Dark / Light appearance and updates header icon
 */
function applyTheme(theme) {
  const isDark = theme !== 'light';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  els.iconSun.classList.toggle('hidden', !isDark);
  els.iconMoon.classList.toggle('hidden', isDark);
}

/**
 * Updates custom slider track gradient percentage
 */
function updateSliderFill(value, min, max) {
  const safeMin = Number(min) || 1;
  const safeMax = Number(max) || 99;
  const pct = Math.max(0, Math.min(100, ((value - safeMin) / (safeMax - safeMin)) * 100));
  els.lengthRange.style.setProperty('--slider-pct', `${pct}%`);
}

/**
 * Updates Pill button visual state
 */
function setPillState(pillEl, isActive) {
  pillEl.classList.toggle('active', isActive);
  pillEl.setAttribute('aria-pressed', String(isActive));
}

/**
 * Renders SVG shield icon, 4-capsule meter, label, entropy bits, and optional mnemonic
 */
function renderSecurityEvaluation(evaluation, mnemonicTokens) {
  const level = evaluation.level || 'strong';

  els.passwordBox.setAttribute('data-level', level);
  els.securityIconWrap.setAttribute('data-level', level);

  els.svgShieldStrong.classList.toggle('hidden', level !== 'strong');
  els.svgShieldMedium.classList.toggle('hidden', level !== 'medium');
  els.svgShieldWeak.classList.toggle('hidden', level !== 'weak');

  els.strengthCapsules.setAttribute('data-score', String(evaluation.score));
  els.strengthCapsules.setAttribute('data-level', level);

  els.strengthLabel.textContent = evaluation.label;
  els.strengthLabel.setAttribute('data-level', level);
  els.entropyBits.textContent = `${evaluation.bits} bits`;

  renderMnemonic(mnemonicTokens);
}

/**
 * Renders NATO phonetic mnemonic tokens when enabled
 */
function renderMnemonic(mnemonicTokens) {
  if (!currentSettings.showMnemonic || !mnemonicTokens || mnemonicTokens.length === 0) {
    els.mnemonicBox.classList.add('hidden');
    els.mnemonicBox.textContent = '';
    return;
  }

  els.mnemonicBox.classList.remove('hidden');
  els.mnemonicBox.innerHTML = '';

  mnemonicTokens.forEach((token) => {
    const span = document.createElement('span');
    span.className = `mnemonic-token ${token.type}`;
    span.textContent = token.word;
    els.mnemonicBox.appendChild(span);
  });
}

/**
 * Synchronizes all UI controls with currentSettings
 */
function syncControlsFromState(minLength) {
  applyTheme(currentSettings.theme);

  // Sync 4 Character Set Pills
  setPillState(els.pillUppercase, currentSettings.uppercase);
  setPillState(els.pillLowercase, currentSettings.lowercase);
  setPillState(els.pillNumbers, currentSettings.numbers);
  setPillState(els.pillSpecial, currentSettings.special);

  // Auto-hide/show Special characters input drawer
  els.specialEditorDrawer.classList.toggle('hidden', !currentSettings.special);
  if (document.activeElement !== els.txtSpecialChars) {
    els.txtSpecialChars.value = currentSettings.specialChars;
  }

  // Sync iOS Switches
  els.chkStrict.checked = currentSettings.strict;
  els.chkExcludeConfusing.checked = currentSettings.excludeConfusing;
  els.chkShowMnemonic.checked = currentSettings.showMnemonic;
  els.chkEnableHistory.checked = currentSettings.enableHistory;

  // Sync Length slider, number input, and stepper buttons
  els.lengthRange.min = String(minLength);
  els.lengthNumber.min = String(minLength);
  els.lengthRange.value = String(currentSettings.length);
  els.lengthNumber.value = String(currentSettings.length);
  updateSliderFill(currentSettings.length, minLength, 99);

  // Stepper buttons disabled state
  if (els.btnLengthMinus) {
    els.btnLengthMinus.disabled = currentSettings.length <= minLength;
  }
  if (els.btnLengthPlus) {
    els.btnLengthPlus.disabled = currentSettings.length >= 99;
  }

  if (currentSettings.strict && minLength > 1) {
    els.minLengthNotice.textContent = `Min ${minLength}`;
    els.minLengthNotice.classList.remove('hidden');
  } else {
    els.minLengthNotice.classList.add('hidden');
  }
}

/**
 * Generates a fresh password using currentSettings and updates UI
 */
function refreshPassword() {
  const result = generatePassword(currentSettings);
  currentSettings = result.settings;
  currentPassword = result.password;

  syncControlsFromState(result.minLength);
  els.passwordOutput.value = currentPassword;
  renderSecurityEvaluation(result.entropy, result.mnemonic);
}

/**
 * Updates settings, persists atomically to storage, and regenerates password immediately
 */
async function updateSettingsAndGenerate(partialUpdate, shouldRegenerate = true) {
  const candidate = { ...currentSettings, ...partialUpdate };

  // Prevent disabling all character groups: if 0 groups would be active, keep previous group active
  const candidateGroups = getActiveGroups(candidate);
  if (candidateGroups.length === 0) {
    for (const key of ['uppercase', 'lowercase', 'numbers', 'special']) {
      if (partialUpdate[key] === false && currentSettings[key] === true) {
        candidate[key] = true;
        break;
      }
    }
  }

  const normalized = normalizeSettings(candidate);
  currentSettings = normalized.settings;

  if (shouldRegenerate) {
    refreshPassword();
  } else {
    syncControlsFromState(normalized.minLength);
    renderMnemonic(getMnemonic(currentPassword));
  }

  await storage.set(STORAGE_KEYS.SETTINGS, currentSettings);
}

/**
 * Formats relative time (e.g., "just now", "20s ago", "2m ago")
 */
function formatRelativeTime(timestamp) {
  const diffSec = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (diffSec < 5) return 'just now';
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

/**
 * Updates the History badge counter on the History segment tab
 */
function updateHistoryBadge() {
  const count = passwordHistory.length;
  if (count === 0) {
    els.historyBadge.classList.add('hidden');
  } else {
    els.historyBadge.classList.remove('hidden');
    els.historyBadge.textContent = count > 9 ? '9+' : String(count);
  }
}

/**
 * Returns small SVG shield markup for a history entry
 */
function createHistoryShieldSvg(level) {
  if (level === 'weak') {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="9.5" y1="9.5" x2="14.5" y2="14.5"></line><line x1="14.5" y1="9.5" x2="9.5" y2="14.5"></line></svg>`;
  }
  if (level === 'medium') {
    return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
  }
  return `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><polyline points="9 12 11 14 15 10"></polyline></svg>`;
}

/**
 * Renders the History list in the History tab
 */
function renderHistory() {
  updateHistoryBadge();
  els.historyList.innerHTML = '';

  if (passwordHistory.length === 0) {
    els.historyEmpty.classList.remove('hidden');
    return;
  }

  els.historyEmpty.classList.add('hidden');

  passwordHistory.forEach((entry) => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.title = 'Click to copy password';

    const level = entry.level || evaluatePasswordStrength(entry.password).level || 'strong';
    const shieldSpan = document.createElement('span');
    shieldSpan.className = 'history-shield';
    shieldSpan.setAttribute('data-level', level);
    shieldSpan.innerHTML = createHistoryShieldSvg(level);

    const pwSpan = document.createElement('span');
    pwSpan.className = 'history-pw';
    pwSpan.textContent = entry.password;

    const timeSpan = document.createElement('span');
    timeSpan.className = 'history-time';
    timeSpan.textContent = formatRelativeTime(entry.timestamp);

    li.appendChild(shieldSpan);
    li.appendChild(pwSpan);
    li.appendChild(timeSpan);

    li.addEventListener('click', async () => {
      await navigator.clipboard.writeText(entry.password);
      timeSpan.textContent = 'Copied';
      setTimeout(() => {
        timeSpan.textContent = formatRelativeTime(entry.timestamp);
      }, 1000);
    });

    els.historyList.appendChild(li);
  });
}

/**
 * Records a password into History when copied
 */
async function recordPasswordInHistory(password) {
  if (!currentSettings.enableHistory || !password) return;

  const evaluation = evaluatePasswordStrength(password);

  if (passwordHistory.length > 0 && passwordHistory[0].password === password) {
    passwordHistory[0].timestamp = Date.now();
    passwordHistory[0].level = evaluation.level;
  } else {
    passwordHistory.unshift({
      password,
      level: evaluation.level,
      timestamp: Date.now(),
    });
    if (passwordHistory.length > MAX_HISTORY) {
      passwordHistory = passwordHistory.slice(0, MAX_HISTORY);
    }
  }

  updateHistoryBadge();
  await storage.set(STORAGE_KEYS.HISTORY, passwordHistory);
}

/**
 * Copies current password to clipboard and logs to History (Icon-only feedback)
 */
async function copyCurrentPassword() {
  if (!currentPassword) return;
  await navigator.clipboard.writeText(currentPassword);

  if (copyFeedbackTimer) clearTimeout(copyFeedbackTimer);
  els.copyBtn.classList.add('copied');
  els.copySvgIcon.classList.add('hidden');
  els.checkSvgIcon.classList.remove('hidden');

  copyFeedbackTimer = setTimeout(() => {
    els.copyBtn.classList.remove('copied');
    els.copySvgIcon.classList.remove('hidden');
    els.checkSvgIcon.classList.add('hidden');
  }, 1200);

  await recordPasswordInHistory(currentPassword);
}

/**
 * Binds all UI events
 */
function bindEvents() {
  // 3-Tab Segmented Control
  els.tabBtnMain.addEventListener('click', () => switchTab('main'));
  els.tabBtnHistory.addEventListener('click', () => switchTab('history'));
  els.tabBtnAbout.addEventListener('click', () => switchTab('about'));

  // Theme Toggle Button
  els.themeToggleBtn.addEventListener('click', () => {
    const nextTheme = currentSettings.theme === 'dark' ? 'light' : 'dark';
    updateSettingsAndGenerate({ theme: nextTheme }, false);
  });

  // Regenerate & Copy Buttons
  els.regenerateBtn.addEventListener('click', () => {
    els.regenerateSvg.classList.remove('spin-anim');
    void els.regenerateSvg.offsetWidth;
    els.regenerateSvg.classList.add('spin-anim');
    refreshPassword();
  });

  els.copyBtn.addEventListener('click', () => {
    copyCurrentPassword();
  });

  // Real-time Password Input Evaluation (when user types/pastes a custom password)
  els.passwordOutput.addEventListener('input', (e) => {
    currentPassword = e.target.value;
    const evaluation = evaluatePasswordStrength(currentPassword);
    const mnemonic = getMnemonic(currentPassword);
    renderSecurityEvaluation(evaluation, mnemonic);
  });

  // Length Stepper Buttons (- and +)
  els.btnLengthMinus.addEventListener('click', () => {
    const min = Number.parseInt(els.lengthNumber.min, 10) || 1;
    if (currentSettings.length > min) {
      updateSettingsAndGenerate({ length: currentSettings.length - 1 }, true);
    }
  });

  els.btnLengthPlus.addEventListener('click', () => {
    if (currentSettings.length < 99) {
      updateSettingsAndGenerate({ length: currentSettings.length + 1 }, true);
    }
  });

  // Length Slider & Number Input
  els.lengthRange.addEventListener('input', (e) => {
    const val = Number.parseInt(e.target.value, 10);
    updateSettingsAndGenerate({ length: val }, true);
  });

  els.lengthNumber.addEventListener('change', (e) => {
    const val = Number.parseInt(e.target.value, 10);
    updateSettingsAndGenerate({ length: val }, true);
  });

  els.lengthNumber.addEventListener('input', (e) => {
    const val = Number.parseInt(e.target.value, 10);
    const min = Number.parseInt(els.lengthNumber.min, 10) || 1;
    if (!Number.isNaN(val) && val >= min && val <= 99) {
      updateSettingsAndGenerate({ length: val }, true);
    }
  });

  // 4 Character Set Pills
  els.pillUppercase.addEventListener('click', () => {
    updateSettingsAndGenerate({ uppercase: !currentSettings.uppercase }, true);
  });

  els.pillLowercase.addEventListener('click', () => {
    updateSettingsAndGenerate({ lowercase: !currentSettings.lowercase }, true);
  });

  els.pillNumbers.addEventListener('click', () => {
    updateSettingsAndGenerate({ numbers: !currentSettings.numbers }, true);
  });

  els.pillSpecial.addEventListener('click', () => {
    const nextSpecial = !currentSettings.special;
    // If enabling special when specialChars was emptied, restore default specialChars
    const nextSpecialChars =
      nextSpecial && (!currentSettings.specialChars || currentSettings.specialChars.length === 0)
        ? CHAR_SETS.special
        : currentSettings.specialChars;
    updateSettingsAndGenerate({ special: nextSpecial, specialChars: nextSpecialChars }, true);
  });

  els.txtSpecialChars.addEventListener('input', (e) => {
    const val = e.target.value;
    updateSettingsAndGenerate(
      {
        specialChars: val,
        special: val.length > 0 ? true : false,
      },
      true
    );
  });

  els.resetSpecialBtn.addEventListener('click', () => {
    els.txtSpecialChars.value = CHAR_SETS.special;
    updateSettingsAndGenerate({ special: true, specialChars: CHAR_SETS.special }, true);
  });

  // iOS Switches
  els.chkStrict.addEventListener('change', (e) => {
    updateSettingsAndGenerate({ strict: e.target.checked }, true);
  });

  els.chkExcludeConfusing.addEventListener('change', (e) => {
    updateSettingsAndGenerate({ excludeConfusing: e.target.checked }, true);
  });

  els.chkShowMnemonic.addEventListener('change', (e) => {
    updateSettingsAndGenerate({ showMnemonic: e.target.checked }, false);
  });

  // History Controls
  els.chkEnableHistory.addEventListener('change', (e) => {
    updateSettingsAndGenerate({ enableHistory: e.target.checked }, false);
  });

  els.clearHistoryBtn.addEventListener('click', async () => {
    passwordHistory = [];
    renderHistory();
    await storage.set(STORAGE_KEYS.HISTORY, passwordHistory);
  });
}

/**
 * Initializes Popup:
 * 1. Awaits saved settings & history from storage FIRST (zero race conditions)
 * 2. Normalizes state and generates a fresh password matching all active settings
 */
async function initPopup() {
  const [savedSettings, savedHistory] = await Promise.all([
    storage.get(STORAGE_KEYS.SETTINGS, DEFAULT_SETTINGS),
    storage.get(STORAGE_KEYS.HISTORY, []),
  ]);

  const normalized = normalizeSettings(savedSettings);
  currentSettings = normalized.settings;
  passwordHistory = Array.isArray(savedHistory) ? savedHistory.slice(0, MAX_HISTORY) : [];

  bindEvents();
  updateHistoryBadge();
  refreshPassword();
}

initPopup();
