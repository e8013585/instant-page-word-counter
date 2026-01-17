chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    const defaultSettings = {
      darkMode: false,
      showThemeToggle: false,
      language: 'en',
      selectiveCounter: true,
      includeLinks: false,
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

    chrome.storage.sync.set(defaultSettings).then(() => {
      console.log('Word Counter: Default settings initialized');
    }).catch(error => {
      console.error('Word Counter: Failed to initialize settings', error);
    });
  }

  if (details.reason === 'update') {
    console.log('Word Counter: Extension updated to version', chrome.runtime.getManifest().version);
    
    injectContentScriptToAllTabs();
  }
});

async function injectContentScriptToAllTabs() {
  try {
    const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] });
    
    for (const tab of tabs) {
      if (tab.id && !isRestrictedUrl(tab.url)) {
        try {
          await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ['content/content.js']
          });
        } catch (e) {
          // Ignore errors for individual tabs
        }
      }
    }
  } catch (error) {
    console.warn('Word Counter: Failed to inject scripts on update', error);
  }
}

function isRestrictedUrl(url) {
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

chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'recount') {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab || !tab.id || isRestrictedUrl(tab.url)) {
        console.log('Word Counter: Cannot count on this page');
        return;
      }

      try {
        await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
      } catch (e) {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const settings = await chrome.storage.sync.get({
        includeLinks: false,
        readingSpeed: 200,
        speakingSpeed: 150
      });

      const response = await chrome.tabs.sendMessage(tab.id, {
        action: 'countWords',
        options: settings
      });

      if (response && response.success) {
        await chrome.action.setBadgeText({
          tabId: tab.id,
          text: formatBadgeNumber(response.data.words)
        });
        
        await chrome.action.setBadgeBackgroundColor({
          tabId: tab.id,
          color: '#3b82f6'
        });

        setTimeout(() => {
          chrome.action.setBadgeText({
            tabId: tab.id,
            text: ''
          }).catch(() => {});
        }, 3000);
      }
    } catch (error) {
      console.error('Word Counter: Command execution failed', error);
    }
  }
});

function formatBadgeNumber(num) {
  if (num >= 1000000) {
    return Math.floor(num / 1000000) + 'M';
  }
  if (num >= 1000) {
    return Math.floor(num / 1000) + 'K';
  }
  return num.toString();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'getSettings') {
    chrome.storage.sync.get(null).then(settings => {
      sendResponse({ success: true, settings });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  if (message.action === 'openSettings') {
    chrome.runtime.openOptionsPage();
    sendResponse({ success: true });
    return true;
  }

  if (message.action === 'injectContentScript') {
    const tabId = message.tabId;
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['content/content.js']
    }).then(() => {
      sendResponse({ success: true });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true;
  }

  return false;
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    chrome.action.setBadgeText({
      tabId: tabId,
      text: ''
    }).catch(() => {});
  }
});

chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id && !isRestrictedUrl(tab.url)) {
    try {
      await chrome.tabs.sendMessage(tab.id, { action: 'ping' });
    } catch (e) {
      try {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content/content.js']
        });
      } catch (injectError) {
        console.warn('Word Counter: Could not inject content script', injectError);
      }
    }
  }
});