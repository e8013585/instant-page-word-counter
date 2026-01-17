(function() {
  'use strict';

  if (window.__wordCounterInjected) {
    return;
  }
  window.__wordCounterInjected = true;

  let settings = {
    selectiveCounter: true,
    includeLinks: false,
    readingSpeed: 200,
    speakingSpeed: 150
  };

  let currentLocale = 'en';
  let translations = {
    words: 'words',
    chars: 'chars'
  };

  const defaultTranslations = {
    en: { words: 'words', chars: 'chars' },
    es: { words: 'palabras', chars: 'caract' },
    fr: { words: 'mots', chars: 'caract' },
    de: { words: 'Wörter', chars: 'Zeichen' },
    it: { words: 'parole', chars: 'caratt' },
    pt: { words: 'palavras', chars: 'caract' },
    pt_BR: { words: 'palavras', chars: 'caract' },
    pt_PT: { words: 'palavras', chars: 'caract' },
    nl: { words: 'woorden', chars: 'tekens' },
    pl: { words: 'słowa', chars: 'znaki' },
    ru: { words: 'слова', chars: 'симв' },
    uk: { words: 'слова', chars: 'симв' },
    tr: { words: 'kelime', chars: 'karakter' },
    ar: { words: 'كلمات', chars: 'أحرف' },
    he: { words: 'מילים', chars: 'תווים' },
    fa: { words: 'کلمات', chars: 'نویسه' },
    hi: { words: 'शब्द', chars: 'अक्षर' },
    bn: { words: 'শব্দ', chars: 'অক্ষর' },
    mr: { words: 'शब्द', chars: 'अक्षरे' },
    gu: { words: 'શબ્દો', chars: 'અક્ષરો' },
    ta: { words: 'சொற்கள்', chars: 'எழுத்து' },
    te: { words: 'పదాలు', chars: 'అక్షరాలు' },
    kn: { words: 'ಪದಗಳು', chars: 'ಅಕ್ಷರಗಳು' },
    ml: { words: 'വാക്കുകൾ', chars: 'അക്ഷരങ്ങൾ' },
    th: { words: 'คำ', chars: 'ตัวอักษร' },
    vi: { words: 'từ', chars: 'ký tự' },
    id: { words: 'kata', chars: 'karakter' },
    ms: { words: 'perkataan', chars: 'aksara' },
    fil: { words: 'salita', chars: 'karakter' },
    zh_CN: { words: '字数', chars: '字符' },
    zh_TW: { words: '字數', chars: '字元' },
    ja: { words: '単語', chars: '文字' },
    ko: { words: '단어', chars: '문자' },
    sv: { words: 'ord', chars: 'tecken' },
    da: { words: 'ord', chars: 'tegn' },
    no: { words: 'ord', chars: 'tegn' },
    fi: { words: 'sanat', chars: 'merkit' },
    et: { words: 'sõnad', chars: 'märgid' },
    lv: { words: 'vārdi', chars: 'rakstz' },
    lt: { words: 'žodžiai', chars: 'simboliai' },
    cs: { words: 'slova', chars: 'znaky' },
    sk: { words: 'slová', chars: 'znaky' },
    sl: { words: 'besede', chars: 'znaki' },
    hr: { words: 'riječi', chars: 'znakovi' },
    sr: { words: 'речи', chars: 'знакови' },
    bg: { words: 'думи', chars: 'знаци' },
    ro: { words: 'cuvinte', chars: 'caract' },
    hu: { words: 'szavak', chars: 'karakter' },
    el: { words: 'λέξεις', chars: 'χαρακτ' },
    ca: { words: 'paraules', chars: 'caràct' },
    sw: { words: 'maneno', chars: 'herufi' },
    am: { words: 'ቃላት', chars: 'ፊደላት' },
    uz: { words: "so'zlar", chars: 'belgilar' },
    tk: { words: 'sözler', chars: 'simwol' },
    tt: { words: 'сүзләр', chars: 'символ' }
  };

  async function loadSettings() {
    try {
      const stored = await chrome.storage.sync.get({
        selectiveCounter: true,
        includeLinks: false,
        readingSpeed: 200,
        speakingSpeed: 150,
        language: 'en'
      });
      settings = { ...settings, ...stored };
      currentLocale = stored.language || 'en';
      await loadTranslations();
    } catch (error) {
      console.warn('Word Counter: Failed to load settings', error);
    }
  }

  async function loadTranslations() {
    if (defaultTranslations[currentLocale]) {
      translations = { ...defaultTranslations[currentLocale] };
    } else {
      try {
        const url = chrome.runtime.getURL(`_locales/${currentLocale}/messages.json`);
        const response = await fetch(url);
        if (response.ok) {
          const messages = await response.json();
          translations = {
            words: messages.words?.message || 'words',
            chars: messages.chars?.message || 'chars'
          };
        } else {
          translations = { ...defaultTranslations.en };
        }
      } catch (error) {
        console.warn('Word Counter: Failed to load translations, using defaults', error);
        translations = { ...defaultTranslations.en };
      }
    }
    
    if (selectionHandler && selectionHandler.popup) {
      selectionHandler.popup.destroy();
    }
  }

  loadSettings();

  const commonStopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
    'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'must', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'it', 'its', 'this', 'that', 'these', 'those', 'i', 'you', 'he',
    'she', 'we', 'they', 'what', 'which', 'who', 'whom', 'whose', 'where',
    'when', 'why', 'how', 'all', 'each', 'every', 'both', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
    'there', 'then', 'once', 'if', 'about', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'under', 'again',
    'further', 'am', 'any', 'because', 'being', 'down', 'up', 'out', 'off',
    'over', 'her', 'him', 'his', 'my', 'our', 'your', 'their', 'me', 'us'
  ]);

  class TextExtractor {
    constructor(options = {}) {
      this.includeLinks = options.includeLinks || false;
      this.readingSpeed = options.readingSpeed || 200;
      this.speakingSpeed = options.speakingSpeed || 150;
      this.getWordFrequency = options.getWordFrequency || false;
      this.frequencyWordCount = options.frequencyWordCount || 5;
      
      this.excludedTags = new Set([
        'script', 'style', 'noscript', 'iframe', 'svg', 'math',
        'canvas', 'video', 'audio', 'object', 'embed', 'applet',
        'map', 'area', 'base', 'basefont', 'bgsound', 'blink',
        'button', 'command', 'datalist', 'dialog', 'frame', 'frameset',
        'head', 'input', 'keygen', 'link', 'meta', 'meter', 'noframes',
        'optgroup', 'option', 'param', 'progress', 'rp', 'rt', 'ruby',
        'select', 'source', 'template', 'textarea', 'title', 'track'
      ]);

      this.hiddenClasses = [
        'sr-only', 'visually-hidden', 'hidden', 'hide', 'invisible',
        'screen-reader-text', 'screen-reader-only', 'aria-hidden'
      ];
    }

    getVisibleText() {
      const textParts = [];
      
      try {
        this.extractFromNode(document.body, textParts);
      } catch (error) {
        console.warn('Word Counter: TreeWalker extraction failed, using fallback', error);
        return this.getFallbackText();
      }

      if (textParts.length === 0) {
        return this.getFallbackText();
      }

      return textParts.join(' ');
    }

    extractFromNode(root, textParts) {
      if (!root) return;

      const processNode = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = node.textContent?.trim();
          if (text && text.length > 0) {
            const parent = node.parentElement;
            if (parent && this.shouldIncludeElement(parent)) {
              if (!this.includeLinks && this.isLinkText(parent)) {
                return;
              }
              textParts.push(text);
            }
          }
          return;
        }

        if (node.nodeType !== Node.ELEMENT_NODE) return;

        const element = node;
        const tagName = element.tagName?.toLowerCase();

        if (this.excludedTags.has(tagName)) return;
        if (!this.shouldIncludeElement(element)) return;

        if (tagName === 'a' && !this.includeLinks) {
          const href = element.getAttribute('href');
          if (href && this.isUrl(href)) {
            return;
          }
        }

        for (const child of element.childNodes) {
          processNode(child);
        }
      };

      processNode(root);
    }

    shouldIncludeElement(element) {
      if (!element) return false;

      try {
        if (element.hidden) return false;
        if (element.getAttribute('aria-hidden') === 'true') return false;

        const className = element.className;
        if (typeof className === 'string') {
          const lowerClass = className.toLowerCase();
          for (const hiddenClass of this.hiddenClasses) {
            if (lowerClass.includes(hiddenClass)) return false;
          }
        }

        const style = element.style;
        if (style) {
          if (style.display === 'none') return false;
          if (style.visibility === 'hidden') return false;
          if (style.opacity === '0') return false;
        }

        let computedStyle;
        try {
          computedStyle = window.getComputedStyle(element);
        } catch (e) {
          return true;
        }

        if (computedStyle.display === 'none') return false;
        if (computedStyle.visibility === 'hidden') return false;
        if (computedStyle.opacity === '0') return false;

        const width = parseFloat(computedStyle.width);
        const height = parseFloat(computedStyle.height);
        if (width === 0 && height === 0) return false;

        const clip = computedStyle.clip;
        if (clip === 'rect(0px, 0px, 0px, 0px)' || clip === 'rect(0, 0, 0, 0)') return false;

        const clipPath = computedStyle.clipPath;
        if (clipPath === 'inset(100%)' || clipPath === 'circle(0)') return false;

        return true;
      } catch (error) {
        return true;
      }
    }

    isLinkText(element) {
      if (!element) return false;
      
      let current = element;
      while (current && current !== document.body) {
        if (current.tagName?.toLowerCase() === 'a') {
          const href = current.getAttribute('href');
          if (href && this.isUrl(href)) {
            return true;
          }
        }
        current = current.parentElement;
      }
      return false;
    }

    isUrl(text) {
      if (!text) return false;
      const urlPattern = /^(https?:\/\/|www\.|\/\/)/i;
      return urlPattern.test(text.trim());
    }

    getFallbackText() {
      try {
        const selectors = [
          'article',
          'main',
          '[role="main"]',
          '.content',
          '.post-content',
          '.article-content',
          '.entry-content',
          '.post-body',
          '#content',
          '#main-content',
          '.main-content'
        ];

        for (const selector of selectors) {
          const elements = document.querySelectorAll(selector);
          if (elements.length > 0) {
            let text = '';
            elements.forEach(el => {
              text += ' ' + this.getInnerText(el);
            });
            if (text.trim().length > 100) {
              return text;
            }
          }
        }

        return this.getInnerText(document.body);
      } catch (error) {
        console.warn('Word Counter: Fallback extraction failed', error);
        return document.body?.innerText || '';
      }
    }

    getInnerText(element) {
      if (!element) return '';
      
      try {
        const clone = element.cloneNode(true);
        
        const toRemove = clone.querySelectorAll(
          'script, style, noscript, iframe, svg, canvas, video, audio, ' +
          'nav, header, footer, aside, [role="navigation"], [role="banner"], ' +
          '[role="complementary"], [aria-hidden="true"], .hidden, .hide, ' +
          '.sr-only, .visually-hidden, button, input, select, textarea'
        );
        toRemove.forEach(el => el.remove());
        
        return clone.innerText || clone.textContent || '';
      } catch (error) {
        return element.innerText || element.textContent || '';
      }
    }

    cleanText(text) {
      if (!text) return '';
      
      let cleaned = text
        .replace(/[\u2014\u2013\u2012\u2011\u2010]/g, ' ')
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\u00A0/g, ' ');

      if (!this.includeLinks) {
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, '');
        cleaned = cleaned.replace(/www\.[^\s]+/gi, '');
      } else {
        cleaned = cleaned.replace(/https?:\/\/[^\s]+/gi, ' URLPLACEHOLDER ');
        cleaned = cleaned.replace(/www\.[^\s]+/gi, ' URLPLACEHOLDER ');
      }

      cleaned = cleaned
        .replace(/[^\w\s\u00C0-\u024F\u0400-\u04FF\u0100-\u017F\u0600-\u06FF\u0980-\u09FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

      return cleaned;
    }

    countWords(text) {
      const cleaned = this.cleanText(text);
      if (!cleaned) return [];
      
      const words = cleaned.split(/\s+/).filter(word => {
        if (word === 'URLPLACEHOLDER') return this.includeLinks;
        return word.length > 0 && /[\w\u00C0-\u024F\u0400-\u04FF\u0100-\u017F\u0600-\u06FF\u0980-\u09FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF]/.test(word);
      });

      return words.map(w => w === 'URLPLACEHOLDER' ? '[URL]' : w);
    }

    calculateWordFrequency(words) {
      const frequency = new Map();
      
      words.forEach(word => {
        if (word === '[URL]') return;
        
        const lowerWord = word.toLowerCase();
        
        if (lowerWord.length < 3) return;
        if (commonStopWords.has(lowerWord)) return;
        if (/^\d+$/.test(lowerWord)) return;
        
        frequency.set(lowerWord, (frequency.get(lowerWord) || 0) + 1);
      });

      const sorted = Array.from(frequency.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, this.frequencyWordCount)
        .map(([word, count]) => ({ word, count }));

      return sorted;
    }

    analyze(text) {
      if (!text || typeof text !== 'string') {
        return this.getEmptyStats();
      }

      try {
        const words = this.countWords(text);
        const wordCount = words.length;

        const charactersWithSpaces = text.length;
        const charactersNoSpaces = text.replace(/\s/g, '').length;

        const sentences = this.countSentences(text);
        const paragraphs = this.countParagraphs(text);

        const uniqueWordsSet = new Set(words.map(w => w.toLowerCase()));
        const uniqueWords = uniqueWordsSet.size;

        let totalLength = 0;
        let longestWord = '';
        
        words.forEach(word => {
          if (word !== '[URL]') {
            totalLength += word.length;
            if (word.length > longestWord.length) {
              longestWord = word;
            }
          }
        });

        const avgWordLength = wordCount > 0 ? totalLength / wordCount : 0;
        const longestWordLength = longestWord.length;

        const readingTime = (wordCount / this.readingSpeed) * 60;
        const speakingTime = (wordCount / this.speakingSpeed) * 60;

        const density = charactersNoSpaces > 0 
          ? (wordCount / charactersNoSpaces) * 100 
          : 0;

        const result = {
          words: wordCount,
          charactersWithSpaces,
          charactersNoSpaces,
          sentences,
          paragraphs,
          uniqueWords,
          avgWordLength,
          longestWord,
          longestWordLength,
          readingTime,
          speakingTime,
          density
        };

        if (this.getWordFrequency) {
          result.wordFrequency = this.calculateWordFrequency(words);
        }

        return result;
      } catch (error) {
        console.error('Word Counter: Analysis failed', error);
        return this.getEmptyStats();
      }
    }

    countSentences(text) {
      if (!text) return 0;
      const matches = text.match(/[.!?。！？]+[\s\n]+|[.!?。！？]+$/g);
      return matches ? matches.length : (text.trim().length > 0 ? 1 : 0);
    }

    countParagraphs(text) {
      if (!text) return 0;
      const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
      return Math.max(paragraphs.length, text.trim().length > 0 ? 1 : 0);
    }

    getEmptyStats() {
      const result = {
        words: 0,
        charactersWithSpaces: 0,
        charactersNoSpaces: 0,
        sentences: 0,
        paragraphs: 0,
        uniqueWords: 0,
        avgWordLength: 0,
        longestWord: '',
        longestWordLength: 0,
        readingTime: 0,
        speakingTime: 0,
        density: 0
      };

      if (this.getWordFrequency) {
        result.wordFrequency = [];
      }

      return result;
    }
  }

  class SelectionPopup {
    constructor() {
      this.popup = null;
      this.hideTimeout = null;
      this.styleInjected = false;
    }

    injectStyles() {
      if (this.styleInjected) return;
      
      const styleId = 'word-counter-selection-styles';
      if (document.getElementById(styleId)) {
        this.styleInjected = true;
        return;
      }

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        #word-counter-selection-popup {
          position: fixed;
          z-index: 2147483647;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 8px 14px;
          border-radius: 8px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          font-size: 13px;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.25);
          pointer-events: none;
          opacity: 0;
          transform: translateY(10px) scale(0.9);
          transition: opacity 0.2s ease, transform 0.2s ease;
          line-height: 1.4;
        }

        #word-counter-selection-popup.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
        }

        #word-counter-selection-popup .wc-popup-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        #word-counter-selection-popup .wc-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        #word-counter-selection-popup .wc-value {
          font-size: 16px;
          font-weight: 700;
          line-height: 1;
        }

        #word-counter-selection-popup .wc-label {
          font-size: 10px;
          opacity: 0.85;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        #word-counter-selection-popup .wc-divider {
          width: 1px;
          height: 28px;
          background: rgba(255, 255, 255, 0.3);
        }
      `;

      (document.head || document.documentElement).appendChild(style);
      this.styleInjected = true;
    }

    create() {
      if (this.popup && document.body.contains(this.popup)) {
        this.updateLabels();
        return;
      }

      if (this.popup) {
        this.destroy();
      }

      this.injectStyles();

      this.popup = document.createElement('div');
      this.popup.id = 'word-counter-selection-popup';
      this.popup.innerHTML = `
        <div class="wc-popup-content">
          <div class="wc-stat">
            <span class="wc-value" id="wc-sel-words">0</span>
            <span class="wc-label" id="wc-sel-words-label"></span>
          </div>
          <div class="wc-divider"></div>
          <div class="wc-stat">
            <span class="wc-value" id="wc-sel-chars">0</span>
            <span class="wc-label" id="wc-sel-chars-label"></span>
          </div>
        </div>
      `;

      document.body.appendChild(this.popup);
      this.updateLabels();
    }

    updateLabels() {
      if (!this.popup) return;
      
      const wordsLabel = this.popup.querySelector('#wc-sel-words-label');
      const charsLabel = this.popup.querySelector('#wc-sel-chars-label');
      
      if (wordsLabel) wordsLabel.textContent = translations.words;
      if (charsLabel) charsLabel.textContent = translations.chars;
    }

    show(x, y, stats) {
      try {
        this.create();

        clearTimeout(this.hideTimeout);

        const wordsEl = this.popup.querySelector('#wc-sel-words');
        const charsEl = this.popup.querySelector('#wc-sel-chars');
        
        if (wordsEl) wordsEl.textContent = stats.words.toLocaleString();
        if (charsEl) charsEl.textContent = stats.charactersNoSpaces.toLocaleString();

        const popupWidth = 140;
        const popupHeight = 60;
        const padding = 15;

        let posX = x + padding;
        let posY = y - popupHeight - padding;

        if (posX + popupWidth > window.innerWidth) {
          posX = window.innerWidth - popupWidth - padding;
        }
        if (posX < padding) {
          posX = padding;
        }

        if (posY < padding) {
          posY = y + padding;
        }

        this.popup.style.left = `${posX}px`;
        this.popup.style.top = `${posY}px`;

        requestAnimationFrame(() => {
          if (this.popup) {
            this.popup.classList.add('visible');
          }
        });
      } catch (error) {
        console.warn('Word Counter: Failed to show selection popup', error);
      }
    }

    hide() {
      if (!this.popup) return;

      this.hideTimeout = setTimeout(() => {
        if (this.popup) {
          this.popup.classList.remove('visible');
        }
      }, 100);
    }

    destroy() {
      if (this.popup && this.popup.parentNode) {
        this.popup.parentNode.removeChild(this.popup);
      }
      this.popup = null;
    }
  }

  const selectionHandler = {
    popup: new SelectionPopup(),
    extractor: new TextExtractor(settings),
    isInitialized: false,

    init() {
      if (this.isInitialized) return;
      
      document.addEventListener('mouseup', this.handleMouseUp.bind(this), true);
      document.addEventListener('mousedown', this.handleMouseDown.bind(this), true);
      document.addEventListener('keydown', this.handleKeyDown.bind(this), true);
      
      this.isInitialized = true;
    },

    handleMouseUp(event) {
      if (!settings.selectiveCounter) return;

      setTimeout(() => {
        try {
          const selection = window.getSelection();
          const text = selection?.toString()?.trim();

          if (text && text.length > 0) {
            const stats = this.extractor.analyze(text);
            if (stats.words > 0) {
              this.popup.show(event.clientX, event.clientY, stats);
            }
          }
        } catch (error) {
          console.warn('Word Counter: Selection handling failed', error);
        }
      }, 10);
    },

    handleMouseDown() {
      this.popup.hide();
    },

    handleKeyDown(event) {
      if (event.key === 'Escape') {
        this.popup.hide();
      }
    },

    updateSettings(newSettings) {
      this.extractor = new TextExtractor(newSettings);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => selectionHandler.init());
  } else {
    selectionHandler.init();
  }

  function handleCountWords(options, sendResponse) {
    try {
      const extractor = new TextExtractor({
        includeLinks: options?.includeLinks || false,
        readingSpeed: options?.readingSpeed || 200,
        speakingSpeed: options?.speakingSpeed || 150,
        getWordFrequency: options?.getWordFrequency || false,
        frequencyWordCount: options?.frequencyWordCount || 5
      });

      let text = '';
      
      try {
        text = extractor.getVisibleText();
      } catch (e) {
        console.warn('Word Counter: Primary extraction failed, using fallback');
        text = document.body?.innerText || '';
      }
      
      if (!text || text.trim().length === 0) {
        text = document.body?.innerText || document.body?.textContent || '';
      }
      
      if (!text || text.trim().length === 0) {
        sendResponse({
          success: false,
          error: 'No readable content found on this page'
        });
        return;
      }

      const stats = extractor.analyze(text);
      
      sendResponse({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Word Counter: Error analyzing page', error);
      sendResponse({
        success: false,
        error: error.message || 'Error counting content'
      });
    }
  }

  async function handleSettingsUpdated(newSettings, sendResponse) {
    try {
      const oldLanguage = currentLocale;
      settings = { ...settings, ...newSettings };
      
      if (newSettings.language && newSettings.language !== oldLanguage) {
        currentLocale = newSettings.language;
        await loadTranslations();
      }
      
      selectionHandler.updateSettings(settings);
      
      if (!settings.selectiveCounter) {
        selectionHandler.popup.destroy();
      }
      
      sendResponse({ success: true });
    } catch (error) {
      console.error('Word Counter: Failed to update settings', error);
      sendResponse({ success: false, error: error.message });
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'countWords') {
      handleCountWords(message.options, sendResponse);
      return true;
    }

    if (message.action === 'settingsUpdated') {
      handleSettingsUpdated(message.settings, sendResponse);
      return true;
    }

    if (message.action === 'ping') {
      sendResponse({ success: true, status: 'alive' });
      return true;
    }

    if (message.action === 'updateLanguage') {
      currentLocale = message.language;
      loadTranslations().then(() => {
        sendResponse({ success: true });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    }

    return false;
  });

  chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'sync') {
      let languageChanged = false;
      
      Object.keys(changes).forEach(key => {
        if (key in settings) {
          settings[key] = changes[key].newValue;
        }
        if (key === 'language') {
          currentLocale = changes[key].newValue;
          languageChanged = true;
        }
      });
      
      selectionHandler.updateSettings(settings);
      
      if (languageChanged) {
        loadTranslations();
      }
    }
  });

})();
