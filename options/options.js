// Get DOM elements
const websitesList = document.getElementById('websitesList');
const domainInput = document.getElementById('domainInput');
const quickAddPresets = document.getElementById('quickAddPresets');
const speedStepsList = document.getElementById('speedStepsList');
const presetButtonsList = document.getElementById('presetButtonsList');
const newSpeedStep = document.getElementById('newSpeedStep');
const presetLabel = document.getElementById('presetLabel');
const presetSpeed = document.getElementById('presetSpeed');
const addSpeedStep = document.getElementById('addSpeedStep');
const addPreset = document.getElementById('addPreset');
const saveButton = document.getElementById('saveButton');
const resetButton = document.getElementById('resetButton');
const saveStatus = document.getElementById('saveStatus');

// Default settings
const DEFAULT_SPEED_STEPS = [2, 5, 10, 20, 50];
const DEFAULT_PRESETS = [
  { label: 'Normal', speed: 1 },
  { label: 'Fast', speed: 5 },
  { label: 'Very Fast', speed: 20 },
  { label: 'Ultra Fast', speed: 50 }
];

// Load saved settings when page opens
document.addEventListener('DOMContentLoaded', async () => {
  // Load speed steps and presets
  const { 
    speedSteps = DEFAULT_SPEED_STEPS,
    presetButtons = DEFAULT_PRESETS,
    autoSpeedSites = {}
  } = await browser.storage.local.get(['speedSteps', 'presetButtons', 'autoSpeedSites']);
  
  renderSpeedSteps(speedSteps);
  renderPresetButtons(presetButtons);
  renderQuickAddPresets(presetButtons);

  // Load website list
  const sitesList = Object.entries(autoSpeedSites)
    .map(([site, speed]) => `${site}:${speed}`)
    .join('\n');
  websitesList.value = sitesList;
});

// Render speed steps
function renderSpeedSteps(steps) {
  speedStepsList.innerHTML = steps
    .map(step => `
      <div class="speed-step">
        <span>${step}x</span>
        <button data-speed="${step}" title="Remove speed step">✕</button>
      </div>
    `).join('');

  // Add click handlers for remove buttons
  speedStepsList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', async () => {
      const speedToRemove = parseFloat(btn.dataset.speed);
      const { speedSteps = DEFAULT_SPEED_STEPS } = await browser.storage.local.get('speedSteps');
      const newSteps = speedSteps.filter(s => s !== speedToRemove).sort((a, b) => a - b);
      
      await browser.storage.local.set({ speedSteps: newSteps });
      renderSpeedSteps(newSteps);
      showStatus('Speed step removed successfully!');
    });
  });
}

// Render preset buttons in options
function renderPresetButtons(presets) {
  presetButtonsList.innerHTML = presets
    .map(preset => `
      <div class="preset-button-item" data-label="${preset.label}" data-speed="${preset.speed}">
        <span>${preset.label} (${preset.speed}x)</span>
        <div class="button-actions">
          <button class="edit-btn" title="Edit preset">✎</button>
          <button class="delete-btn" title="Remove preset">✕</button>
        </div>
        <div class="edit-controls">
          <div class="edit-inputs">
            <input type="text" class="edit-label" value="${preset.label}" placeholder="Button label">
            <input type="number" class="edit-speed" value="${preset.speed}" placeholder="Speed value">
          </div>
          <div class="edit-actions">
            <button class="save-edit">Save</button>
            <button class="cancel-edit">Cancel</button>
          </div>
        </div>
      </div>
    `).join('');

  // Add event handlers
  presetButtonsList.querySelectorAll('.preset-button-item').forEach(item => {
    const editBtn = item.querySelector('.edit-btn');
    const deleteBtn = item.querySelector('.delete-btn');
    const saveEditBtn = item.querySelector('.save-edit');
    const cancelEditBtn = item.querySelector('.cancel-edit');

    editBtn.addEventListener('click', () => {
      item.classList.add('editing');
    });

    cancelEditBtn.addEventListener('click', () => {
      item.classList.remove('editing');
    });

    saveEditBtn.addEventListener('click', async () => {
      const newLabel = item.querySelector('.edit-label').value.trim();
      const newSpeed = parseFloat(item.querySelector('.edit-speed').value);

      if (!newLabel) {
        showStatus('Preset label is required', true);
        return;
      }

      if (isNaN(newSpeed) || newSpeed < 0) {
        showStatus('Invalid speed value', true);
        return;
      }

      if (newSpeed > 500) {
        showStatus('Speed cannot exceed 500x', true);
        return;
      }

      const { presetButtons = DEFAULT_PRESETS } = await browser.storage.local.get('presetButtons');
      const oldLabel = item.dataset.label;
      const updatedPresets = presetButtons.map(p => 
        p.label === oldLabel ? { label: newLabel, speed: newSpeed } : p
      );

      await browser.storage.local.set({ presetButtons: updatedPresets });
      renderPresetButtons(updatedPresets);
      renderQuickAddPresets(updatedPresets);
      showStatus('Preset updated successfully!');
    });

    deleteBtn.addEventListener('click', async () => {
      const { presetButtons = DEFAULT_PRESETS } = await browser.storage.local.get('presetButtons');
      const labelToRemove = item.dataset.label;
      const updatedPresets = presetButtons.filter(p => p.label !== labelToRemove);

      await browser.storage.local.set({ presetButtons: updatedPresets });
      renderPresetButtons(updatedPresets);
      renderQuickAddPresets(updatedPresets);
      showStatus('Preset removed successfully!');
    });
  });
}

// Render quick add presets
function renderQuickAddPresets(presets) {
  quickAddPresets.innerHTML = presets
    .map(preset => `<button data-speed="${preset.speed}">${preset.label} (${preset.speed}x)</button>`)
    .join('');

  // Add click handlers for preset buttons
  quickAddPresets.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const domain = domainInput.value.trim();
      const speed = btn.dataset.speed;

      if (!domain) {
        showStatus('Please enter a domain first', true);
        return;
      }

      if (!isValidDomain(domain)) {
        showStatus(`Invalid domain: ${domain}`, true);
        return;
      }

      const currentList = websitesList.value.trim();
      const newEntry = `${domain}:${speed}`;
      websitesList.value = currentList ? `${currentList}\n${newEntry}` : newEntry;
      domainInput.value = '';

      // Visual feedback
      btn.style.transform = 'scale(0.95)';
      setTimeout(() => {
        btn.style.transform = 'scale(1)';
      }, 100);
    });
  });
}

// Add new speed step
addSpeedStep.addEventListener('click', async () => {
  const newSpeed = parseFloat(newSpeedStep.value);
  
  if (isNaN(newSpeed) || newSpeed < 1) {
    showStatus('Please enter a valid speed (minimum 1)', true);
    return;
  }

  if (newSpeed > 500) {
    showStatus('Speed cannot exceed 500x', true);
    return;
  }

  const { speedSteps = DEFAULT_SPEED_STEPS } = await browser.storage.local.get('speedSteps');
  
  if (speedSteps.includes(newSpeed)) {
    showStatus('This speed step already exists', true);
    return;
  }

  const newSteps = [...speedSteps, newSpeed].sort((a, b) => a - b);
  await browser.storage.local.set({ speedSteps: newSteps });
  
  renderSpeedSteps(newSteps);
  newSpeedStep.value = '';
  showStatus('New speed step added successfully!');
});

// Add new preset button
addPreset.addEventListener('click', async () => {
  const label = presetLabel.value.trim();
  const speed = parseFloat(presetSpeed.value);

  if (!label) {
    showStatus('Preset label is required', true);
    return;
  }

  if (isNaN(speed) || speed < 0) {
    showStatus('Invalid speed value', true);
    return;
  }

  if (speed > 500) {
    showStatus('Speed cannot exceed 500x', true);
    return;
  }

  const { presetButtons = DEFAULT_PRESETS } = await browser.storage.local.get('presetButtons');
  
  if (presetButtons.some(p => p.label === label)) {
    showStatus('A preset with this label already exists', true);
    return;
  }

  const newPresets = [...presetButtons, { label, speed }];
  await browser.storage.local.set({ presetButtons: newPresets });
  
  renderPresetButtons(newPresets);
  renderQuickAddPresets(newPresets);
  presetLabel.value = '';
  presetSpeed.value = '';
  showStatus('New preset added successfully!');
});

// Show status message
function showStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.className = 'status-message show ' + (isError ? 'error' : 'success');
  
  setTimeout(() => {
    saveStatus.className = 'status-message';
  }, 3000);
}

// Validate domain
function isValidDomain(domain) {
  try {
    new URL(`http://${domain}`);
    return true;
  } catch {
    return false;
  }
}

// Parse websites list
function parseWebsitesList(text) {
  const sites = {};
  const errors = [];

  text.split('\n')
    .map(line => line.trim())
    .filter(line => line !== '')
    .forEach(line => {
      const parts = line.split(':');
      const domain = parts[0]?.trim();
      const speed = parts[1]?.trim();

      // Require both domain and speed
      if (!domain || !speed) {
        errors.push(`Invalid format (domain:speed required): ${line}`);
        return;
      }

      if (!isValidDomain(domain)) {
        errors.push(`Invalid domain: ${domain}`);
        return;
      }

      const speedNum = parseFloat(speed);
      if (isNaN(speedNum)) {
        errors.push(`Invalid speed value for ${domain}: ${speed}`);
        return;
      }

      if (speedNum < 0) {
        errors.push(`Speed cannot be negative for ${domain}: ${speed}`);
        return;
      }

      if (speedNum > 500) {
        errors.push(`Speed cannot exceed 500x for ${domain}: ${speed}`);
        return;
      }

      sites[domain] = speedNum;
    });

  return { sites, errors };
}

// Save button click handler
saveButton.addEventListener('click', async () => {
  try {
    const { sites, errors } = parseWebsitesList(websitesList.value);

    if (errors.length > 0) {
      showStatus(`Errors found:\n${errors.join('\n')}`, true);
      return;
    }

    // Save to storage
    await browser.storage.local.set({ autoSpeedSites: sites });
    
    // Show success message
    showStatus('Settings saved successfully!');

    // Notify all tabs to check if they should apply auto-speed
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        await browser.tabs.sendMessage(tab.id, { action: 'checkAutoSpeed' });
      } catch (e) {
        // Ignore errors for tabs that don't have our content script
      }
    }
  } catch (error) {
    showStatus('Error saving settings: ' + error.message, true);
  }
});

// Reset button click handler
resetButton.addEventListener('click', async () => {
  try {
    // Reset to defaults
    await browser.storage.local.set({
      speedSteps: DEFAULT_SPEED_STEPS,
      presetButtons: DEFAULT_PRESETS,
      autoSpeedSites: {}
    });
    
    // Clear inputs
    websitesList.value = '';
    domainInput.value = '';
    newSpeedStep.value = '';
    presetLabel.value = '';
    presetSpeed.value = '';
    
    // Update UI
    renderSpeedSteps(DEFAULT_SPEED_STEPS);
    renderPresetButtons(DEFAULT_PRESETS);
    renderQuickAddPresets(DEFAULT_PRESETS);
    
    // Show success message
    showStatus('Settings reset successfully!');

    // Notify all tabs
    const tabs = await browser.tabs.query({});
    for (const tab of tabs) {
      try {
        await browser.tabs.sendMessage(tab.id, { action: 'checkAutoSpeed' });
      } catch (e) {
        // Ignore errors for tabs that don't have our content script
      }
    }
  } catch (error) {
    showStatus('Error resetting settings: ' + error.message, true);
  }
});