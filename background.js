// Utility: promisify selected chrome.* callbacks for MV3
function storageGet(defaults) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get(defaults, (items) => {
      if (chrome.runtime.lastError) return reject(new Error(`storageGet: ${chrome.runtime.lastError.message}`));
      resolve(items);
    });
  });
}

function dnrGetDynamicRules() {
  return new Promise((resolve, reject) => {
    try {
      chrome.declarativeNetRequest.getDynamicRules((rules) => {
        if (chrome.runtime.lastError) return reject(new Error(`getDynamicRules: ${chrome.runtime.lastError.message}`));
        resolve(rules || []);
      });
    } catch (e) {
      return reject(new Error(`getDynamicRules threw: ${e && e.message ? e.message : String(e)}`));
    }
  });
}

function dnrUpdateDynamicRules(options) {
  return new Promise((resolve, reject) => {
    chrome.declarativeNetRequest.updateDynamicRules(options, () => {
      if (chrome.runtime.lastError) return reject(new Error(`updateDynamicRules: ${chrome.runtime.lastError.message}`));
      resolve();
    });
  });
}

const REDIRECT_EXTENSION_PATH = "/redirect.html";

function wildcardToRegexForUrl(pattern) {
  // Treat the entire URL as a string; '*' expands to '.*', no special URL parsing
  const escaped = String(pattern)
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  // If the pattern does not end with '*' and does not already end with a slash,
  // allow an optional trailing slash to cover homepage URLs that include '/'
  const allowOptionalSlash = !/\*$/.test(String(pattern)) && !/\/$/.test(String(pattern));
  const suffix = allowOptionalSlash ? '\\/?' : '';
  return `^${escaped}${suffix}$`;
}

// Generate a stable numeric id per pattern (32-bit FNV-1a hash)
function ruleIdForPattern(pattern) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < pattern.length; i++) {
    hash ^= pattern.charCodeAt(i);
    hash = (hash >>> 0) * 0x01000193 >>> 0;
  }
  // Shift into a high range to avoid collisions with any low-numbered rules
  const base = 100000;
  const id = ((hash & 0x7fffffff) || 1) + base;
  // Clamp to 31-bit signed max if necessary
  return id > 0x7fffffff ? (id % 0x7fffffff) : id;
}

async function doRefreshDynamicRules() {
  const { patterns = [] } = await storageGet({ patterns: [] });

  const existingRules = await dnrGetDynamicRules();
  const removeRuleIds = existingRules.map((r) => r.id);

  const addRules = patterns.map((pattern) => ({
    id: ruleIdForPattern(pattern),
    priority: 1,
    action: {
      type: "redirect",
      redirect: { extensionPath: REDIRECT_EXTENSION_PATH }
    },
    condition: {
      regexFilter: wildcardToRegexForUrl(pattern),
      resourceTypes: ["main_frame"]
    }
  }));

  // Diagnostics to help identify duplicate IDs and call locations
  try {
    console.info("[Porsche Redirect] doRefreshDynamicRules", {
      patterns,
      addRuleIds: addRules.map(r => r.id),
      removeRuleIds,
      existingRuleIds: existingRules.map(r => r.id)
    });
  } catch (_) {}

  await dnrUpdateDynamicRules({ removeRuleIds, addRules });
}

// Simple serialization to avoid concurrent updates producing duplicate IDs
let refreshQueue = Promise.resolve();
function refreshDynamicRules() {
  refreshQueue = refreshQueue.then(() => doRefreshDynamicRules());
  return refreshQueue;
}

// Initialize default patterns and rules on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.sync.get({ patterns: ["*instagram.com/reels/*"] }, (items) => {
    chrome.storage.sync.set({ patterns: items.patterns }, () => {
      refreshDynamicRules().catch((e) => console.error("refreshDynamicRules(onInstalled) failed:", e));
    });
  });
});

// Ensure rules are set on startup
chrome.runtime.onStartup.addListener(() => {
  refreshDynamicRules().catch((e) => console.error("refreshDynamicRules(onStartup) failed:", e));
});

// React to pattern changes from options UI
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "sync" && changes.patterns) {
    refreshDynamicRules().catch((e) => console.error("refreshDynamicRules(onChanged) failed:", e));
  }
});


