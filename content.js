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
    mobileBoostFactor: 1.0,
    // Developer mode settings
    developerMode: false,
    logTimingMethods: false,
    logPerformance: false,
    logFrameUpdates: false,
    logMobileOptimization: false
  };

  // Logger function
  const log = (type, ...args) => {
    if (!speedConfig.developerMode) return;
    
    const shouldLog = {
      timing: speedConfig.logTimingMethods,
      performance: speedConfig.logPerformance,
      frame: speedConfig.logFrameUpdates,
      mobile: speedConfig.logMobileOptimization
    }[type];

    if (shouldLog) {
      console.log(`[Speed Controller ${type}]`, ...args);
    }
  };

  // Enhanced Mobile-specific configurations
  const MOBILE_CONFIG = {
    UPDATE_INTERVAL: 16,
    BATCH_SIZE: 10,
    THROTTLE_THRESHOLD: 50,
    MIN_TIMEOUT: 8,
    PERFORMANCE_MODES: {
      LOW: { maxSpeed: 2, interval: 32 },
      MEDIUM: { maxSpeed: 4, interval: 24 },
      HIGH: { maxSpeed: 8, interval: 16 }
    }
  };

  // Improved mobile performance detection
  const detectMobilePerformance = () => {
    if (!speedConfig.isMobile) return 'HIGH';
    try {
      log('mobile', 'Detecting mobile performance...');
      const iterations = 50000;
      const samples = 3;
      let totalDuration = 0;

      for (let s = 0; s < samples; s++) {
        const start = performance.now();
        let count = 0;
        for (let i = 0; i < iterations; i++) count++;
        const duration = performance.now() - start;
        totalDuration += duration;
        log('mobile', `Performance sample ${s + 1}: ${duration.toFixed(2)}ms`);
      }

      const avgDuration = totalDuration / samples;
      let mode;
      
      if (avgDuration < 8) mode = 'HIGH';
      else if (avgDuration < 20) mode = 'MEDIUM';
      else mode = 'LOW';

      log('mobile', `Detected performance mode: ${mode} (avg duration: ${avgDuration.toFixed(2)}ms)`);
      return mode;
    } catch (e) {
      console.warn('Performance detection error:', e);
      log('mobile', 'Performance detection failed, defaulting to MEDIUM', e);
      return 'MEDIUM';
    }
  };

  const mobilePerformanceMode = detectMobilePerformance();

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
  let virtualClock = {
    start: originalPerformanceNow(),
    offset: 0,
    lastUpdate: originalPerformanceNow()
  };

  const updateVirtualClock = () => {
    const now = originalPerformanceNow();
    const realElapsed = now - virtualClock.lastUpdate;
    virtualClock.offset += realElapsed * (speedConfig.speed - 1);
    virtualClock.lastUpdate = now;
    log('performance', `Virtual clock updated: offset=${virtualClock.offset.toFixed(2)}ms`);
  };

  const getVirtualTime = () => {
    updateVirtualClock();
    return originalPerformanceNow() + virtualClock.offset;
  };

  const processBatch = () => {
    const currentTime = Date.now();
    if (speedConfig.isMobile) {
      const perfMode = MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode];
      const threshold = Math.max(perfMode.interval / 2, MOBILE_CONFIG.MIN_TIMEOUT);
      
      if (currentTime - lastBatchProcess < threshold) {
        log('mobile', `Skipping batch process due to threshold (${threshold}ms)`);
        return;
      }
    }
    lastBatchProcess = currentTime;

    const batchSize = speedConfig.isMobile ? MOBILE_CONFIG.BATCH_SIZE : timers.size;
    log('timing', `Processing batch of ${batchSize} timers`);
    
    let processed = 0;
    const timerEntries = Array.from(timers.entries());
    
    if (speedConfig.isMobile) {
      timerEntries.sort((a, b) => a[1].timeout - b[1].timeout);
      log('mobile', 'Sorted timers by priority');
    }

    for (const [id, timer] of timerEntries) {
      if (processed >= batchSize) break;

      if (timer.customTimerId) {
        log('timing', `Clearing existing timer ${timer.customTimerId}`);
        originalClearInterval(timer.customTimerId);
      }

      if (!timer.finished && speedConfig.speed > 0) {
        const adjustedTimeout = timer.timeout / speedConfig.speed;
        log('timing', `Adjusted timeout: ${timer.timeout}ms -> ${adjustedTimeout}ms (speed: ${speedConfig.speed}x)`);

        const effectiveTimeout = speedConfig.isMobile ?
          Math.max(adjustedTimeout, MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval) :
          adjustedTimeout;

        if (speedConfig.isMobile && effectiveTimeout < MOBILE_CONFIG.MIN_TIMEOUT * 2) {
          log('mobile', `Using RAF for fast interval (${effectiveTimeout}ms)`);
          const rafTimer = () => {
            timer.handler.apply(null, timer.args);
            if (!timer.finished) {
              timer.customTimerId = requestAnimationFrame(rafTimer);
            }
          };
          timer.customTimerId = requestAnimationFrame(rafTimer);
        } else {
          const newTimerId = originalSetInterval(
            timer.handler,
            effectiveTimeout,
            ...timer.args
          );
          log('timing', `Created new timer ${newTimerId} with timeout ${effectiveTimeout}ms`);
          timer.customTimerId = newTimerId;
        }
      } else {
        log('timing', `Removing finished timer ${id}`);
        timers.delete(id);
      }
      processed++;
    }
  };

  const reloadTimers = () => {
    log('timing', 'Reloading timers');
    if (speedConfig.isMobile) {
      while (timerBatch.length > 0) {
        clearTimeout(timerBatch.pop());
      }
      
      const interval = MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval;
      log('mobile', `Scheduling batch processing with interval ${interval}ms`);
      
      timerBatch.push(setTimeout(() => {
        processBatch();
        if (timers.size > 0) {
          reloadTimers();
        }
      }, interval));
    } else {
      processBatch();
    }
  };

  // Clear functions with improved cleanup
  window.clearInterval = (id) => {
    log('timing', `Clearing interval ${id}`);
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
    log('timing', `Clearing timeout ${id}`);
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
      log('timing', `SetInterval bypassed (speed = 0)`);
      return originalSetInterval(handler, timeout, ...args);
    }
    
    let adjustedTimeout = timeout;
    if (speedConfig.setInterval) {
      if (speedConfig.isMobile) {
        adjustedTimeout = Math.max(timeout / speedConfig.speed, MOBILE_CONFIG.MIN_TIMEOUT);
        log('mobile', `Adjusted interval for mobile: ${timeout}ms -> ${adjustedTimeout}ms`);
      } else {
        adjustedTimeout = timeout / speedConfig.speed;
        log('timing', `Adjusted interval: ${timeout}ms -> ${adjustedTimeout}ms`);
      }
    }
    
    const id = originalSetInterval(handler, adjustedTimeout, ...args);
    log('timing', `Created interval ${id} with timeout ${adjustedTimeout}ms`);
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
      log('timing', `SetTimeout bypassed (speed = 0)`);
      return originalSetTimeout(handler, timeout, ...args);
    }
    
    let adjustedTimeout = timeout;
    if (speedConfig.setTimeout) {
      if (speedConfig.isMobile) {
        adjustedTimeout = Math.max(timeout / speedConfig.speed, MOBILE_CONFIG.MIN_TIMEOUT);
        log('mobile', `Adjusted timeout for mobile: ${timeout}ms -> ${adjustedTimeout}ms`);
      } else {
        adjustedTimeout = timeout / speedConfig.speed;
        log('timing', `Adjusted timeout: ${timeout}ms -> ${adjustedTimeout}ms`);
      }
    }
    
    return originalSetTimeout(handler, adjustedTimeout, ...args);
  };

  // Enhanced Performance.now override with virtual clock
  (function() {
    window.performance.now = () => {
      const virtualTime = getVirtualTime();
      log('performance', `performance.now() -> ${virtualTime.toFixed(2)}ms`);
      return virtualTime;
    };
  })();

  // Date.now override with virtual clock
  (function() {
    let dateNowValue = null;
    let previousDateNowValue = null;
    let lastUpdateTime = 0;

    Date.now = () => {
      const currentTime = originalDateNow();
      if (speedConfig.speed === 0) return currentTime;

      const virtualTime = Math.floor(getVirtualTime() + Date.now() - performance.now());
      log('performance', `Date.now() -> ${virtualTime}`);
      return virtualTime;
    };
  })();

  // RequestAnimationFrame override with adaptive mobile optimizations
  (function() {
    const frameCallbacks = new Map();
    let lastFrameTime = performance.now();
    let frameCount = 0;

    window.requestAnimationFrame = (callback) => {
      return originalRequestAnimationFrame((timestamp) => {
        const now = performance.now();
        const virtualTimestamp = getVirtualTime();
        
        if (speedConfig.speed === 0) {
          log('frame', 'RAF bypassed (speed = 0)');
          callback(timestamp);
          return;
        }

        if (!frameCallbacks.has(callback)) {
          frameCallbacks.set(callback, {
            lastTime: now,
            frameCount: 0
          });
        }

        const state = frameCallbacks.get(callback);
        const deltaTime = now - state.lastTime;
        state.lastTime = now;

        if (speedConfig.requestAnimationFrame) {
          const targetFrameTime = speedConfig.isMobile ? 
            MOBILE_CONFIG.PERFORMANCE_MODES[mobilePerformanceMode].interval :
            16.67;

          state.frameCount++;
          const virtualFrameTime = virtualTimestamp + (state.frameCount * targetFrameTime);
          
          log('frame', `RAF callback: real=${now.toFixed(2)}ms, virtual=${virtualFrameTime.toFixed(2)}ms`);
          callback(virtualFrameTime);
          
          if (speedConfig.speed > 1) {
            window.requestAnimationFrame(callback);
          }
        } else {
          log('frame', 'RAF not accelerated');
          callback(timestamp);
        }
        
        frameCallbacks.delete(callback);
      });
    };
  })();

  // Message handling for config updates
  window.addEventListener("message", (e) => {
    if (e.data.action === "updateSettings") {
      const isMobile = speedConfig.isMobile;
      const oldSpeed = speedConfig.speed;
      
      speedConfig = {
        ...e.data.settings,
        isMobile,
        mobileBoostFactor: 1
      };

      log('timing', `Settings updated: speed ${oldSpeed}x -> ${speedConfig.speed}x`);
      if (speedConfig.isMobile) {
        log('mobile', 'Mobile optimizations:', speedConfig);
      }

      reloadTimers();
    } else if (e.data.action === "updateLoggingSettings") {
      const oldDeveloperMode = speedConfig.developerMode;
      
      speedConfig = {
        ...speedConfig,
        ...e.data.settings
      };

      if (speedConfig.developerMode !== oldDeveloperMode) {
        log('timing', `Developer mode ${speedConfig.developerMode ? 'enabled' : 'disabled'}`);
      }
    }
  });
}

// Inject script into page with error handling
try {
  const script = document.createElement("script");
  script.textContent = `(${pageScript.toString()})();`;
  document.documentElement.appendChild(script);
  script.remove();
} catch (error) {
  console.error('Error injecting speed controller script:', error);
}

// Handle messages from popup/background with improved error handling
browser.runtime.onMessage.addListener(async (message) => {
  try {
    if (message.action === "updateSettings") {
      if (!message.isAutoSpeed) {
        const { autoSpeedSites = {} } = await browser.storage.local.get('autoSpeedSites');
        const currentHost = window.location.hostname;
        if (currentHost in autoSpeedSites) {
          return;
        }
      }
      window.postMessage({
        action: "updateSettings",
        settings: message.settings
      }, "*");
    } else if (message.action === "checkAutoSpeed") {
      await checkAutoSpeedSite();
    } else if (message.action === "updateLoggingSettings") {
      window.postMessage({
        action: "updateLoggingSettings",
        settings: message.settings
      }, "*");
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
    const { 
      autoSpeedSites = {},
      developerMode = false,
      logTimingMethods = false,
      logPerformance = false,
      logFrameUpdates = false,
      logMobileOptimization = false
    } = await browser.storage.local.get([
      'autoSpeedSites',
      'developerMode',
      'logTimingMethods',
      'logPerformance',
      'logFrameUpdates',
      'logMobileOptimization'
    ]);
    
    // First update logging settings
    window.postMessage({
      action: "updateLoggingSettings",
      settings: {
        developerMode,
        logTimingMethods,
        logPerformance,
        logFrameUpdates,
        logMobileOptimization
      }
    }, "*");

    if (currentHost in autoSpeedSites) {
      const speed = autoSpeedSites[currentHost];
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      
      browser.runtime.sendMessage({
        action: 'showNotification',
        title: 'Auto-Speed Activated',
        message: `Speed set to ${speed}x for ${currentHost}`
      });

      browser.runtime.sendMessage({
        action: 'updateAutoSpeedStatus',
        status: {
          active: true,
          speed: speed,
          domain: currentHost
        }
      });

      window.postMessage({
        action: "updateSettings",
        settings: {
          speed: speed,
          setInterval: true,
          setTimeout: true,
          performance: true,
          dateNow: true,
          requestAnimationFrame: isMobile,
          isMobile: isMobile
        }
      }, "*");
    } else {
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