# Enki (Chrome MV3 Extension)

Enki helps you focus: block distracting URL patterns and declutter feeds (YouTube, Instagram).

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Toggle "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select this folder: `/Users/mnenahov/Projects/saveTime`

## Configure

- Default pattern added on install: `*instagram.com/reels/*`
- Add more patterns (wildcards `*` supported) in the Options page.
- Any matching main-frame navigation will redirect to `redirect.html`.

## Notes

- Uses `declarativeNetRequest` dynamic rules; wildcard patterns are converted to RE2 regex internally.
- Matching scope: any scheme (e.g., `https`, `http`), main-frame navigations only.
- Permissions: `storage`, `declarativeNetRequest`, and `<all_urls>` host access to evaluate matches.

## Privacy Policy

- This extension does not collect, transmit, sell, or share user data.
- Settings (URL patterns and feature toggles) are stored locally in `chrome.storage.sync` and may be synced between your own devices by Chrome if you enable Sync.
- Full policy: open `privacy.html` in this repository (or host it and use the URL in the Chrome Web Store listing).
