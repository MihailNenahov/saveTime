(function () {
  const ENABLE_KEY = 'hideYouTubeShorts';

  function isEnabled() {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.sync || typeof chrome.storage.sync.get !== 'function') {
          return resolve(true);
        }
        chrome.storage.sync.get({ [ENABLE_KEY]: true }, (v) => resolve(Boolean(v[ENABLE_KEY])));
      } catch (_) {
        resolve(true);
      }
    });
  }

  function injectCss() {
    const css = `
ytd-reel-shelf-renderer,
ytd-rich-shelf-renderer[is-shorts],
ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
ytd-item-section-renderer:has(ytd-reel-shelf-renderer),
ytd-compact-video-renderer:has(a[href^="/shorts/"]),
ytd-rich-item-renderer:has(a[href^="/shorts/"]),
ytd-guide-entry-renderer:has(a[href*="/shorts"]),
ytd-mini-guide-entry-renderer:has(a[href*="/shorts"]) {
  display: none !important;
}

/* Search page and modern view-model shelves */
grid-shelf-view-model:has(a[href^="/shorts/"]) {
  display: none !important;
}
ytm-shorts-lockup-view-model-v2,
ytm-shorts-lockup-view-model {
  display: none !important;
}`;
    try {
      const style = document.createElement('style');
      style.setAttribute('data-hide-shorts', '1');
      style.textContent = css;
      document.documentElement.appendChild(style);
    } catch (_) {}
  }

  function removeShortsNow() {
    const selectors = [
      'ytd-reel-shelf-renderer',
      'ytd-rich-shelf-renderer[is-shorts]',
      'ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts])',
      'ytd-item-section-renderer:has(ytd-reel-shelf-renderer)',
      'ytd-rich-item-renderer:has(a[href^="/shorts/"])',
      'ytd-compact-video-renderer:has(a[href^="/shorts/"])',
      'ytd-guide-entry-renderer:has(a[href*="/shorts"])',
      'ytd-mini-guide-entry-renderer:has(a[href*="/shorts"])',
      // Search and newer shelf containers
      'grid-shelf-view-model:has(a[href^="/shorts/"])',
      'ytm-shorts-lockup-view-model-v2',
      'ytm-shorts-lockup-view-model'
    ];
    try {
      selectors.forEach((sel) => {
        document.querySelectorAll(sel).forEach((el) => {
          if (typeof el.remove === 'function') el.remove();
          else el.style.display = 'none';
        });
      });
    } catch (_) {}

    // Anchor-based container removal as a fallback on search:
    try {
      document.querySelectorAll('a[href^="/shorts/"]').forEach((a) => {
        let node = a;
        for (let i = 0; i < 25 && node && node !== document.body; i++) {
          if (node.tagName && (
            node.tagName.toLowerCase() === 'grid-shelf-view-model' ||
            node.tagName.toLowerCase() === 'ytd-rich-section-renderer' ||
            node.tagName.toLowerCase() === 'ytd-item-section-renderer' ||
            node.tagName.toLowerCase() === 'ytd-rich-shelf-renderer'
          )) {
            if (typeof node.remove === 'function') node.remove();
            else node.style.display = 'none';
            break;
          }
          node = node.parentElement;
        }
      });
    } catch (_) {}

    // Deep scan including shadow roots; also remove shelves titled "Shorts"
    try { deepScanShortsShelves(); } catch (_) {}
  }

  function deepScanShortsShelves() {
    const stack = [document.documentElement];
    let steps = 0;
    const MAX = 6000;
    while (stack.length) {
      const node = stack.pop();
      if (!node) continue;
      if (++steps > MAX) break;

      // push children
      const kids = node.children;
      if (kids && kids.length) {
        for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i]);
      }
      // traverse shadow root
      const sr = node.shadowRoot;
      if (sr) stack.push(sr);

      // If this node is a Shorts shelf container by title text, remove it
      if (node.tagName && node.tagName.toLowerCase() === 'grid-shelf-view-model') {
        try {
          // search for a header h2 with text 'Shorts'
          const header = (node.querySelector && node.querySelector('h2')) || null;
          const label = header && (header.textContent || '').trim();
          if (label && label.toLowerCase() === 'shorts') {
            if (typeof node.remove === 'function') node.remove(); else node.style.display = 'none';
            continue;
          }
        } catch (_) {}
      }

      // If we see a /shorts/ link, remove its containing shelf
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (href.startsWith('/shorts/')) {
          removeContainingShelf(node);
        }
      }
    }
  }

  function removeContainingShelf(start) {
    let cur = start;
    for (let i = 0; i < 30 && cur; i++) {
      if (cur.tagName) {
        const tag = cur.tagName.toLowerCase();
        if (tag === 'grid-shelf-view-model' || tag === 'ytd-item-section-renderer' || tag === 'ytd-rich-section-renderer' || tag === 'ytd-rich-shelf-renderer') {
          try { if (typeof cur.remove === 'function') cur.remove(); else cur.style.display = 'none'; } catch (_) {}
          return true;
        }
      }
      if (cur.parentElement) { cur = cur.parentElement; continue; }
      const rn = cur.getRootNode && cur.getRootNode();
      if (rn && rn.host) { cur = rn.host; continue; }
      break;
    }
    return false;
  }

  function installClickRewrite() {
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (!target || typeof target.closest !== 'function') return;
      const a = target.closest('a[href^="/shorts/"]');
      if (!a) return;
      try {
        const pathname = a.pathname || '';
        const parts = pathname.split('/').filter(Boolean);
        const id = parts[1];
        if (!id) return;
        e.preventDefault();
        e.stopPropagation();
        const next = `/watch?v=${encodeURIComponent(id)}`;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) {
          window.open(next, '_blank', 'noopener,noreferrer');
        } else {
          location.assign(next);
        }
      } catch (_) {}
    }, true);
  }

  function redirectIfOnShorts() {
    try {
      if ((location.pathname || '').startsWith('/shorts/')) {
        const parts = location.pathname.split('/').filter(Boolean);
        const id = parts[1];
        if (id) location.replace(`/watch?v=${encodeURIComponent(id)}`);
        else location.replace('/');
      }
    } catch (_) {}
  }

  function observeSpaChanges() {
    const root = document.documentElement;
    let scheduled = false;
    const schedule = () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(() => {
        scheduled = false;
        removeShortsNow();
      });
    };
    try {
      const mo = new MutationObserver(schedule);
      mo.observe(root, { subtree: true, childList: true });
    } catch (_) {}
    window.addEventListener('yt-navigate-finish', schedule, true);
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    const id = setInterval(removeShortsNow, 3000);
    window.addEventListener('pagehide', () => { try { clearInterval(id); } catch (_) {} });
  }

  isEnabled().then((enabled) => {
    if (!enabled) return;
    injectCss();
    redirectIfOnShorts();
    installClickRewrite();
    removeShortsNow();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', removeShortsNow);
    }
    observeSpaChanges();
  });
})();


