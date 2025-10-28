(function() {

  function isExtensionActive() {
    return typeof chrome !== 'undefined' && chrome && chrome.runtime && typeof chrome.runtime.id === 'string' && chrome.runtime.id.length > 0;
  }

  function checkUrlAndMaybeRedirect(force) {
    const current = location.href;
    shouldRedirect(current).then((should) => {
      if (should) {
        // Redirect main frame by replacing location to extension page
        if (isExtensionActive()) {
          try {
            const url = chrome.runtime.getURL('redirect.html');
            location.replace(url);
          } catch (_) {
            // ignore if context is mid-teardown
          }
        }
      }
    }).catch((e) => {
      // Ignore expected teardown noise when Chrome invalidates the context
      const msg = e && (e.message || String(e));
      if (msg && /Extension context invalidated/i.test(msg)) return;
      if (isExtensionActive()) {
        console.error('[Enki][content] checkUrl failed:', e);
      }
    });
  }

  // Observe history API and hash changes
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function() { origPushState.apply(this, arguments); setTimeout(checkUrlAndMaybeRedirect, 0); };
  history.replaceState = function() { origReplaceState.apply(this, arguments); setTimeout(checkUrlAndMaybeRedirect, 0); };
  window.addEventListener('popstate', checkUrlAndMaybeRedirect);
  window.addEventListener('hashchange', checkUrlAndMaybeRedirect);

  // Initial check on load
  document.addEventListener('DOMContentLoaded', () => checkUrlAndMaybeRedirect(true));
  checkUrlAndMaybeRedirect(true);
  // Fallback: poll periodically to catch any missed route changes
  const pollId = setInterval(() => checkUrlAndMaybeRedirect(true), 3000);
  // Stop polling on pagehide/unload to avoid running during teardown
  const stopPolling = () => { try { clearInterval(pollId); } catch (_) {} };
  window.addEventListener('pagehide', stopPolling);
  window.addEventListener('beforeunload', stopPolling);

  function wildcardToRegex(pattern) {
    // Treat the whole URL as a string; '*' expands to '.*'
    const raw = String(pattern);
    const escaped = raw
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    const allowOptionalSlash = !/\*$/.test(raw) && !/\/$/.test(raw);
    const suffix = allowOptionalSlash ? '\\/?' : '';
    return new RegExp(`^${escaped}${suffix}$`);
  }

  function shouldRedirect(url) {
    return new Promise((resolve, reject) => {
      if (!isExtensionActive()) return resolve(false);
      try {
        if (!chrome.storage || !chrome.storage.sync || typeof chrome.storage.sync.get !== 'function') {
          return resolve(false);
        }
        chrome.storage.sync.get({ patterns: [], filters: [] }, ({ patterns, filters }) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (/Extension context invalidated/i.test(msg)) return resolve(false);
            return reject(new Error(`content shouldRedirect storage: ${msg}`));
          }
          const urlString = String(url);
          const urlNoQuery = urlString.split('?')[0];
          const urlNoHash = urlString.split('#')[0];
          const all = ([]).concat(patterns || [], filters || []);
          const matches = all.some((p) => {
            const re = wildcardToRegex(p);
            return re.test(urlString) || re.test(urlNoQuery) || re.test(urlNoHash);
          });
          resolve(matches);
        });
      } catch (e) {
        const msg = e && (e.message || String(e));
        if (/Extension context invalidated/i.test(msg)) return resolve(false);
        reject(e);
      }
    });
  }

  // Instagram: remove sidebar items (Home 1st, Explore 3rd, Reels 4th) after load
  function isInstagramHost() {
    try {
      const host = String(location.hostname || '');
      return /(^|\.)instagram\.com$/i.test(host);
    } catch (_) {
      return false;
    }
  }

  function findInstagramMenuContainer() {
    const nodes = document.querySelectorAll('.x1iyjqo2.xh8yej3');
    if (!nodes || nodes.length === 0) return null;
    const candidates = Array.from(nodes);
    // Prefer node that is not inside a dialog and contains expected menu links
    const linkSelector = 'a[href="/"], a[href="/explore/"], a[href="/reels/"]';
    const filtered = candidates.filter((el) => {
      if (el.closest('[role="dialog"], [aria-modal="true"]')) return false;
      if (!el.querySelector(linkSelector)) return false;
      // Prefer elements within navigation/aside regions
      const region = el.closest('nav[role="navigation"], aside, nav');
      return !!region;
    });
    if (filtered.length > 0) return filtered[0];
    // Fallback: any candidate with menu-like links and not inside dialog
    return candidates.find((el) => !el.closest('[role="dialog"], [aria-modal="true"]') && el.querySelector(linkSelector)) || null;
  }

  let igSettings = { igHideHome: true, igHideExplore: true, igHideReels: true };

  function getIgSettings() {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.sync || typeof chrome.storage.sync.get !== 'function') {
          return resolve({ igHideHome: true, igHideExplore: true, igHideReels: true });
        }
        chrome.storage.sync.get({ igHideHome: true, igHideExplore: true, igHideReels: true }, (v) => {
          const cfg = { igHideHome: Boolean(v.igHideHome), igHideExplore: Boolean(v.igHideExplore), igHideReels: Boolean(v.igHideReels) };
          igSettings = cfg;
          resolve(cfg);
        });
      } catch (_) {
        resolve({ igHideHome: true, igHideExplore: true, igHideReels: true });
      }
    });
  }

  function removeInstagramSidebarItemsOnce(cfg) {
    if (!isInstagramHost()) return false;
    try {
      const settings = cfg || igSettings || {};
      const anyEnabled = Boolean(settings.igHideHome || settings.igHideExplore || settings.igHideReels);
      if (!anyEnabled) return true; // nothing to remove
      const container = findInstagramMenuContainer();
      if (!container) return false;
      const children = Array.from(container.children);
      if (children.length < 1) return false;
      const toRemove = [];
      if (settings.igHideHome && children[0]) toRemove.push(0);
      if (settings.igHideExplore && children[2]) toRemove.push(2);
      if (settings.igHideReels && children[3]) toRemove.push(3);
      toRemove.sort((a, b) => b - a).forEach((idx) => {
        const node = children[idx];
        if (node && node.parentNode) node.parentNode.removeChild(node);
      });
      return true;
    } catch (_) {
      return false;
    }
  }

  window.addEventListener('load', () => {
    if (!isInstagramHost()) return;
    getIgSettings().then((cfg) => {
      let attempts = 0;
      const maxAttempts = 15;
      const intervalId = setInterval(() => {
        attempts += 1;
        const done = removeInstagramSidebarItemsOnce(cfg);
        if (done || attempts >= maxAttempts) {
          try { clearInterval(intervalId); } catch (_) {}
        }
      }, 300);

      try {
        if (chrome && chrome.storage && chrome.storage.onChanged) {
          chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'sync') return;
            let changed = false;
            if (Object.prototype.hasOwnProperty.call(changes, 'igHideHome')) { igSettings.igHideHome = Boolean(changes.igHideHome.newValue); changed = true; }
            if (Object.prototype.hasOwnProperty.call(changes, 'igHideExplore')) { igSettings.igHideExplore = Boolean(changes.igHideExplore.newValue); changed = true; }
            if (Object.prototype.hasOwnProperty.call(changes, 'igHideReels')) { igSettings.igHideReels = Boolean(changes.igHideReels.newValue); changed = true; }
            if (changed) { try { removeInstagramSidebarItemsOnce(igSettings); } catch (_) {} }
          });
        }
      } catch (_) {}
    });
  });
})();


