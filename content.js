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
    mobileBoostFactor: 1.0
  };

  // Enhanced Mobile-specific configurations
  const MOBILE_CONFIG = {
    UPDATE_INTERVAL: 16,
    BATCH_SIZE: 10,
    THROTTLE_THRESHOLD: 50,
    MIN_TIMEOUT: 5,
    PERFORMANCE_MODES: {
      LOW: { maxSpeed: 2, interval: 32 },
      MEDIUM: { maxSpeed: 4, interval: 24 },
      HIGH: { maxSpeed: 8, interval: 16 }
    },
    SPEED_SCALING: {
      thresholds: [1, 2, 4, 8, 16],
      factors: [1, 1.1, 1.25, 1.5, 1.75, 2]
    }
  };

  // Improved mobile performance detection
  const detectMobilePerformance = () => {
    if (!speedConfig.isMobile) return 'HIGH';
    try {
      const start = performance.now();
      let count = 0;
      for (let i = 0; i < 10000; i++) count++;
      const duration = performance.now() - start;
      if (duration < 5) return 'HIGH';
      if (duration < 15) return 'MEDIUM';
      return 'LOW';
    } catch (e) {
      return 'MEDIUM';
    }
  };

  const mobilePerformanceMode = detectMobilePerformance();

  // Add a function to calculate appropriate mobile boost factor based on the requested speed
  function calculateMobileBoostFactor(requestedSpeed) {
    if (!speedConfig.isMobile || requestedSpeed <= 1) return 1;
    
    for (const { threshold, factor } of MOBILE_CONFIG.SPEED_SCALING.thresholds.map((threshold, index) => ({ threshold, factor: MOBILE_CONFIG.SPEED_SCALING.factors[index] }))) {
      if (requestedSpeed <= threshold) return factor;
    }
    return MOBILE_CONFIG.SPEED_SCALING.factors[MOBILE_CONFIG.SPEED_SCALING.factors.length - 1];
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

  // Timer management with improved mobile handling
  const timers = new Map();
  let lastBatchProcess = 0;
  let timerBatch = [];

  const processBatch = () => {
    const currentTime = Date.now();
    if (speedConfig.isMobile) {
      const threshold = MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval;
      if (currentTime - lastBatchProcess < threshold) {
        return;
      }
    }
    lastBatchProcess = currentTime;

    const batchSize = speedConfig.isMobile ? MOBILE_CONFIG.BATCH_SIZE : timers.size;
    let processed = 0;

    for (const [id, timer] of timers.entries()) {
      if (processed >= batchSize) break;

      if (timer.customTimerId) {
        originalClearInterval(timer.customTimerId);
      }

      if (!timer.finished && speedConfig.speed > 0) {
        const effectiveSpeed = speedConfig.speed * (speedConfig.isMobile ? calculateMobileBoostFactor(speedConfig.speed) : 1);
        const adjustedTimeout = timer.timeout / effectiveSpeed;

        // Use performance mode specific intervals for mobile
        const effectiveTimeout = speedConfig.isMobile ?
          Math.max(adjustedTimeout, MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval) :
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
      const threshold = MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval;
      if (timerBatch.length === 0) {
        timerBatch.push(setTimeout(processBatch, threshold));
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
        adjustedTimeout = Math.max(timeout / speedConfig.speed, MOBILE_CONFIG.MIN_TIMEOUT);
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
        adjustedTimeout = Math.max(timeout / speedConfig.speed, MOBILE_CONFIG.MIN_TIMEOUT);
      } else {
        adjustedTimeout = timeout / speedConfig.speed;
      }
    }
    
    return originalSetTimeout(handler, adjustedTimeout, ...args);
  };

  // Enhanced Performance.now override
  (function() {
    let performanceNowValue = null;
    let previousPerformanceNowValue = null;
    let lastUpdateTime = 0;
    let lastRealTime = originalPerformanceNow();
    let timeAccumulator = 0;

    window.performance.now = () => {
      const currentTime = originalPerformanceNow();
      if (speedConfig.speed === 0) return currentTime;

      const effectiveSpeed = speedConfig.speed * (speedConfig.isMobile ? calculateMobileBoostFactor(speedConfig.speed) : 1);
      const deltaTime = currentTime - lastRealTime;
      lastRealTime = currentTime;
      
      // Accumulate time with speed factor
      timeAccumulator += deltaTime * effectiveSpeed;
      
      // Update less frequently on mobile for better performance
      const updateThreshold = speedConfig.isMobile ? 
        MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval : 
        16;
        
      if (currentTime - lastUpdateTime >= updateThreshold) {
        lastUpdateTime = currentTime;
        previousPerformanceNowValue = performanceNowValue;
        performanceNowValue = timeAccumulator;
      }
      
      return performanceNowValue || currentTime;
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
        speedConfig.mobileBoostFactor = MOBILE_CONFIG.SPEED_SCALING.factors[MOBILE_CONFIG.SPEED_SCALING.factors.length - 1];
        
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