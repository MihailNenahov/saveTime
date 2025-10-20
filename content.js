(function() {
  // Debounced check on URL changes to handle SPA navigations (pushState/replaceState, hash, popstate)
  let lastUrl = location.href;

  function checkUrlAndMaybeRedirect(force) {
    const current = location.href;
    if (!force && current === lastUrl) return;
    lastUrl = current;
    shouldRedirect(current).then((should) => {
      if (should) {
        // Redirect main frame by replacing location to extension page
        location.replace(chrome.runtime.getURL('redirect.html'));
      }
    }).catch((e) => {
      // Surface errors for debugging
      console.error('[Porsche Redirect][content] checkUrl failed:', e);
    });
  }

  // Observe history API and hash changes
  const origPushState = history.pushState;
  const origReplaceState = history.replaceState;
  history.pushState = function() { origPushState.apply(this, arguments); setTimeout(() => checkUrlAndMaybeRedirect(false), 0); };
  history.replaceState = function() { origReplaceState.apply(this, arguments); setTimeout(() => checkUrlAndMaybeRedirect(false), 0); };
  window.addEventListener('popstate', () => checkUrlAndMaybeRedirect(false));
  window.addEventListener('hashchange', () => checkUrlAndMaybeRedirect(false));

  // Initial check on load
  document.addEventListener('DOMContentLoaded', () => checkUrlAndMaybeRedirect(true));
  checkUrlAndMaybeRedirect(true);
  // Fallback poll every 3 seconds to catch SPA navigations we missed
  setInterval(() => checkUrlAndMaybeRedirect(true), 3000);

  function wildcardToRegex(pattern) {
    const escaped = String(pattern)
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*");
    return new RegExp(`^${escaped}$`);
  }

  function shouldRedirect(url) {
    return new Promise((resolve, reject) => {
      chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
        if (chrome.runtime.lastError) return reject(new Error(`content shouldRedirect storage: ${chrome.runtime.lastError.message}`));
        const u = new URL(url);
        const urlNoScheme = `${u.host}${u.pathname}${u.search}${u.hash}`;
        const matches = (patterns || []).some((p) => {
          // Allow user patterns like *instagram.com/reels/* to match host+path ignoring scheme
          const re = wildcardToRegex(p.replace(/^\*?https?:\/\//, ''));
          return re.test(urlNoScheme);
        });
        resolve(matches);
      });
    });
  }
})();


