// Inject the script into the page to access window objects directly
function pageScript() {
  let speedConfig = {
    speed: 1.0,
    setInterval: true,
    setTimeout: true,
    performance: true,
    dateNow: true,
    requestAnimationFrame: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  };

  // Mobile-specific configurations
  const MOBILE_CONFIG = {
    UPDATE_INTERVAL: 32, // ~30fps for better mobile performance
    BATCH_SIZE: 5, // Process timers in batches on mobile
    THROTTLE_THRESHOLD: 100 // Minimum time between heavy operations
  };

  // Store original functions
  const originalClearInterval = window.clearInterval;
  const originalClearTimeout = window.clearTimeout;
  const originalSetInterval = window.setInterval;
  const originalSetTimeout = window.setTimeout;
  const originalPerformanceNow = window.performance.now.bind(window.performance);
  const originalDateNow = Date.now;
  const originalRequestAnimationFrame = window.requestAnimationFrame;
  const emptyFunction = () => {};

  // Timer management with mobile-specific optimizations
  const timers = new Map();
  let lastBatchProcess = 0;
  let timerBatch = [];

  const processBatch = () => {
    const currentTime = Date.now();
    if (speedConfig.isMobile && currentTime - lastBatchProcess < MOBILE_CONFIG.THROTTLE_THRESHOLD) {
      return; // Throttle processing on mobile
    }
    lastBatchProcess = currentTime;

    // Process timers in batches on mobile
    const batchSize = speedConfig.isMobile ? MOBILE_CONFIG.BATCH_SIZE : timers.size;
    let processed = 0;

    for (const [id, timer] of timers.entries()) {
      if (processed >= batchSize) break;

      originalClearInterval(timer.id);
      if (timer.customTimerId) {
        originalClearInterval(timer.customTimerId);
      }

      if (!timer.finished && speedConfig.speed > 0) {
        const adjustedTimeout = speedConfig.setInterval ?
          timer.timeout / speedConfig.speed :
          timer.timeout;

        // Use different intervals for mobile
        const effectiveTimeout = speedConfig.isMobile ?
          Math.max(adjustedTimeout, MOBILE_CONFIG.UPDATE_INTERVAL) :
          adjustedTimeout;

        const newTimerId = originalSetInterval(
          timer.handler,
          effectiveTimeout,
          ...timer.args
        );
        timer.customTimerId = newTimerId;
      } else {
        timers.delete(id);
      }
      processed++;
    }
  };

  const reloadTimers = () => {
    if (speedConfig.isMobile) {
      // Schedule batch processing for mobile
      if (timerBatch.length === 0) {
        timerBatch.push(setTimeout(processBatch, MOBILE_CONFIG.THROTTLE_THRESHOLD));
      }
    } else {
      processBatch();
    }
  };

  // Clear functions with improved cleanup
  window.clearInterval = (id) => {
    originalClearInterval(id);
    const timer = timers.get(id);
    if (timer) {
      timer.finished = true;
      if (timer.customTimerId) {
        originalClearInterval(timer.customTimerId);
      }
      timers.delete(id);
    }
  };

  window.clearTimeout = (id) => {
    originalClearTimeout(id);
    const timer = timers.get(id);
    if (timer) {
      timer.finished = true;
      if (timer.customTimerId) {
        originalClearTimeout(timer.customTimerId);
      }
      timers.delete(id);
    }
  };

  // Set functions with optimized performance
  window.setInterval = (handler, timeout = 0, ...args) => {
    if (speedConfig.speed === 0) {
      return originalSetInterval(handler, timeout, ...args);
    }
    const id = originalSetInterval(
      handler,
      speedConfig.setInterval ? timeout / speedConfig.speed : timeout,
      ...args
    );
    timers.set(id, {
      id,
      handler,
      timeout,
      args,
      finished: false,
      customTimerId: null
    });
    return id;
  };

  window.setTimeout = (handler, timeout = 0, ...args) => {
    if (speedConfig.speed === 0) {
      return originalSetTimeout(handler, timeout, ...args);
    }
    return originalSetTimeout(
      handler,
      speedConfig.setTimeout ? timeout / speedConfig.speed : timeout,
      ...args
    );
  };

  // Performance.now override with improved precision
  (function() {
    let performanceNowValue = null;
    let previousPerformanceNowValue = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = speedConfig.isMobile ? MOBILE_CONFIG.UPDATE_INTERVAL : 16; // Use mobile or PC interval

    window.performance.now = () => {
      const currentTime = originalPerformanceNow();
      if (speedConfig.speed === 0) return currentTime;

      // Mobile-specific throttling
      if (speedConfig.isMobile) {
        if (currentTime - lastUpdateTime < MOBILE_CONFIG.UPDATE_INTERVAL) {
          return performanceNowValue || currentTime;
        }
      } else if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
        return performanceNowValue || currentTime;
      }

      if (performanceNowValue) {
        const timeDiff = currentTime - previousPerformanceNowValue;
        const speedMultiplier = speedConfig.performance ? speedConfig.speed : 1;
        
        // Limit time difference on mobile for smoother performance
        performanceNowValue += speedConfig.isMobile ?
          Math.min(timeDiff * speedMultiplier, MOBILE_CONFIG.THROTTLE_THRESHOLD) :
          timeDiff * speedMultiplier;
      } else {
        performanceNowValue = currentTime;
      }
      
      previousPerformanceNowValue = currentTime;
      lastUpdateTime = currentTime;
      return Math.floor(performanceNowValue);
    };
  })();

  // Date.now override with throttling for mobile
  (function() {
    let dateNowValue = null;
    let previousDateNowValue = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = speedConfig.isMobile ? MOBILE_CONFIG.UPDATE_INTERVAL : 16; // Use mobile or PC interval

    Date.now = () => {
      const currentTime = originalDateNow();
      if (speedConfig.speed === 0) return currentTime;

      // Mobile-specific throttling
      if (speedConfig.isMobile) {
        if (currentTime - lastUpdateTime < MOBILE_CONFIG.UPDATE_INTERVAL) {
          return dateNowValue || currentTime;
        }
      } else if (currentTime - lastUpdateTime < UPDATE_INTERVAL) {
        return dateNowValue || currentTime;
      }

      if (dateNowValue) {
        const timeDiff = currentTime - previousDateNowValue;
        const speedMultiplier = speedConfig.dateNow ? speedConfig.speed : 1;
        
        // Limit time difference on mobile for smoother performance
        dateNowValue += speedConfig.isMobile ?
          Math.min(timeDiff * speedMultiplier, MOBILE_CONFIG.THROTTLE_THRESHOLD) :
          timeDiff * speedMultiplier;
      } else {
        dateNowValue = currentTime;
      }
      
      previousDateNowValue = currentTime;
      lastUpdateTime = currentTime;
      return Math.floor(dateNowValue);
    };
  })();

  // RequestAnimationFrame override with mobile optimizations
  (function() {
    const callbackMap = new Map();
    let lastTime = originalDateNow();
    
    const newRequestAnimationFrame = (callback) => {
      return originalRequestAnimationFrame((timestamp) => {
        const currentTime = originalDateNow();
        if (speedConfig.speed === 0) {
          callback(timestamp);
          return;
        }

        const deltaTime = currentTime - lastTime;
        lastTime = currentTime;

        // Mobile-specific frame timing
        const frameThreshold = speedConfig.isMobile ?
          MOBILE_CONFIG.UPDATE_INTERVAL : // ~30fps for mobile
          16.67; // 60fps for desktop

        if (!callbackMap.has(callback)) {
          callbackMap.set(callback, {
            accumulator: 0,
            lastProcessed: currentTime
          });
          callback(timestamp);
        } else if (speedConfig.requestAnimationFrame) {
          const state = callbackMap.get(callback);

          // Throttle processing on mobile
          if (speedConfig.isMobile &&
              currentTime - state.lastProcessed < MOBILE_CONFIG.THROTTLE_THRESHOLD) {
            window.requestAnimationFrame(callback);
            return;
          }

          state.accumulator += deltaTime * speedConfig.speed;
          state.lastProcessed = currentTime;

          // Process accumulated time in chunks
          while (state.accumulator >= frameThreshold) {
            callback(timestamp);
            state.accumulator -= frameThreshold;

            // Break early on mobile if we've processed enough frames
            if (speedConfig.isMobile &&
                currentTime - state.lastProcessed >= MOBILE_CONFIG.UPDATE_INTERVAL) {
              break;
            }
          }

          if (state.accumulator > 0) {
            window.requestAnimationFrame(callback);
          } else {
            callbackMap.delete(callback);
          }
        } else {
          callback(timestamp);
          callbackMap.delete(callback);
        }
      });
    };
    window.requestAnimationFrame = newRequestAnimationFrame;
  })();

  // Message handling for config updates
  window.addEventListener("message", (e) => {
    if (e.data.action === "updateSettings") {
      const isMobile = speedConfig.isMobile; // Preserve mobile detection
      speedConfig = {
        ...e.data.settings,
        isMobile // Keep mobile status
      };
      reloadTimers();
    }
  });
}

// Inject script into page with error handling
try {
  const script = document.createElement("script");
  script.textContent = `(${pageScript.toString()})();`;
  document.documentElement.appendChild(script);
  script.remove(); // Clean up after injection
} catch (error) {
  console.error('Error injecting speed controller script:', error);
}

// Handle messages from popup/background with improved error handling
browser.runtime.onMessage.addListener(async (message) => {
  try {
    if (message.action === "updateSettings") {
      // Don't override auto-speed settings when manually changing speed
      if (!message.isAutoSpeed) {
        const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
        const currentHost = window.location.hostname;
        if (currentHost in autoSpeedSites) {
          return; // Don't apply manual speed if auto-speed is active
        }
      }
      window.postMessage({
        action: "updateSettings",
        settings: message.settings
      }, "*");
    } else if (message.action === "checkAutoSpeed") {
      await checkAutoSpeedSite();
    }
  } catch (error) {
    console.error('Error handling message:', error);
  }
});

// Automatically check for auto-speed when script loads
checkAutoSpeedSite();

// Check if current site is in auto-speed list
async function checkAutoSpeedSite() {
  try {
    const currentHost = window.location.hostname;
    const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
    
    if (currentHost in autoSpeedSites) {
      const speed = autoSpeedSites[currentHost];
      
      // Show notification
      browser.runtime.sendMessage({
        action: 'showNotification',
        title: 'Auto-Speed Activated',
        message: `Speed set to ${speed}x for ${currentHost}`
      });

      // Update popup with auto-speed status
      browser.runtime.sendMessage({
        action: 'updateAutoSpeedStatus',
        status: {
          active: true,
          speed: speed,
          domain: currentHost
        }
      });

      // Apply speed settings
      window.postMessage({
        action: "updateSettings",
        settings: {
          speed: speed,
          setInterval: true,
          setTimeout: true,
          performance: true,
          dateNow: true,
          requestAnimationFrame: false,
          isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
        }
      }, "*");
    } else {
      // Update popup that no auto-speed is active
      browser.runtime.sendMessage({
        action: 'updateAutoSpeedStatus',
        status: {
          active: false
        }
      });
    }
  } catch (error) {
    console.error('Error checking auto-speed site:', error);
  }
}