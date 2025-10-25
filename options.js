function loadPatterns() {
  chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
    renderPatterns(patterns || []);
  });
}

function savePatterns(patterns, cb) {
  chrome.storage.sync.set({ patterns }, cb);
}

function saveFilters(filters, cb) {
  chrome.storage.sync.set({ filters }, cb);
}

function renderPatterns(patterns) {
  const list = document.getElementById('patternList');
  list.innerHTML = '';
  if (!patterns.length) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'No patterns yet. Add one above.';
    list.appendChild(li);
    return;
  }
  patterns.forEach((pattern, index) => {
    const li = document.createElement('li');
    li.className = 'list-item';
    const label = document.createElement('span');
    label.innerHTML = `<code>${escapeHtml(pattern)}</code>`;
    const remove = document.createElement('button');
    remove.className = 'btn btn-sm btn-danger';
    remove.textContent = 'Remove';
    remove.addEventListener('click', () => {
      const next = patterns.slice(0, index).concat(patterns.slice(index + 1));
      savePatterns(next, loadPatterns);
    });
    li.appendChild(label);
    li.appendChild(remove);
    list.appendChild(li);
  });
}

function loadFilters() {
  chrome.storage.sync.get({ filters: [] }, ({ filters }) => {
    // Filters are internal; we don't render them, but keep them synced with patterns via toggles
  });
}

function escapeHtml(str) {
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

document.getElementById('addForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('patternInput');
  const value = input.value.trim();
  if (!value) return;
  chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
    const list = patterns || [];
    if (!list.includes(value)) {
      list.push(value);
      savePatterns(list, () => {
        input.value = '';
        loadPatterns();
      });
    } else {
      input.value = '';
    }
  });
});

document.addEventListener('DOMContentLoaded', () => {
  loadPatterns();
  loadFilters();
  const cb = document.getElementById('hideShorts');
  if (cb) {
    chrome.storage.sync.get({ hideYouTubeShorts: true }, (v) => {
      cb.checked = Boolean(v.hideYouTubeShorts);
      // Keep UI list clean: ensure pattern is not in user-visible blocklist
      removePatternIfPresent('*youtube.com/shorts*');
      // Add to internal filters only
      if (typeof syncFilter === 'function') syncFilter(cb, '*youtube.com/shorts*');
    });
    cb.addEventListener('change', () => {
      chrome.storage.sync.set({ hideYouTubeShorts: cb.checked });
      removePatternIfPresent('*youtube.com/shorts*');
      if (typeof syncFilter === 'function') syncFilter(cb, '*youtube.com/shorts*');
    });
  }

  const recs = document.getElementById('hideRecommendations');
  if (recs) {
    chrome.storage.sync.get({ hideYouTubeRecommendations: false }, (v) => {
      recs.checked = Boolean(v.hideYouTubeRecommendations);
    });
    recs.addEventListener('change', () => {
      chrome.storage.sync.set({ hideYouTubeRecommendations: recs.checked });
    });
  }

  // Instagram toggles
  function addPatternIfMissing(pattern) {
    chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
      const list = patterns || [];
      if (!list.includes(pattern)) {
        list.push(pattern);
        savePatterns(list, loadPatterns);
      }
    });
  }

  function removePatternIfPresent(pattern) {
    chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
      const list = patterns || [];
      const idx = list.indexOf(pattern);
      if (idx !== -1) {
        const next = list.slice(0, idx).concat(list.slice(idx + 1));
        savePatterns(next, loadPatterns);
      }
    });
  }

  function addFilterIfMissing(filter) {
    chrome.storage.sync.get({ filters: [] }, ({ filters }) => {
      const list = filters || [];
      if (!list.includes(filter)) {
        list.push(filter);
        saveFilters(list, () => {});
      }
    });
  }

  function removeFilterIfPresent(filter) {
    chrome.storage.sync.get({ filters: [] }, ({ filters }) => {
      const list = filters || [];
      const idx = list.indexOf(filter);
      if (idx !== -1) {
        const next = list.slice(0, idx).concat(list.slice(idx + 1));
        saveFilters(next, () => {});
      }
    });
  }

  function syncPattern(toggle, pattern) {
    if (toggle.checked) addPatternIfMissing(pattern);
    else removePatternIfPresent(pattern);
  }

  function syncPatterns(toggle, patterns) {
    patterns.forEach((p) => syncPattern(toggle, p));
  }

  function syncFilter(toggle, pattern) {
    if (toggle.checked) addFilterIfMissing(pattern);
    else removeFilterIfPresent(pattern);
  }

  const igHome = document.getElementById('igHideHome');
  if (igHome) {
    chrome.storage.sync.get({ igHideHome: true }, (v) => {
      igHome.checked = Boolean(v.igHideHome);
      // Cleanup legacy variants
      removePatternIfPresent('*instagram.com/');
      removePatternIfPresent('*instagram.com/?*');
      removePatternIfPresent('*instagram.com');
      removePatternIfPresent('*instagram.com*');
      // Use filters only (do not clutter patterns list)
      syncFilter(igHome, '*instagram.com');
    });
    igHome.addEventListener('change', () => {
      chrome.storage.sync.set({ igHideHome: igHome.checked });
      removePatternIfPresent('*instagram.com/');
      removePatternIfPresent('*instagram.com/?*');
      removePatternIfPresent('*instagram.com');
      removePatternIfPresent('*instagram.com*');
      syncFilter(igHome, '*instagram.com');
    });
  }

  const igExplore = document.getElementById('igHideExplore');
  if (igExplore) {
    chrome.storage.sync.get({ igHideExplore: true }, (v) => {
      igExplore.checked = Boolean(v.igHideExplore);
      removePatternIfPresent('*instagram.com/explore*');
      syncFilter(igExplore, '*instagram.com/explore*');
    });
    igExplore.addEventListener('change', () => {
      chrome.storage.sync.set({ igHideExplore: igExplore.checked });
      removePatternIfPresent('*instagram.com/explore*');
      syncFilter(igExplore, '*instagram.com/explore*');
    });
  }

  const igReels = document.getElementById('igHideReels');
  if (igReels) {
    chrome.storage.sync.get({ igHideReels: true }, (v) => {
      igReels.checked = Boolean(v.igHideReels);
      removePatternIfPresent('*instagram.com/reels/*');
      syncFilter(igReels, '*instagram.com/reels/*');
    });
    igReels.addEventListener('change', () => {
      chrome.storage.sync.set({ igHideReels: igReels.checked });
      removePatternIfPresent('*instagram.com/reels/*');
      syncFilter(igReels, '*instagram.com/reels/*');
    });
  }
});


