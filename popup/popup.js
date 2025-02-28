// Get DOM elements
const speedButtons = document.querySelectorAll('.speed-btn:not(.auto-trigger-btn)');
const autoTriggerBtn = document.querySelector('.auto-trigger-btn');
const autoStatus = autoTriggerBtn.querySelector('.auto-status');
const autoSpeed = autoTriggerBtn.querySelector('.auto-speed');

let isAutoSpeedActive = false;
let currentAutoSpeed = null;
let currentDomain = null;

// Mobile detection function
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

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
    });

    // Check if current speed differs from saved
    const activeSpeedBtn = document.querySelector('.speed-btn.active:not(.auto-trigger-btn)');
    if (activeSpeedBtn) {
      const currentSpeed = parseInt(activeSpeedBtn.dataset.speed);
      if (currentSpeed !== status.speed) {
        autoTriggerBtn.classList.add('modified');
        autoSpeed.textContent = `${currentSpeed}x (saved: ${status.speed}x)`;
      } else {
        autoTriggerBtn.classList.remove('modified');
      }
    }
  } else {
    autoStatus.textContent = 'Auto-Speed: Off';
    autoSpeed.textContent = '';
    autoTriggerBtn.classList.remove('active');
    autoTriggerBtn.classList.remove('modified');
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

  if (isMobileDevice()) {
    // Create a mobile optimization section
    const mobileOptSection = document.createElement('div');
    mobileOptSection.className = 'toggle-section mobile-only';
    mobileOptSection.innerHTML = `
      <label class="toggle">
        <input type="checkbox" id="mobileOptimizationToggle" checked>
        <span class="toggle-label">Mobile Optimization</span>
      </label>
    `;
    
    // Insert it before the options button
    optionsButton.parentNode.insertBefore(mobileOptSection, optionsButton);
    
    // Add the handler
    const mobileOptToggle = document.getElementById('mobileOptimizationToggle');
    mobileOptToggle.addEventListener('change', async () => {
      const isOptimized = mobileOptToggle.checked;
      await browser.storage.local.set({ mobileOptimized: isOptimized });
      
      // Apply optimization immediately
      const tabs = await browser.tabs.query({ active: true, currentWindow: true });
      await browser.tabs.sendMessage(tabs[0].id, {
        action: 'setMobileOptimization',
        optimized: isOptimized
      });
    });
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
  let speed = parseInt(this.dataset.speed);
  
  // No speed boost for mobile - keep timing accurate
  
  // Allow all speed changes when auto-speed is active
  const settings = {
    speed: speed,
    setInterval: setIntervalToggle.checked,
    setTimeout: setTimeoutToggle.checked,
    performance: performanceToggle.checked,
    dateNow: dateNowToggle.checked,
    requestAnimationFrame: requestAnimationFrameToggle.checked
  };

  // Update button states
  document.querySelectorAll('.speed-btn:not(.auto-trigger-btn)').forEach(b => b.classList.remove('active'));
  if (speed !== 0) { // Don't highlight stop button
    this.classList.add('active');
  }

  // If auto-speed is active, check if speed differs from saved
  if (isAutoSpeedActive && currentDomain) {
    const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
    const savedSpeed = autoSpeedSites[currentDomain];
    
    if (speed !== savedSpeed) {
      // Visual indication that speed differs from saved
      autoTriggerBtn.classList.add('modified');
      autoSpeed.textContent = `${speed}x (saved: ${savedSpeed}x)`;
    } else {
      autoTriggerBtn.classList.remove('modified');
      autoSpeed.textContent = `${speed}x on ${currentDomain}`;
    }
  }

  // Save settings
  await browser.storage.local.set(settings);

  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];

  // Send message to content script
  await browser.tabs.sendMessage(currentTab.id, {
    action: 'updateSettings',
    settings: settings,
    isAutoSpeed: false
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
  
  // Get current tab
  const tabs = await browser.tabs.query({ active: true, currentWindow: true });
  const currentTab = tabs[0];
  const url = new URL(currentTab.url);
  const currentHost = url.hostname;
  
  if (isAutoSpeedActive) {
    if (autoTriggerBtn.classList.contains('modified')) {
      // Update auto-speed with current speed
      const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
      const activeSpeedBtn = document.querySelector('.speed-btn.active:not(.auto-trigger-btn)');
      if (activeSpeedBtn) {
        const newSpeed = parseInt(activeSpeedBtn.dataset.speed);
        if (newSpeed > 0) { // Don't save if stop is selected
          autoSpeedSites[currentHost] = newSpeed;
          await browser.storage.local.set({ autoSpeedSites });
          
          // Update display with new speed
          updateAutoSpeedDisplay({
            active: true,
            speed: newSpeed,
            domain: currentHost
          });
          return;
        }
      }
    }
    
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
      
      // Update content script
      await browser.tabs.sendMessage(currentTab.id, {
        action: 'updateSettings',
        settings: settings,
        isAutoSpeed: true
      });
      
      // Update display
      updateAutoSpeedDisplay({ active: false });
    }
  } else {
    // Enable auto-speed
    const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
    
    // Get selected speed or default to 20x
    let selectedSpeed = 20; // Default speed
    const activeSpeedBtn = document.querySelector('.speed-btn.active:not(.auto-trigger-btn)');
    if (activeSpeedBtn) {
      const btnSpeed = parseInt(activeSpeedBtn.dataset.speed);
      if (btnSpeed > 0) { // Only use selected speed if it's not stop (0)
        selectedSpeed = btnSpeed;
      }
    }
    
    // Save or update auto-speed for this site
    autoSpeedSites[currentHost] = selectedSpeed;
    await browser.storage.local.set({ autoSpeedSites });
    
    // Apply speed settings
    const settings = {
      speed: selectedSpeed,
      setInterval: setIntervalToggle.checked,
      setTimeout: setTimeoutToggle.checked,
      performance: performanceToggle.checked,
      dateNow: dateNowToggle.checked,
      requestAnimationFrame: requestAnimationFrameToggle.checked
    };
    
    // Update content script
    await browser.tabs.sendMessage(currentTab.id, {
      action: 'updateSettings',
      settings: settings,
      isAutoSpeed: true
    });
    
    // Update display
    updateAutoSpeedDisplay({
      active: true,
      speed: selectedSpeed,
      domain: currentHost
    });
  }
  
  // Visual feedback for mobile
  autoTriggerBtn.style.transform = 'scale(0.95)';
  setTimeout(() => {
    autoTriggerBtn.style.transform = 'scale(1)';
  }, 100);
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
    // If running on mobile, prioritize the most effective methods
    if (isMobileDevice()) {
      // Force enable the most effective methods for mobile
      setIntervalToggle.checked = true;
      setTimeoutToggle.checked = true;
      // requestAnimationFrame is often the most reliable on mobile
      requestAnimationFrameToggle.checked = true;
    }
    
    // Rest of your existing code...
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
  window.close(); // Close the popup when opening options
};

// Add both click and touch handlers for options button
optionsButton.addEventListener('click', handleOptionsClick);
optionsButton.addEventListener('touchend', handleOptionsClick);