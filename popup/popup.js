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
      
      const supportedLocales = ['en', 'tr', 'ru', 'es'];
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
      const uiLang = chrome.i18n.getUILanguage();
      return uiLang ? uiLang.split('-')[0] : 'en';
    } catch (e) {
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
  }
};

class PopupController {
  constructor() {
    this.settings = {};
    this.stats = null;
    this.retryCount = 0;
    this.maxRetries = 3;
  }

  async init() {
    try {
      await this.loadSettings();
      await I18n.init();
      this.applyTheme();
      this.bindEvents();
      I18n.translatePage();
      this.updateUIVisibility();
      await this.countWords();
    } catch (error) {
      console.error('PopupController: Initialization failed', error);
      this.showError('Initialization failed');
    }
  }

  async loadSettings() {
    const defaults = {
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

    try {
      const stored = await chrome.storage.sync.get(defaults);
      this.settings = { ...defaults, ...stored };
    } catch (error) {
      console.error('PopupController: Failed to load settings', error);
      this.settings = defaults;
    }
  }

  applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const isDark = this.settings.darkMode ?? prefersDark;
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
      themeToggle.style.display = this.settings.showThemeToggle ? 'flex' : 'none';
    }
  }

  updateUIVisibility() {
    const toggleCard = (id, show) => {
      const card = document.getElementById(id);
      if (card) card.style.display = show ? 'flex' : 'none';
    };

    toggleCard('avgLengthCard', this.settings.showAvgWordLength);
    toggleCard('longestWordCard', this.settings.showLongestWord);
    toggleCard('longestLengthCard', this.settings.showLongestWord);
    toggleCard('readingTimeCard', this.settings.showReadingTime);
    toggleCard('speakingTimeCard', this.settings.showSpeakingTime);
    toggleCard('sentencesCard', this.settings.showSentences);
    toggleCard('paragraphsCard', this.settings.showParagraphs);
    toggleCard('uniqueWordsCard', this.settings.showUniqueWords);
    toggleCard('densityCard', this.settings.showDensity);

    const advancedSection = document.getElementById('advancedSection');
    const hasAdvanced = this.settings.showAvgWordLength || 
                        this.settings.showLongestWord || 
                        this.settings.showReadingTime ||
                        this.settings.showSpeakingTime ||
                        this.settings.showDensity;
    
    if (advancedSection) {
      advancedSection.style.display = hasAdvanced ? 'block' : 'none';
    }

    const frequencySection = document.getElementById('frequencySection');
    if (frequencySection) {
      frequencySection.style.display = this.settings.showWordFrequency ? 'block' : 'none';
    }
  }

  bindEvents() {
    const recountBtn = document.getElementById('recountBtn');
    const settingsBtn = document.getElementById('settingsBtn');
    const copyBtn = document.getElementById('copyBtn');
    const exportBtn = document.getElementById('exportBtn');
    const themeToggle = document.getElementById('themeToggle');

    if (recountBtn) {
      recountBtn.addEventListener('click', () => {
        this.retryCount = 0;
        this.countWords();
      });
    }
    
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => this.openSettings());
    }
    
    if (copyBtn) {
      copyBtn.addEventListener('click', () => this.copyStats());
    }
    
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportStats());
    }
    
    if (themeToggle) {
      themeToggle.addEventListener('click', () => this.toggleTheme());
    }
  }

  async toggleTheme() {
    this.settings.darkMode = !this.settings.darkMode;
    
    try {
      await chrome.storage.sync.set({ darkMode: this.settings.darkMode });
      this.applyTheme();
    } catch (error) {
      console.error('PopupController: Failed to save theme', error);
    }
  }

  openSettings() {
    chrome.runtime.openOptionsPage();
  }

  showLoading() {
    const loadingState = document.getElementById('loadingState');
    const statsContainer = document.getElementById('statsContainer');
    const errorState = document.getElementById('errorState');
    
    if (loadingState) loadingState.style.display = 'flex';
    if (statsContainer) statsContainer.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
  }

  hideLoading() {
    const loadingState = document.getElementById('loadingState');
    if (loadingState) loadingState.style.display = 'none';
  }

  showError(message) {
    this.hideLoading();
    
    const errorState = document.getElementById('errorState');
    const errorMessage = document.getElementById('errorMessage');
    const statsContainer = document.getElementById('statsContainer');
    
    if (errorState) errorState.style.display = 'flex';
    if (errorMessage) errorMessage.textContent = message;
    if (statsContainer) statsContainer.style.display = 'none';
  }

  showStats() {
    this.hideLoading();
    
    const statsContainer = document.getElementById('statsContainer');
    const errorState = document.getElementById('errorState');
    
    if (statsContainer) statsContainer.style.display = 'flex';
    if (errorState) errorState.style.display = 'none';
  }

  async ensureContentScriptLoaded(tabId) {
    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'ping' });
      return response && response.success;
    } catch (error) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content/content.js']
        });
        
        await new Promise(resolve => setTimeout(resolve, 100));
        return true;
      } catch (injectError) {
        console.warn('PopupController: Could not inject content script', injectError);
        return false;
      }
    }
  }

  isRestrictedUrl(url) {
    if (!url) return true;
    
    const restrictedPrefixes = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'edge://',
      'about:',
      'file://',
      'view-source:',
      'data:',
      'blob:'
    ];
    
    const restrictedDomains = [
      'chrome.google.com/webstore',
      'addons.mozilla.org',
      'microsoftedge.microsoft.com/addons'
    ];
    
    for (const prefix of restrictedPrefixes) {
      if (url.startsWith(prefix)) {
        return true;
      }
    }
    
    for (const domain of restrictedDomains) {
      if (url.includes(domain)) {
        return true;
      }
    }
    
    return false;
  }

  async countWords() {
    let loadingTimeout = null;
    
    try {
      loadingTimeout = setTimeout(() => this.showLoading(), 100);

      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];
      
      if (!tab) {
        throw new Error(I18n.get('error'));
      }

      if (this.isRestrictedUrl(tab.url)) {
        clearTimeout(loadingTimeout);
        this.showError(I18n.get('noContent'));
        return;
      }

      const isLoaded = await this.ensureContentScriptLoaded(tab.id);
      
      if (!isLoaded) {
        throw new Error('Could not load content script');
      }

      const response = await this.sendMessageWithRetry(tab.id, {
        action: 'countWords',
        options: {
          includeLinks: this.settings.includeLinks,
          readingSpeed: this.settings.readingSpeed,
          speakingSpeed: this.settings.speakingSpeed,
          getWordFrequency: this.settings.showWordFrequency,
          frequencyWordCount: this.settings.frequencyWordCount
        }
      });

      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
        loadingTimeout = null;
      }

      if (response && response.success) {
        this.stats = response.data;
        this.displayStats(response.data);
        
        if (this.settings.showWordFrequency && response.data.wordFrequency) {
          this.displayWordFrequency(response.data.wordFrequency);
        }
      } else {
        throw new Error(response?.error || I18n.get('error'));
      }
    } catch (error) {
      if (loadingTimeout) {
        clearTimeout(loadingTimeout);
      }
      
      console.error('PopupController: Word count error', error);
      
      let errorMessage = I18n.get('error');
      
      if (error.message?.includes('Receiving end does not exist') ||
          error.message?.includes('Could not establish connection') ||
          error.message?.includes('Could not load content script')) {
        
        if (this.retryCount < this.maxRetries) {
          this.retryCount++;
          console.log(`PopupController: Retrying... (${this.retryCount}/${this.maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, 200 * this.retryCount));
          return this.countWords();
        }
        
        errorMessage = I18n.get('noContent');
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      this.showError(errorMessage);
    }
  }

  async sendMessageWithRetry(tabId, message, attempts = 3) {
    for (let i = 0; i < attempts; i++) {
      try {
        const response = await chrome.tabs.sendMessage(tabId, message);
        return response;
      } catch (error) {
        if (i === attempts - 1) {
          throw error;
        }
        await new Promise(resolve => setTimeout(resolve, 100 * (i + 1)));
        
        try {
          await this.ensureContentScriptLoaded(tabId);
        } catch (e) {
          // Ignore injection errors on retry
        }
      }
    }
  }

  displayStats(data) {
    this.showStats();

    this.setElementText('wordCount', this.formatNumber(data.words));
    this.setElementText('charCountSpaces', this.formatNumber(data.charactersWithSpaces));
    this.setElementText('charCountNoSpaces', this.formatNumber(data.charactersNoSpaces));
    
    if (this.settings.showSentences) {
      this.setElementText('sentenceCount', this.formatNumber(data.sentences));
    }
    
    if (this.settings.showParagraphs) {
      this.setElementText('paragraphCount', this.formatNumber(data.paragraphs));
    }

    if (this.settings.showUniqueWords) {
      this.setElementText('uniqueWordCount', this.formatNumber(data.uniqueWords));
    }

    if (this.settings.showAvgWordLength) {
      this.setElementText('avgWordLength', data.avgWordLength.toFixed(1));
    }

    if (this.settings.showLongestWord) {
      const longestWordEl = document.getElementById('longestWord');
      if (longestWordEl) {
        const displayWord = data.longestWord.length > 20 
          ? data.longestWord.substring(0, 17) + '...' 
          : data.longestWord;
        longestWordEl.textContent = displayWord || '-';
        longestWordEl.title = data.longestWord || '';
      }
      this.setElementText('longestWordLength', data.longestWordLength.toString());
    }

    if (this.settings.showReadingTime) {
      this.setElementText('readingTime', this.formatTime(data.readingTime));
    }

    if (this.settings.showSpeakingTime) {
      this.setElementText('speakingTime', this.formatTime(data.speakingTime));
    }

    if (this.settings.showDensity) {
      this.setElementText('textDensity', data.density.toFixed(1) + '%');
    }
  }

  displayWordFrequency(frequencyData) {
    const frequencySection = document.getElementById('frequencySection');
    const frequencyChart = document.getElementById('frequencyChart');
    
    if (!frequencySection || !frequencyChart) return;

    frequencyChart.innerHTML = '';

    if (!frequencyData || frequencyData.length === 0) {
      frequencyChart.innerHTML = `<div class="no-frequency-data">${I18n.get('noFrequencyData') || 'No word frequency data available'}</div>`;
      return;
    }

    const maxCount = frequencyData[0].count;

    frequencyData.forEach((item, index) => {
      const percentage = (item.count / maxCount) * 100;
      const colorIndex = (index % 10) + 1;
      
      const barContainer = document.createElement('div');
      barContainer.className = 'frequency-bar-container';
      
      const wordLabel = document.createElement('span');
      wordLabel.className = 'frequency-word';
      wordLabel.textContent = item.word.length > 10 ? item.word.substring(0, 8) + '...' : item.word;
      wordLabel.title = item.word;
      
      const barWrapper = document.createElement('div');
      barWrapper.className = 'frequency-bar-wrapper';
      
      const bar = document.createElement('div');
      bar.className = `frequency-bar color-${colorIndex}`;
      bar.style.width = '0%';
      
      const countLabel = document.createElement('span');
      countLabel.className = 'frequency-count';
      countLabel.textContent = item.count.toLocaleString();
      
      bar.appendChild(countLabel);
      barWrapper.appendChild(bar);
      
      barContainer.appendChild(wordLabel);
      barContainer.appendChild(barWrapper);
      
      frequencyChart.appendChild(barContainer);

      requestAnimationFrame(() => {
        setTimeout(() => {
          bar.style.width = `${Math.max(percentage, 15)}%`;
        }, index * 50);
      });
    });

    frequencySection.style.display = 'block';
  }

  setElementText(id, text) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = text;
    }
  }

  formatNumber(num) {
    if (typeof num !== 'number') return '0';
    return num.toLocaleString();
  }

  formatTime(seconds) {
    if (typeof seconds !== 'number' || seconds < 0) return '0 ' + I18n.get('seconds');
    
    if (seconds < 60) {
      return `${Math.round(seconds)} ${I18n.get('seconds')}`;
    }
    
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.round(seconds % 60);
    
    if (remainingSeconds === 0) {
      return `${minutes} ${I18n.get('minutes')}`;
    }
    
    return `${minutes} ${I18n.get('minutes')} ${remainingSeconds} ${I18n.get('seconds')}`;
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

  async copyStats() {
    if (!this.stats) {
      this.showToast(I18n.get('error'));
      return;
    }

    const text = this.generateStatsText();
    
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(I18n.get('copied'));
    } catch (error) {
      console.error('PopupController: Copy failed', error);
      
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      
      try {
        document.execCommand('copy');
        this.showToast(I18n.get('copied'));
      } catch (e) {
        console.error('PopupController: Fallback copy failed', e);
      }
      
      document.body.removeChild(textarea);
    }
  }

  generateStatsText() {
    if (!this.stats) return '';

    const lines = [];
    
    lines.push(`${I18n.get('words')}: ${this.formatNumber(this.stats.words)}`);
    lines.push(`${I18n.get('charactersWithSpaces')}: ${this.formatNumber(this.stats.charactersWithSpaces)}`);
    lines.push(`${I18n.get('charactersNoSpaces')}: ${this.formatNumber(this.stats.charactersNoSpaces)}`);

    if (this.settings.showSentences) {
      lines.push(`${I18n.get('sentences')}: ${this.formatNumber(this.stats.sentences)}`);
    }
    
    if (this.settings.showParagraphs) {
      lines.push(`${I18n.get('paragraphs')}: ${this.formatNumber(this.stats.paragraphs)}`);
    }
    
    if (this.settings.showUniqueWords) {
      lines.push(`${I18n.get('uniqueWords')}: ${this.formatNumber(this.stats.uniqueWords)}`);
    }
    
    if (this.settings.showAvgWordLength) {
      lines.push(`${I18n.get('avgWordLength')}: ${this.stats.avgWordLength.toFixed(1)}`);
    }
    
    if (this.settings.showLongestWord) {
      lines.push(`${I18n.get('longestWord')}: ${this.stats.longestWord} (${this.stats.longestWordLength})`);
    }
    
    if (this.settings.showReadingTime) {
      lines.push(`${I18n.get('readingTime')}: ${this.formatTime(this.stats.readingTime)}`);
    }
    
    if (this.settings.showSpeakingTime) {
      lines.push(`${I18n.get('speakingTime')}: ${this.formatTime(this.stats.speakingTime)}`);
    }

    if (this.settings.showWordFrequency && this.stats.wordFrequency) {
      lines.push('');
      lines.push(`${I18n.get('wordFrequency') || 'Most Frequent Words'}:`);
      this.stats.wordFrequency.forEach((item, index) => {
        lines.push(`  ${index + 1}. ${item.word}: ${item.count}`);
      });
    }

    return lines.join('\n');
  }

  exportStats() {
    if (!this.stats) {
      this.showToast(I18n.get('error'));
      return;
    }

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const tab = tabs[0];
      
      const data = {
        timestamp: new Date().toISOString(),
        url: tab?.url || '',
        title: tab?.title || '',
        statistics: this.stats
      };

      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = `word-count-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      this.showToast(I18n.get('saved'));
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const controller = new PopupController();
  controller.init();
});