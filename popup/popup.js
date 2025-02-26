// Get DOM elements
const speedButtons = document.querySelectorAll('.speed-btn:not(.auto-trigger-btn)');
const autoTriggerBtn = document.querySelector('.auto-trigger-btn');
const autoStatus = autoTriggerBtn.querySelector('.auto-status');
const autoSpeed = autoTriggerBtn.querySelector('.auto-speed');

let isAutoSpeedActive = false;
let currentAutoSpeed = null;
let currentDomain = null;

// Listen for auto-speed status updates
browser.runtime.onMessage.addListener((message) => {
  if (message.action === 'updateAutoSpeedStatus') {
    updateAutoSpeedDisplay(message.status);
  }
});

// Update auto-speed status display
function updateAutoSpeedDisplay(status) {
  isAutoSpeedActive = status.active;
  
  if (status.active) {
    currentAutoSpeed = status.speed;
    currentDomain = status.domain;
    
    autoStatus.textContent = 'Auto-Speed: On';
    autoSpeed.textContent = `${status.speed}x on ${status.domain}`;
    autoTriggerBtn.classList.add('active');
    
    // Update speed buttons
    speedButtons.forEach(btn => {
      if (parseInt(btn.dataset.speed) === status.speed) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
      btn.disabled = true; // Disable manual speed changes when auto-speed is active
    });
  } else {
    autoStatus.textContent = 'Auto-Speed: Off';
    autoSpeed.textContent = '';
    autoTriggerBtn.classList.remove('active');
    
    // Re-enable speed buttons
    speedButtons.forEach(btn => {
      btn.disabled = false;
    });
  }
}

// Check auto-speed status when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      // Trigger a check of auto-speed status
      await browser.tabs.sendMessage(tabs[0].id, { action: 'checkAutoSpeed' });
    } catch (e) {
      // Tab might not have our content script
      console.error('Error checking auto-speed status:', e);
    }
  }
});

const setIntervalToggle = document.getElementById('setIntervalToggle');
const setTimeoutToggle = document.getElementById('setTimeoutToggle');
const performanceToggle = document.getElementById('performanceToggle');
const dateNowToggle = document.getElementById('dateNowToggle');
const requestAnimationFrameToggle = document.getElementById('requestAnimationFrameToggle');
const optionsButton = document.getElementById('optionsButton');

// Load saved settings when popup opens
document.addEventListener('DOMContentLoaded', async () => {
  // Get saved settings
  const settings = await browser.storage.local.get({
    speed: 1,
    setInterval: true,
    setTimeout: true,
    performance: true,
    dateNow: true,
    requestAnimationFrame: false,
    speedSteps: [2, 5, 10, 20, 50],
    autoSpeedSites: {}
  });

  // Update speed buttons
  const speedButtonsContainer = document.querySelector('.speed-buttons');
  speedButtonsContainer.innerHTML = `
    <button class="speed-btn" data-speed="1">Normal</button>
    ${settings.speedSteps.map(speed =>
      `<button class="speed-btn" data-speed="${speed}">${speed}x</button>`
    ).join('')}
    <button class="speed-btn stop-btn" data-speed="0">Stop</button>
  `;

  // Add click/touch handlers to new buttons
  document.querySelectorAll('.speed-btn:not(.auto-trigger-btn)').forEach(btn => {
    // Handle both click and touch events
    const handleInteraction = (e) => {
      e.preventDefault(); // Prevent double-firing on mobile
      if (!btn.disabled) {
        handleSpeedButtonClick.call(btn);
      }
    };

    btn.addEventListener('click', handleInteraction);
    btn.addEventListener('touchend', handleInteraction);
    
    if (parseInt(btn.dataset.speed) === settings.speed) {
      btn.classList.add('active');
    }
  });

  // Update toggles
  setIntervalToggle.checked = settings.setInterval;
  setTimeoutToggle.checked = settings.setTimeout;
  performanceToggle.checked = settings.performance;
  dateNowToggle.checked = settings.dateNow;
  requestAnimationFrameToggle.checked = settings.requestAnimationFrame;

  // Get current tab and check for auto-speed
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  if (tabs[0]) {
    try {
      const url = new URL(tabs[0].url);
      const currentHost = url.hostname;
      
      // Check if current site has auto-speed
      if (currentHost in settings.autoSpeedSites) {
        updateAutoSpeedDisplay({
          active: true,
          speed: settings.autoSpeedSites[currentHost],
          domain: currentHost
        });
      } else {
        updateAutoSpeedDisplay({ active: false });
      }
    } catch (e) {
      console.error('Error checking auto-speed status:', e);
    }
  }
});

// Speed button click handler
async function handleSpeedButtonClick() {
  const speed = parseInt(this.dataset.speed);
  
  // Allow stop button to work even when auto-speed is active
  if (this.disabled && speed !== 0) return;
  
  // If stopping while auto-speed is active, disable auto-speed
  if (speed === 0 && isAutoSpeedActive) {
    const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
    if (currentDomain) {
      delete autoSpeedSites[currentDomain];
      await browser.storage.local.set({ autoSpeedSites });
      updateAutoSpeedDisplay({ active: false });
    }
  }
  
  // Update button states
  document.querySelectorAll('.speed-btn:not(.auto-trigger-btn)').forEach(b => b.classList.remove('active'));
  if (speed !== 0) { // Don't highlight stop button
    this.classList.add('active');
  }

  const settings = {
    speed: speed,
    setInterval: setIntervalToggle.checked,
    setTimeout: setTimeoutToggle.checked,
    performance: performanceToggle.checked,
    dateNow: dateNowToggle.checked,
    requestAnimationFrame: requestAnimationFrameToggle.checked
  };

  // Save settings
  await browser.storage.local.set(settings);

  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  // Send message to content script with isAutoSpeed flag
  await browser.tabs.sendMessage(currentTab.id, {
    action: 'updateSettings',
    settings: settings,
    isAutoSpeed: false // Indicate this is a manual speed change
  });

  // Visual feedback
  this.style.transform = 'scale(0.95)';
  setTimeout(() => {
    this.style.transform = 'scale(1)';
  }, 100);
}

// Auto-trigger button handlers
const handleAutoTrigger = async (e) => {
  e.preventDefault(); // Prevent double-firing on mobile
  if (isAutoSpeedActive) {
    // Disable auto-speed
    const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
    if (currentDomain) {
      delete autoSpeedSites[currentDomain];
      await browser.storage.local.set({ autoSpeedSites });
      
      // Reset speed to 1
      const settings = {
        speed: 1,
        setInterval: setIntervalToggle.checked,
        setTimeout: setTimeoutToggle.checked,
        performance: performanceToggle.checked,
        dateNow: dateNowToggle.checked,
        requestAnimationFrame: requestAnimationFrameToggle.checked
      };
      
      // Get current tab
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      const currentTab = tabs[0];
      
      // Update content script
      await browser.tabs.sendMessage(currentTab.id, {
        action: 'updateSettings',
        settings: settings,
        isAutoSpeed: true
      });
      
      // Update display
      updateAutoSpeedDisplay({ active: false });
      
      // Visual feedback for mobile
      autoTriggerBtn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        autoTriggerBtn.style.transform = 'scale(1)';
      }, 100);
    }
  }
};

// Add both click and touch handlers for auto-trigger button
autoTriggerBtn.addEventListener('click', handleAutoTrigger);
autoTriggerBtn.addEventListener('touchend', handleAutoTrigger);

// Toggle change handlers
const toggles = [
  setIntervalToggle,
  setTimeoutToggle,
  performanceToggle,
  dateNowToggle,
  requestAnimationFrameToggle
];

toggles.forEach(toggle => {
  toggle.addEventListener('change', async () => {
    // If auto-speed is active, use its speed
    const speed = isAutoSpeedActive ? currentAutoSpeed :
      (document.querySelector('.speed-btn.active:not(.auto-trigger-btn)')?.dataset.speed || 1);

    const settings = {
      speed: parseInt(speed),
      setInterval: setIntervalToggle.checked,
      setTimeout: setTimeoutToggle.checked,
      performance: performanceToggle.checked,
      dateNow: dateNowToggle.checked,
      requestAnimationFrame: requestAnimationFrameToggle.checked
    };

    // Save settings
    await browser.storage.local.set(settings);

    // Get current tab
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    const currentTab = tabs[0];

    // Send message to content script with isAutoSpeed flag
    await browser.tabs.sendMessage(currentTab.id, {
      action: 'updateSettings',
      settings: settings,
      isAutoSpeed: isAutoSpeedActive
    });
  });
});

// Options button click/touch handler
const handleOptionsClick = (e) => {
  e.preventDefault(); // Prevent double-firing on mobile
  
  // Visual feedback for mobile
  optionsButton.style.transform = 'scale(0.95)';
  setTimeout(() => {
    optionsButton.style.transform = 'scale(1)';
  }, 100);
  
  browser.runtime.openOptionsPage();
};

// Add both click and touch handlers for options button
optionsButton.addEventListener('click', handleOptionsClick);
optionsButton.addEventListener('touchend', handleOptionsClick);