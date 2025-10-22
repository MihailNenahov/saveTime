function loadPatterns() {
  chrome.storage.sync.get({ patterns: [] }, ({ patterns }) => {
    renderPatterns(patterns || []);
  });
}

function savePatterns(patterns, cb) {
  chrome.storage.sync.set({ patterns }, cb);
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
    const label = document.createElement('span');
    label.innerHTML = `<code>${escapeHtml(pattern)}</code>`;
    const remove = document.createElement('button');
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
  const cb = document.getElementById('hideShorts');
  if (cb) {
    chrome.storage.sync.get({ hideYouTubeShorts: true }, (v) => {
      cb.checked = Boolean(v.hideYouTubeShorts);
    });
    cb.addEventListener('change', () => {
      chrome.storage.sync.set({ hideYouTubeShorts: cb.checked });
    });
  }
});


