const I18n = {
  messages: {},
  currentLocale: 'en',
  initialized: false,

  async init() {
    if (this.initialized) {
      return;
    }

    try {
      const settings = await chrome.storage.sync.get(['language']);
      this.currentLocale = settings.language || this.detectLocale();
      
      const supportedLocales = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'pt_BR', 'pt_PT', 'nl', 'pl',
  'ru', 'uk', 'tr', 'ar', 'he', 'fa', 'hi', 'bn', 'mr', 'gu',
  'ta', 'te', 'kn', 'ml', 'th', 'vi', 'id', 'ms', 'fil',
  'zh_CN', 'zh_TW', 'ja', 'ko', 'sv', 'da', 'no', 'fi', 'et',
  'lv', 'lt', 'cs', 'sk', 'sl', 'hr', 'sr', 'bg', 'ro', 'hu',
  'el', 'ca', 'sw', 'am', 'uz', 'tk', 'tt'
];
      if (!supportedLocales.includes(this.currentLocale)) {
        this.currentLocale = 'en';
      }

      await this.loadMessages(this.currentLocale);
      this.initialized = true;
    } catch (error) {
      console.error('I18n: Failed to initialize', error);
      await this.loadMessages('en');
      this.initialized = true;
    }
  },

  detectLocale() {
    try {
      const uiLang = chrome.i18n.getUILanguage(); // e.g. pt-BR
      return uiLang ? uiLang.replace('-', '_') : 'en';
    } catch {
      return 'en';
    }
  },

  async loadMessages(locale) {
    try {
      const url = chrome.runtime.getURL(`_locales/${locale}/messages.json`);
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to load ${locale} messages`);
      }
      
      this.messages = await response.json();
    } catch (error) {
      console.warn(`I18n: Failed to load ${locale}, falling back to English`, error);
      
      if (locale !== 'en') {
        try {
          const fallbackUrl = chrome.runtime.getURL('_locales/en/messages.json');
          const fallbackResponse = await fetch(fallbackUrl);
          this.messages = await fallbackResponse.json();
        } catch (fallbackError) {
          console.error('I18n: Failed to load fallback messages', fallbackError);
          this.messages = {};
        }
      }
    }
  },

  get(key) {
    if (this.messages[key] && this.messages[key].message) {
      return this.messages[key].message;
    }
    
    try {
      const chromeMessage = chrome.i18n.getMessage(key);
      if (chromeMessage) {
        return chromeMessage;
      }
    } catch (e) {}
    
    return key;
  },

  translatePage() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
      const key = element.getAttribute('data-i18n');
      const translation = this.get(key);
      if (translation && translation !== key) {
        element.textContent = translation;
      }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
      const key = element.getAttribute('data-i18n-placeholder');
      const translation = this.get(key);
      if (translation && translation !== key) {
        element.placeholder = translation;
      }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
      const key = element.getAttribute('data-i18n-title');
      const translation = this.get(key);
      if (translation && translation !== key) {
        element.title = translation;
      }
    });
  },

  async setLocale(locale) {
    const supportedLocales = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'pt_BR', 'pt_PT', 'nl', 'pl',
  'ru', 'uk', 'tr', 'ar', 'he', 'fa', 'hi', 'bn', 'mr', 'gu',
  'ta', 'te', 'kn', 'ml', 'th', 'vi', 'id', 'ms', 'fil',
  'zh_CN', 'zh_TW', 'ja', 'ko', 'sv', 'da', 'no', 'fi', 'et',
  'lv', 'lt', 'cs', 'sk', 'sl', 'hr', 'sr', 'bg', 'ro', 'hu',
  'el', 'ca', 'sw', 'am', 'uz', 'tk', 'tt'
];
    if (!supportedLocales.includes(locale)) {
      locale = 'en';
    }
    
    this.currentLocale = locale;
    this.initialized = false;
    await this.loadMessages(locale);
    this.initialized = true;
    this.translatePage();
  }
};

class SettingsController {
  constructor() {
    this.defaults = {
      darkMode: false,
      showThemeToggle: false,
      language: 'en',
      selectiveCounter: true,
      includeLinks: false,
      showWordFrequency: true,
      frequencyWordCount: 5,
      showAvgWordLength: true,
      showLongestWord: true,
      showReadingTime: true,
      showSpeakingTime: false,
      showSentences: false,
      showParagraphs: false,
      showUniqueWords: false,
      showDensity: false,
      readingSpeed: 200,
      speakingSpeed: 150
    };
    
    this.settings = { ...this.defaults };
  }

  async init() {
    try {
      await this.loadSettings();
      await I18n.init();
      this.applyTheme();
      this.populateForm();
      this.bindEvents();
      this.displayVersion();
      I18n.translatePage();
    } catch (error) {
      console.error('SettingsController: Initialization failed', error);
    }
  }

  async loadSettings() {
    try {
      const stored = await chrome.storage.sync.get(this.defaults);
      this.settings = { ...this.defaults, ...stored };
    } catch (error) {
      console.error('SettingsController: Failed to load settings', error);
      this.settings = { ...this.defaults };
    }
  }

  applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = this.settings.darkMode ?? prefersDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
  }

  displayVersion() {
    const versionEl = document.getElementById('versionNumber');
    if (versionEl) {
      const manifest = chrome.runtime.getManifest();
      versionEl.textContent = manifest.version || '1.0.0';
    }
  }

  populateForm() {
    const setCheckbox = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.checked = !!value;
    };

    const setValue = (id, value) => {
      const el = document.getElementById(id);
      if (el) el.value = value;
    };

    setCheckbox('darkMode', this.settings.darkMode);
    setCheckbox('showThemeToggle', this.settings.showThemeToggle);
    setValue('language', this.settings.language);
    setCheckbox('selectiveCounter', this.settings.selectiveCounter);
    setCheckbox('includeLinks', this.settings.includeLinks);
    setCheckbox('showWordFrequency', this.settings.showWordFrequency);
    setValue('frequencyWordCount', this.settings.frequencyWordCount);
    setCheckbox('showAvgWordLength', this.settings.showAvgWordLength);
    setCheckbox('showLongestWord', this.settings.showLongestWord);
    setCheckbox('showReadingTime', this.settings.showReadingTime);
    setCheckbox('showSpeakingTime', this.settings.showSpeakingTime);
    setCheckbox('showSentences', this.settings.showSentences);
    setCheckbox('showParagraphs', this.settings.showParagraphs);
    setCheckbox('showUniqueWords', this.settings.showUniqueWords);
    setCheckbox('showDensity', this.settings.showDensity);
    setValue('readingSpeed', this.settings.readingSpeed);
    setValue('speakingSpeed', this.settings.speakingSpeed);
  }

  bindEvents() {
    const settingIds = [
      'darkMode', 'showThemeToggle', 'language', 'selectiveCounter',
      'includeLinks', 'showWordFrequency', 'frequencyWordCount',
      'showAvgWordLength', 'showLongestWord', 'showReadingTime',
      'showSpeakingTime', 'showSentences', 'showParagraphs', 'showUniqueWords',
      'showDensity', 'readingSpeed', 'speakingSpeed'
    ];

    settingIds.forEach(id => {
      const element = document.getElementById(id);
      if (element) {
        element.addEventListener('change', () => this.handleSettingChange(id, element));
      }
    });

    const resetBtn = document.getElementById('resetBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => this.resetToDefaults());
    }
  }

  async handleSettingChange(id, element) {
    let value;
    
    if (element.type === 'checkbox') {
      value = element.checked;
    } else if (element.type === 'number') {
      value = parseInt(element.value, 10);
      const min = parseInt(element.min, 10);
      const max = parseInt(element.max, 10);
      
      if (isNaN(value) || value < min || value > max) {
        value = this.defaults[id];
        element.value = value;
      }
    } else {
      value = element.value;
    }

    this.settings[id] = value;
    
    try {
      await chrome.storage.sync.set({ [id]: value });
      
      if (id === 'darkMode') {
        this.applyTheme();
      }
      
      if (id === 'language') {
        await I18n.setLocale(value);
      }
      
      this.showToast(I18n.get('saved'));
      this.notifyContentScripts();
    } catch (error) {
      console.error('SettingsController: Failed to save setting', error);
    }
  }

  async notifyContentScripts() {
    try {
      const tabs = await chrome.tabs.query({});
      
      for (const tab of tabs) {
        if (tab.id && !tab.url?.startsWith('chrome://') && !tab.url?.startsWith('chrome-extension://')) {
          try {
            await chrome.tabs.sendMessage(tab.id, {
              action: 'settingsUpdated',
              settings: this.settings
            });
          } catch (e) {
            // Tab might not have content script, ignore
          }
        }
      }
    } catch (error) {
      console.error('SettingsController: Failed to notify content scripts', error);
    }
  }

  async resetToDefaults() {
    this.settings = { ...this.defaults };
    
    try {
      await chrome.storage.sync.set(this.settings);
      this.populateForm();
      this.applyTheme();
      await I18n.setLocale(this.defaults.language);
      this.showToast(I18n.get('saved'));
      this.notifyContentScripts();
    } catch (error) {
      console.error('SettingsController: Failed to reset settings', error);
    }
  }

  showToast(message) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.classList.add('show');
    
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const controller = new SettingsController();
  controller.init();
});
