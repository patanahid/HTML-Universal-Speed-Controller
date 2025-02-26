// Initialize default settings when extension is installed
browser.runtime.onInstalled.addListener(async () => {
  const defaultSettings = {
    speed: 2,
    setInterval: true,
    setTimeout: true,
    performance: true,
    dateNow: true,
    requestAnimationFrame: false,
    autoSpeedSites: []
  };

  // Check if settings already exist
  const existingSettings = await browser.storage.local.get(Object.keys(defaultSettings));
  
  // Only set defaults for missing settings
  const newSettings = {};
  for (const [key, value] of Object.entries(defaultSettings)) {
    if (existingSettings[key] === undefined) {
      newSettings[key] = value;
    }
  }

  if (Object.keys(newSettings).length > 0) {
    await browser.storage.local.set(newSettings);
  }
});

// Listen for messages from content script
browser.runtime.onMessage.addListener((message, sender) => {
  if (message.action === 'showNotification') {
    browser.notifications.create({
      type: 'basic',
      iconUrl: browser.runtime.getURL('icons/icon-48.svg'),
      title: message.title,
      message: message.message
    });
  }
  return true;
});

// Listen for tab updates to check if new page should have auto-speed
browser.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      await browser.tabs.sendMessage(tabId, { action: 'checkAutoSpeed' });
    } catch (e) {
      // Ignore errors for tabs that don't have our content script
    }
  }
});