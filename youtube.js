(function () {
  const SHORTS_KEY = 'hideYouTubeShorts';
  const RECS_KEY = 'hideYouTubeRecommendations';

  let settings = { [SHORTS_KEY]: true, [RECS_KEY]: false };

  function getSettings() {
    return new Promise((resolve) => {
      try {
        if (!chrome || !chrome.storage || !chrome.storage.sync || typeof chrome.storage.sync.get !== 'function') {
          return resolve({ [SHORTS_KEY]: true, [RECS_KEY]: false });
        }
        chrome.storage.sync.get({ [SHORTS_KEY]: true, [RECS_KEY]: false }, (v) => {
          const next = { [SHORTS_KEY]: Boolean(v[SHORTS_KEY]), [RECS_KEY]: Boolean(v[RECS_KEY]) };
          settings = next;
          resolve(next);
        });
      } catch (_) {
        resolve({ [SHORTS_KEY]: true, [RECS_KEY]: false });
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

/* Explicitly target menu entries with title="Shorts" */
ytd-guide-entry-renderer:has(a#endpoint[title="Shorts"]) {
  display: none !important;
}
ytd-mini-guide-entry-renderer:has(a[title="Shorts"]) {
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
      // Avoid removing entire sections; only remove the shelf nodes themselves
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

    // Remove left-menu 'Shorts' entries by label text as a fallback
    try {
      document.querySelectorAll('ytd-guide-entry-renderer, ytd-mini-guide-entry-renderer').forEach((entry) => {
        const title = entry.querySelector && entry.querySelector('.title');
        const text = title && (title.textContent || '').trim().toLowerCase();
        if (text === 'shorts') {
          if (typeof entry.remove === 'function') entry.remove();
          else entry.style.display = 'none';
        }
      });
    } catch (_) {}

    // Anchor-based container removal as a fallback on search:
    try {
      document.querySelectorAll('a[href^="/shorts/"]').forEach((a) => {
        let node = a;
        for (let i = 0; i < 25 && node && node !== document.body; i++) {
          if (node.tagName && (
            node.tagName.toLowerCase() === 'grid-shelf-view-model' ||
            node.tagName.toLowerCase() === 'ytd-rich-shelf-renderer' ||
            node.tagName.toLowerCase() === 'ytd-reel-shelf-renderer'
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

  function updateRecommendationsVisibility() {
    try {
      const styleId = 'hide-youtube-recommendations-style';
      const existing = document.getElementById(styleId);
      const isHome = ((location.pathname || '').replace(/\/+$/, '')) === '';
      if (settings[RECS_KEY] && isHome) {
        if (!existing) {
          const style = document.createElement('style');
          style.id = styleId;
          style.textContent = 'ytd-rich-grid-renderer{display:none!important;}';
          document.documentElement.appendChild(style);
        }
      } else {
        if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
      }
    } catch (_) {}
  }

  function findMastheadCenter() {
    try {
      const masthead = document.querySelector('ytd-masthead');
      if (!masthead) return null;
      const root = masthead.shadowRoot;
      if (!root) return null;
      const center = root.getElementById('center') || root.querySelector('#center');
      return center || null;
    } catch (_) {
      return null;
    }
  }

  function ensureCenteredContainer() {
    let container = document.getElementById('yt-centered-controls');
    if (container) return container;
    try {
      const styleId = 'yt-centered-controls-style';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = [
          '#yt-centered-controls{position:fixed;left:50%;top:40vh;transform:translateX(-50%);display:flex;align-items:center;gap:12px;z-index:2147483647;}',
          '#yt-centered-controls > *{max-width:min(90vw,1000px);}',
          '#yt-centered-controls ytd-searchbox{min-width:min(90vw,900px);}',
          '#yt-centered-controls yt-icon-button,#yt-centered-controls yt-button-shape{transform:none;}'
        ].join('');
        document.documentElement.appendChild(style);
      }
      container = document.createElement('div');
      container.id = 'yt-centered-controls';
      document.documentElement.appendChild(container);
      return container;
    } catch (_) {
      return null;
    }
  }

  function gatherMastheadControls(root) {
    const nodes = [];
    try {
      const searchbox = root && root.querySelector && root.querySelector('ytd-searchbox');
      if (searchbox) nodes.push(searchbox);
    } catch (_) {}
    try {
      const searchBtn = root && root.querySelector && root.querySelector('yt-icon-button#search-icon-legacy');
      if (searchBtn) nodes.push(searchBtn);
    } catch (_) {}
    try {
      const micBtn = root && root.querySelector && root.querySelector('yt-button-shape#voice-search-button');
      if (micBtn) nodes.push(micBtn);
    } catch (_) {}
    return nodes.filter(Boolean);
  }

  function updateMastheadCenterRelocation() {
    try {
      const isHome = ((location.pathname || '').replace(/\/+$/, '')) === '';
      const shouldRelocate = Boolean(settings[RECS_KEY] && isHome);

      const container = document.getElementById('yt-centered-controls');
      if (!shouldRelocate) {
        // Restore children if we previously moved them
        if (container && container.__ytRestoreList) {
          container.__ytRestoreList.forEach((entry) => {
            const node = entry && entry.node;
            const parent = entry && entry.parent;
            const nextSibling = entry && entry.nextSibling;
            try {
              if (!node || !parent) return;
              if (node.parentNode === container) {
                if (nextSibling && nextSibling.parentNode === parent) parent.insertBefore(node, nextSibling);
                else parent.appendChild(node);
              }
            } catch (_) {}
          });
          container.__ytRestoreList = undefined;
        }
        if (container && container.parentNode) container.parentNode.removeChild(container);
        return;
      }

      const masthead = document.querySelector('ytd-masthead');
      const root = masthead && masthead.shadowRoot;
      const center = root ? (root.getElementById('center') || root.querySelector('#center')) : null;

      const host = ensureCenteredContainer();
      if (!host) return;

      // If already moved and still attached, nothing to do
      if (host.__ytRestoreList && host.__ytRestoreList.length) {
        const stillAttached = host.__ytRestoreList.every((e) => e && e.node && e.node.parentNode === host);
        if (stillAttached) return;
      }

      const restoreList = [];
      let nodesToMove = [];
      if (root) nodesToMove = gatherMastheadControls(root);
      if ((!nodesToMove || !nodesToMove.length) && center) nodesToMove = Array.from(center.children);
      if (!nodesToMove || !nodesToMove.length) return;

      nodesToMove.forEach((node) => {
        try {
          restoreList.push({ node, parent: node.parentNode, nextSibling: node.nextSibling });
          host.appendChild(node);
        } catch (_) {}
      });
      host.__ytRestoreList = restoreList;
    } catch (_) {}
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

      // If this node is a Shorts shelf container by title text, remove it (do not remove entire sections)
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

      // If this node contains a visible Shorts badge, remove enclosing item/shelf
      if (node.nodeType === 1) {
        try {
          const text = (node.textContent || '').trim().toLowerCase();
          const classStr = (node.className || '').toString();
          if (text === 'shorts' && /badge|shorts/i.test(classStr)) {
            removeByShortsBadge(node);
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
        if (tag === 'grid-shelf-view-model' || tag === 'ytd-rich-shelf-renderer' || tag === 'ytd-reel-shelf-renderer') {
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

  function removeByShortsBadge(node) {
    let cur = node;
    for (let i = 0; i < 25 && cur; i++) {
      if (cur.tagName) {
        const tag = cur.tagName.toLowerCase();
        if (
          tag === 'ytd-video-renderer' ||
          tag === 'ytd-compact-video-renderer' ||
          tag === 'ytd-grid-video-renderer' ||
          tag === 'ytd-rich-grid-media' ||
          tag === 'ytd-rich-item-renderer' ||
          tag === 'grid-shelf-view-model' ||
          tag === 'ytd-rich-shelf-renderer' ||
          tag === 'ytd-reel-shelf-renderer'
        ) {
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
        if (settings[SHORTS_KEY]) removeShortsNow();
        updateRecommendationsVisibility();
        updateMastheadCenterRelocation();
      });
    };
    try {
      const mo = new MutationObserver(schedule);
      mo.observe(root, { subtree: true, childList: true });
    } catch (_) {}
    window.addEventListener('yt-navigate-finish', schedule, true);
    window.addEventListener('popstate', schedule);
    window.addEventListener('hashchange', schedule);
    const id = setInterval(() => {
      if (settings[SHORTS_KEY]) removeShortsNow();
      updateRecommendationsVisibility();
      updateMastheadCenterRelocation();
    }, 3000);
    window.addEventListener('pagehide', () => { try { clearInterval(id); } catch (_) {} });
  }

  getSettings().then((cfg) => {
    const anyEnabled = Boolean(cfg[SHORTS_KEY] || cfg[RECS_KEY]);
    if (!anyEnabled) return;
    injectCss();
    redirectIfOnShorts();
    installClickRewrite();
    if (cfg[SHORTS_KEY]) removeShortsNow();
    updateRecommendationsVisibility();
    updateMastheadCenterRelocation();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        if (settings[SHORTS_KEY]) removeShortsNow();
        updateRecommendationsVisibility();
        updateMastheadCenterRelocation();
      });
    }
    observeSpaChanges();
  });

  try {
    if (chrome && chrome.storage && chrome.storage.onChanged) {
      chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'sync') return;
        let shouldRun = false;
        if (Object.prototype.hasOwnProperty.call(changes, SHORTS_KEY)) {
          settings[SHORTS_KEY] = Boolean(changes[SHORTS_KEY].newValue);
          shouldRun = true;
        }
        if (Object.prototype.hasOwnProperty.call(changes, RECS_KEY)) {
          settings[RECS_KEY] = Boolean(changes[RECS_KEY].newValue);
          shouldRun = true;
        }
        if (shouldRun) {
          if (settings[SHORTS_KEY]) removeShortsNow();
          updateRecommendationsVisibility();
          updateMastheadCenterRelocation();
        }
      });
    }
  } catch (_) {}
})();


