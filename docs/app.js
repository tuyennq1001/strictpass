import {
  DEFAULT_SETTINGS,
  evaluatePasswordStrength,
  generatePassword,
  getActiveGroups,
  normalizeSettings,
} from './generator.js';

const THEME_KEY = 'strictpass_site_theme';

let settings = { ...DEFAULT_SETTINGS, length: 16 };
let copyTimer = null;

const els = {
  themeToggleBtn: document.getElementById('themeToggleBtn'),
  iconSun: document.getElementById('iconSun'),
  iconMoon: document.getElementById('iconMoon'),

  passwordBox: document.getElementById('demoPasswordBox'),
  shieldWrap: document.getElementById('demoShieldWrap'),
  svgShieldStrong: document.getElementById('svgShieldStrong'),
  svgShieldMedium: document.getElementById('svgShieldMedium'),
  svgShieldWeak: document.getElementById('svgShieldWeak'),
  passwordOutput: document.getElementById('demoPasswordOutput'),

  regenerateBtn: document.getElementById('demoRegenerateBtn'),
  regenerateSvg: document.getElementById('demoRegenerateSvg'),
  copyBtn: document.getElementById('demoCopyBtn'),
  copySvg: document.getElementById('demoCopySvg'),
  checkSvg: document.getElementById('demoCheckSvg'),

  capsules: document.getElementById('demoCapsules'),
  strengthLabel: document.getElementById('demoStrengthLabel'),
  entropyBits: document.getElementById('demoEntropyBits'),

  lengthValue: document.getElementById('demoLengthValue'),
  lengthRange: document.getElementById('demoLengthRange'),
  btnMinus: document.getElementById('demoBtnMinus'),
  btnPlus: document.getElementById('demoBtnPlus'),

  pillUpper: document.getElementById('demoPillUpper'),
  pillLower: document.getElementById('demoPillLower'),
  pillNumbers: document.getElementById('demoPillNumbers'),
  pillSpecial: document.getElementById('demoPillSpecial'),

  chkStrict: document.getElementById('demoChkStrict'),
  chkExclude: document.getElementById('demoChkExclude'),
};

function applyTheme(theme) {
  const isDark = theme !== 'light';
  document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  els.iconSun.classList.toggle('hidden', !isDark);
  els.iconMoon.classList.toggle('hidden', isDark);
  try {
    localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
  } catch {
    // Ignore storage errors
  }
}

function updateSliderFill(value, min, max) {
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  els.lengthRange.style.setProperty('--slider-pct', `${pct}%`);
}

function renderEvaluation(evaluation) {
  const level = evaluation.level || 'strong';
  els.passwordBox.setAttribute('data-level', level);
  els.shieldWrap.setAttribute('data-level', level);

  els.svgShieldStrong.classList.toggle('hidden', level !== 'strong');
  els.svgShieldMedium.classList.toggle('hidden', level !== 'medium');
  els.svgShieldWeak.classList.toggle('hidden', level !== 'weak');

  els.capsules.setAttribute('data-score', String(evaluation.score));
  els.strengthLabel.textContent = evaluation.label;
  els.strengthLabel.setAttribute('data-level', level);
  els.entropyBits.textContent = `${evaluation.bits} bits`;
}

function setPill(el, active) {
  el.classList.toggle('active', active);
  el.setAttribute('aria-pressed', String(active));
}

function syncUI(minLength) {
  const clampedMin = Math.max(1, minLength);
  els.lengthRange.min = String(clampedMin);
  els.lengthRange.value = String(settings.length);
  els.lengthValue.textContent = String(settings.length);
  updateSliderFill(settings.length, clampedMin, 64);

  setPill(els.pillUpper, settings.uppercase);
  setPill(els.pillLower, settings.lowercase);
  setPill(els.pillNumbers, settings.numbers);
  setPill(els.pillSpecial, settings.special);

  els.chkStrict.checked = settings.strict;
  els.chkExclude.checked = settings.excludeConfusing;
}

function refreshPassword() {
  const res = generatePassword(settings);
  settings = res.settings;
  if (settings.length > 64) {
    settings.length = 64;
  }
  syncUI(res.minLength);
  els.passwordOutput.value = res.password;
  renderEvaluation(res.entropy);
}

function updateSettings(partial) {
  const candidate = { ...settings, ...partial };
  if (getActiveGroups(candidate).length === 0) {
    for (const key of ['uppercase', 'lowercase', 'numbers', 'special']) {
      if (partial[key] === false && settings[key] === true) {
        candidate[key] = true;
        break;
      }
    }
  }
  settings = normalizeSettings(candidate).settings;
  refreshPassword();
}

function bindEvents() {
  els.themeToggleBtn.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  });

  els.regenerateBtn.addEventListener('click', () => {
    els.regenerateSvg.classList.remove('spin-anim');
    void els.regenerateSvg.offsetWidth;
    els.regenerateSvg.classList.add('spin-anim');
    refreshPassword();
  });

  els.copyBtn.addEventListener('click', async () => {
    const value = els.passwordOutput.value;
    if (!value) return;
    await navigator.clipboard.writeText(value);
    if (copyTimer) clearTimeout(copyTimer);
    els.copyBtn.classList.add('copied');
    els.copySvg.classList.add('hidden');
    els.checkSvg.classList.remove('hidden');
    copyTimer = setTimeout(() => {
      els.copyBtn.classList.remove('copied');
      els.copySvg.classList.remove('hidden');
      els.checkSvg.classList.add('hidden');
    }, 1200);
  });

  els.passwordOutput.addEventListener('input', (e) => {
    renderEvaluation(evaluatePasswordStrength(e.target.value));
  });

  els.lengthRange.addEventListener('input', (e) => {
    updateSettings({ length: Number.parseInt(e.target.value, 10) });
  });

  els.btnMinus.addEventListener('click', () => {
    const min = Number.parseInt(els.lengthRange.min, 10) || 1;
    if (settings.length > min) {
      updateSettings({ length: settings.length - 1 });
    }
  });

  els.btnPlus.addEventListener('click', () => {
    if (settings.length < 64) {
      updateSettings({ length: settings.length + 1 });
    }
  });

  els.pillUpper.addEventListener('click', () => updateSettings({ uppercase: !settings.uppercase }));
  els.pillLower.addEventListener('click', () => updateSettings({ lowercase: !settings.lowercase }));
  els.pillNumbers.addEventListener('click', () => updateSettings({ numbers: !settings.numbers }));
  els.pillSpecial.addEventListener('click', () => updateSettings({ special: !settings.special }));

  els.chkStrict.addEventListener('change', (e) => updateSettings({ strict: e.target.checked }));
  els.chkExclude.addEventListener('change', (e) => updateSettings({ excludeConfusing: e.target.checked }));
}

function init() {
  let savedTheme = 'dark';
  try {
    savedTheme = localStorage.getItem(THEME_KEY) || 'dark';
  } catch {
    savedTheme = 'dark';
  }
  applyTheme(savedTheme);
  bindEvents();
  refreshPassword();
}

init();
