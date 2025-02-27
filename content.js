// Inject the script into the page to access window objects directly
function pageScript() {
  let speedConfig = {
    speed: 1.0,
    setInterval: true,
    setTimeout: true,
    performance: true,
    dateNow: true,
    requestAnimationFrame: false,
    isMobile: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent),
    mobileBoostFactor: 1.75 // Boost factor specifically for mobile
  };

  // Mobile-specific configurations
  const MOBILE_CONFIG = {
    UPDATE_INTERVAL: 32, // ~30fps for better mobile performance
    BATCH_SIZE: 5, // Process timers in batches on mobile
    THROTTLE_THRESHOLD: 100, // Minimum time between heavy operations
    BOOST_FACTOR_MIN: 1.5, // Minimum boost factor
    BOOST_FACTOR_MAX: 2.5, // Maximum boost factor
    // Different boosts for different speed ranges
    BOOST_MAPPING: [
      { threshold: 2, factor: 1.5 },
      { threshold: 5, factor: 1.75 },
      { threshold: 10, factor: 2.0 },
      { threshold: 20, factor: 2.25 },
      { threshold: Infinity, factor: 2.5 }
    ]
  };

  // Add a function to calculate appropriate mobile boost factor based on the requested speed
  function calculateMobileBoostFactor(requestedSpeed) {
    if (!speedConfig.isMobile || requestedSpeed <= 1) return 1;
    
    for (const { threshold, factor } of MOBILE_CONFIG.BOOST_MAPPING) {
      if (requestedSpeed <= threshold) return factor;
    }
    return MOBILE_CONFIG.BOOST_FACTOR_MAX;
  }

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
    
    let adjustedTimeout = timeout;
    if (speedConfig.setInterval) {
      // Apply more aggressive timing for mobile
      if (speedConfig.isMobile) {
        // Make sure we don't go too fast and crash the browser
        adjustedTimeout = Math.max(timeout / speedConfig.speed, 10);
      } else {
        adjustedTimeout = timeout / speedConfig.speed;
      }
    }
    
    const id = originalSetInterval(handler, adjustedTimeout, ...args);
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
    
    let adjustedTimeout = timeout;
    if (speedConfig.setTimeout) {
      // Apply more aggressive timing for mobile
      if (speedConfig.isMobile) {
        // Ensure minimum timeout is reasonable for mobile
        adjustedTimeout = Math.max(timeout / speedConfig.speed, 5);
      } else {
        adjustedTimeout = timeout / speedConfig.speed;
      }
    }
    
    return originalSetTimeout(handler, adjustedTimeout, ...args);
  };

  // Performance.now override with improved mobile optimization
  (function() {
    let performanceNowValue = null;
    let previousPerformanceNowValue = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = speedConfig.isMobile ? MOBILE_CONFIG.UPDATE_INTERVAL : 16;

    window.performance.now = () => {
      const currentTime = originalPerformanceNow();
      if (speedConfig.speed === 0) return currentTime;

      // More frequent updates on mobile for smoother acceleration
      const updateThreshold = speedConfig.isMobile ? 
        Math.max(MOBILE_CONFIG.UPDATE_INTERVAL / 2, 10) : 
        UPDATE_INTERVAL;
        
      if (currentTime - lastUpdateTime < updateThreshold) {
        return performanceNowValue || currentTime;
      }

      if (performanceNowValue) {
        const timeDiff = currentTime - previousPerformanceNowValue;
        let speedMultiplier = speedConfig.performance ? speedConfig.speed : 1;
        
        // Apply additional acceleration on mobile
        if (speedConfig.isMobile && speedConfig.performance) {
          // More aggressive on mobile - use the full boost
          speedMultiplier = speedConfig.speed;
        }
        
        performanceNowValue += timeDiff * speedMultiplier;
      } else {
        performanceNowValue = currentTime;
      }
      
      previousPerformanceNowValue = currentTime;
      lastUpdateTime = currentTime;
      return Math.floor(performanceNowValue);
    };
  })();

  // Date.now override with improved mobile optimization
  (function() {
    let dateNowValue = null;
    let previousDateNowValue = null;
    let lastUpdateTime = 0;
    const UPDATE_INTERVAL = speedConfig.isMobile ? MOBILE_CONFIG.UPDATE_INTERVAL : 16;

    Date.now = () => {
      const currentTime = originalDateNow();
      if (speedConfig.speed === 0) return currentTime;

      // More frequent updates on mobile for smoother acceleration
      const updateThreshold = speedConfig.isMobile ? 
        Math.max(MOBILE_CONFIG.UPDATE_INTERVAL / 2, 10) : 
        UPDATE_INTERVAL;
        
      if (currentTime - lastUpdateTime < updateThreshold) {
        return dateNowValue || currentTime;
      }

      if (dateNowValue) {
        const timeDiff = currentTime - previousDateNowValue;
        let speedMultiplier = speedConfig.dateNow ? speedConfig.speed : 1;
        
        // Apply additional acceleration on mobile
        if (speedConfig.isMobile && speedConfig.dateNow) {
          // More aggressive on mobile - use the full boost
          speedMultiplier = speedConfig.speed;
        }
        
        dateNowValue += timeDiff * speedMultiplier;
      } else {
        dateNowValue = currentTime;
      }
      
      previousDateNowValue = currentTime;
      lastUpdateTime = currentTime;
      return Math.floor(dateNowValue);
    };
  })();

  // RequestAnimationFrame override with adaptive mobile optimizations
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

        // More aggressive frame timing for mobile
        const frameThreshold = speedConfig.isMobile ?
          Math.min(MOBILE_CONFIG.UPDATE_INTERVAL, 16.67) : // Push mobile harder
          16.67; // 60fps for desktop

        if (!callbackMap.has(callback)) {
          callbackMap.set(callback, {
            accumulator: 0,
            lastProcessed: currentTime,
            frameCount: 0
          });
          callback(timestamp);
        } else if (speedConfig.requestAnimationFrame) {
          const state = callbackMap.get(callback);
          
          // Dynamic throttling based on accumulated frames
          const throttleThreshold = speedConfig.isMobile ? 
            Math.max(MOBILE_CONFIG.THROTTLE_THRESHOLD / speedConfig.speed, 30) :
            MOBILE_CONFIG.THROTTLE_THRESHOLD;
          
          if (speedConfig.isMobile &&
              currentTime - state.lastProcessed < throttleThreshold) {
            window.requestAnimationFrame(callback);
            return;
          }

          // Apply more aggressive boost for rAF on mobile
          const effectiveSpeed = speedConfig.isMobile ? 
            speedConfig.speed * 1.2 : // Extra boost for animations
            speedConfig.speed;

          state.accumulator += deltaTime * effectiveSpeed;
          state.lastProcessed = currentTime;

          // Process multiple frames per actual frame on mobile
          const maxFramesPerUpdate = speedConfig.isMobile ? 3 : 1;
          let framesProcessed = 0;
          
          while (state.accumulator >= frameThreshold && framesProcessed < maxFramesPerUpdate) {
            callback(timestamp + (state.frameCount * frameThreshold));
            state.accumulator -= frameThreshold;
            state.frameCount++;
            framesProcessed++;
            
            if (speedConfig.isMobile &&
                framesProcessed >= maxFramesPerUpdate) {
              break;
            }
          }

          if (state.accumulator > 0 || framesProcessed >= maxFramesPerUpdate) {
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
      
      // Apply mobile boost factor if needed
      let appliedSpeed = e.data.settings.speed;
      if (isMobile && appliedSpeed > 1) {
        const boostFactor = calculateMobileBoostFactor(appliedSpeed);
        speedConfig.mobileBoostFactor = boostFactor;
        appliedSpeed = appliedSpeed * boostFactor;
        console.log(`Mobile boost: ${e.data.settings.speed}x → ${appliedSpeed}x (${boostFactor}x boost)`);
      }
      
      speedConfig = {
        ...e.data.settings,
        isMobile, // Keep mobile status
        mobileBoostFactor: speedConfig.mobileBoostFactor, // Keep boost factor
        speed: appliedSpeed // Use boosted speed for actual execution
      };
      reloadTimers();
    } else if (e.data.action === "setMobileOptimization") {
      // Handle specific mobile optimization toggle
      const mobileOptimizationsEnabled = e.data.optimized;
      
      if (mobileOptimizationsEnabled) {
        // Force enable the most effective methods for mobile
        speedConfig.setInterval = true;
        speedConfig.setTimeout = true;
        speedConfig.performance = true;
        speedConfig.dateNow = true;
        speedConfig.requestAnimationFrame = true;
        
        // Bump up the boost factor
        speedConfig.mobileBoostFactor = MOBILE_CONFIG.BOOST_FACTOR_MAX;
        
        // Recalculate speed with the boosted factor
        const userSelectedSpeed = speedConfig.speed / (speedConfig.mobileBoostFactor || 1);
        speedConfig.speed = userSelectedSpeed * speedConfig.mobileBoostFactor;
      }
      
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
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
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

      // Calculate optimized settings for mobile
      let effectiveSpeed = speed;
      if (isMobile && speed > 1) {
        const boostFactor = calculateMobileBoostFactor(speed);
        effectiveSpeed = speed * boostFactor;
        console.log(`Auto-speed mobile boost: ${speed}x → ${effectiveSpeed}x (${boostFactor}x boost)`);
      }

      // Apply speed settings with optimizations for mobile
      window.postMessage({
        action: "updateSettings",
        settings: {
          speed: effectiveSpeed,
          setInterval: true,
          setTimeout: true,
          performance: true,
          dateNow: true,
          requestAnimationFrame: isMobile, // Enable rAF on mobile for better animation control
          isMobile: isMobile
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