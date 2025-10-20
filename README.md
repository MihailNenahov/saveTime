# Porsche Redirect (Chrome MV3 Extension)

Redirects any URL matching your custom patterns to a Porsche image.

## Install (Developer Mode)

1. Open Chrome → `chrome://extensions`
2. Toggle "Developer mode" (top-right)
3. Click "Load unpacked"
4. Select this folder: `/Users/mnenahov/Projects/saveTime`

## Configure

- Default pattern added on install: `*instagram.com/reels/*`
- Add more patterns (wildcards `*` supported) in the Options page.
- Any matching main-frame navigation will redirect to `redirect.html` which displays a Porsche image.

## Notes

- Uses `declarativeNetRequest` dynamic rules; wildcard patterns are converted to RE2 regex internally.
- Matching scope: any scheme (e.g., `https`, `http`), main-frame navigations only.
- Permissions: `storage`, `declarativeNetRequest`, and `<all_urls>` host access to evaluate matches.
