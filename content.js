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
        console.error('[Porsche Redirect][content] checkUrl failed:', e);
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
        chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
          if (chrome.runtime && chrome.runtime.lastError) {
            const msg = chrome.runtime.lastError.message || '';
            if (/Extension context invalidated/i.test(msg)) return resolve(false);
            return reject(new Error(`content shouldRedirect storage: ${msg}`));
          }
          const urlString = String(url);
          const matches = (patterns || []).some((p) => {
            const re = wildcardToRegex(p);
            return re.test(urlString);
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
})();


